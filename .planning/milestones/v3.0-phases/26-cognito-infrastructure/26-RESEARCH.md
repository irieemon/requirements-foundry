# Phase 26: Cognito Infrastructure - Research

**Researched:** 2026-03-09
**Domain:** AWS Cognito + Okta SAML Federation via CDK
**Confidence:** HIGH

## Summary

Phase 26 adds AWS Cognito User Pool infrastructure to the existing CDK stack (`infra/lib/requirements-foundry-stack.ts`). The stack already deploys VPC, RDS, S3, ECS Fargate, ALB, Lambda cron, and CloudWatch alarms using `aws-cdk-lib ^2.241.0`. This phase extends it with a Cognito User Pool, an Okta SAML identity provider, a PreTokenGeneration Lambda that maps Okta groups to `cognito:groups` in the JWT, a Cognito domain for the Hosted UI, and secure storage of Cognito client credentials.

The critical external dependency is the Okta SAML app configuration, which requires IT team action (noted in STATE.md as a blocker). There is a chicken-and-egg problem: Okta needs the Cognito ACS URL and Entity ID to configure the SAML app, but Cognito needs the Okta metadata URL/XML to configure the identity provider. The standard approach is to create the Okta app with placeholder values, get the metadata URL, deploy CDK, then update the Okta app with real Cognito values.

**Primary recommendation:** Add Cognito resources to the existing `RequirementsFoundryStack` (no separate stack needed), use `UserPoolIdentityProviderSaml` with metadata URL from Okta, use CDK `AwsCustomResource` to extract the client secret and store it in Secrets Manager, and pass it to ECS via the `secrets` container property.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Cognito User Pool deployed via CDK with Okta SAML identity provider | CDK `UserPool` + `UserPoolIdentityProviderSaml` constructs with Okta metadata URL; attribute mapping for email and groups; Cognito domain for Hosted UI |
| INFRA-02 | PreTokenGeneration Lambda maps Okta groups to JWT claims | CDK `addTrigger` with `PRE_TOKEN_GENERATION_CONFIG` and `LambdaVersion.V2_0`; Lambda parses `custom:groups` attribute and returns `groupOverrideDetails.groupsToOverride` |
| INFRA-03 | Cognito client credentials stored securely (Secrets Manager or environment) | CDK `AwsCustomResource` to call `describeUserPoolClient` and extract client secret; store in Secrets Manager secret; inject into ECS container via `ecs.Secret.fromSecretsManager()` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| aws-cdk-lib | ^2.241.0 | CDK infrastructure definitions | Already used in project; `aws-cognito` module included |
| aws-cdk-lib/aws-cognito | (included) | UserPool, SAML IdP, UserPoolClient, domain | L2 constructs for all Cognito resources |
| aws-cdk-lib/aws-lambda | (included) | PreTokenGeneration Lambda | Already used for cron Lambda in stack |
| aws-cdk-lib/aws-secretsmanager | (included) | Store Cognito client credentials | Already used for RDS credentials |
| aws-cdk-lib/custom-resources | (included) | AwsCustomResource to extract client secret | Needed because CloudFormation does not expose client secret |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-cognito-identity-provider | (Lambda runtime) | Only if Lambda needs to call Cognito APIs | Not needed for PreTokenGeneration -- event has all data |
| constructs | ^10.5.0 | CDK construct base | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Metadata URL | Metadata file content | URL auto-refreshes on cert rotation; file requires manual updates. Use URL. |
| AwsCustomResource for secret | `cdk-cognito-secret` third-party construct | Third-party adds dependency; AwsCustomResource is 15 lines and built-in |
| Secrets Manager for client creds | SSM SecureString | Secrets Manager integrates with ECS `secrets` property natively; SSM requires more IAM setup |
| Separate Cognito stack | Single stack (existing) | Separate stack adds cross-stack references; single stack is simpler for this size |

**Installation:**
No new npm packages needed. All constructs are in `aws-cdk-lib` which is already installed.

## Architecture Patterns

### Recommended Changes to Existing Stack
```
infra/
  lib/
    requirements-foundry-stack.ts   # ADD: Cognito resources (UserPool, SAML IdP, client, domain, Lambda, secret)
  lambda/
    pre-token-generation/
      index.ts                       # NEW: PreTokenGeneration Lambda handler
  test/
    requirements-foundry-stack.test.ts  # UPDATE: Add Cognito resource assertions
```

### Pattern 1: Cognito User Pool with SAML IdP in CDK
**What:** Create UserPool, add Cognito domain, create SAML IdP with Okta metadata, create UserPoolClient with OAuth flows, wire PreTokenGeneration Lambda trigger.
**When to use:** Always for this phase -- single coherent set of resources.
**Example:**
```typescript
// Source: AWS CDK docs aws-cdk-lib.aws_cognito-readme
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';

// User Pool
const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: 'requirements-foundry-prod',
  selfSignUpEnabled: false,  // Corporate SSO only
  signInAliases: { email: true },
  autoVerify: { email: true },
  standardAttributes: {
    email: { required: true, mutable: true },
  },
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

// Cognito Domain (for Hosted UI)
const domain = userPool.addDomain('CognitoDomain', {
  cognitoDomain: {
    domainPrefix: 'requirements-foundry-prod',  // Must be globally unique
  },
});

// Okta SAML Identity Provider
const oktaMetadataUrl = this.node.tryGetContext('oktaMetadataUrl')
  || 'https://your-okta-domain.okta.com/app/PLACEHOLDER/sso/saml/metadata';

const samlProvider = new cognito.UserPoolIdentityProviderSaml(this, 'OktaSamlIdp', {
  userPool,
  name: 'Okta',
  metadata: cognito.UserPoolIdentityProviderSamlMetadata.url(oktaMetadataUrl),
  attributeMapping: {
    email: cognito.ProviderAttribute.other('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'),
    custom: {
      'custom:groups': cognito.ProviderAttribute.other('groups'),
    },
  },
});

// PreTokenGeneration Lambda
const preTokenFn = new lambda.Function(this, 'PreTokenGenerationFn', {
  functionName: 'requirements-foundry-pre-token-generation',
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/pre-token-generation'),
  timeout: cdk.Duration.seconds(5),
  memorySize: 128,
});

userPool.addTrigger(
  cognito.UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
  preTokenFn,
  cognito.LambdaVersion.V2_0,
);

// User Pool Client
const albDnsName = alb.loadBalancerDnsName;  // Already exists in stack
const client = userPool.addClient('AppClient', {
  userPoolClientName: 'requirements-foundry-app',
  generateSecret: true,  // Required for server-side auth code flow
  oAuth: {
    flows: { authorizationCodeGrant: true },
    scopes: [
      cognito.OAuthScope.OPENID,
      cognito.OAuthScope.EMAIL,
      cognito.OAuthScope.PROFILE,
    ],
    callbackUrls: [`http://${albDnsName}/api/auth/callback`],
    logoutUrls: [`http://${albDnsName}/`],
  },
  supportedIdentityProviders: [
    cognito.UserPoolClientIdentityProvider.custom('Okta'),
  ],
  accessTokenValidity: cdk.Duration.hours(1),
  idTokenValidity: cdk.Duration.hours(1),
  refreshTokenValidity: cdk.Duration.days(30),
});
client.node.addDependency(samlProvider);  // Ensure IdP created before client references it
```

### Pattern 2: Extract Client Secret via AwsCustomResource
**What:** Use CDK custom resource to call `describeUserPoolClient` API, extract the secret, and store in Secrets Manager.
**When to use:** Always -- CloudFormation does not expose client secret as an attribute.
**Example:**
```typescript
// Source: aws/aws-cdk#7225
import * as cr from 'aws-cdk-lib/custom-resources';

const describeCognitoClient = new cr.AwsCustomResource(this, 'DescribeCognitoClient', {
  resourceType: 'Custom::DescribeCognitoUserPoolClient',
  onCreate: {
    service: 'CognitoIdentityServiceProvider',
    action: 'describeUserPoolClient',
    parameters: {
      UserPoolId: userPool.userPoolId,
      ClientId: client.userPoolClientId,
    },
    physicalResourceId: cr.PhysicalResourceId.of(client.userPoolClientId),
  },
  onUpdate: {
    service: 'CognitoIdentityServiceProvider',
    action: 'describeUserPoolClient',
    parameters: {
      UserPoolId: userPool.userPoolId,
      ClientId: client.userPoolClientId,
    },
    physicalResourceId: cr.PhysicalResourceId.of(client.userPoolClientId),
  },
  policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
    resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
  }),
});

const cognitoSecret = new secretsmanager.Secret(this, 'CognitoClientSecret', {
  secretName: 'requirements-foundry-prod/cognito-client',
  description: 'Cognito App Client credentials',
  secretObjectValue: {
    userPoolId: cdk.SecretValue.unsafePlainText(userPool.userPoolId),
    clientId: cdk.SecretValue.unsafePlainText(client.userPoolClientId),
    clientSecret: cdk.SecretValue.unsafePlainText(
      describeCognitoClient.getResponseField('UserPoolClient.ClientSecret')
    ),
    domain: cdk.SecretValue.unsafePlainText(
      `${domain.domainName}.auth.us-east-1.amazoncognito.com`
    ),
  },
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

### Pattern 3: PreTokenGeneration Lambda Handler
**What:** Parse Okta groups from SAML assertion custom attribute and map to cognito:groups.
**When to use:** Always -- Cognito does not natively map SAML group assertions to cognito:groups.
**Example:**
```typescript
// Source: aws-samples/amazon-cognito-example-for-external-idp pretokengeneration
// infra/lambda/pre-token-generation/index.ts

interface PreTokenGenerationEvent {
  request: {
    userAttributes: Record<string, string>;
    groupConfiguration: {
      groupsToOverride?: string[];
      iamRolesToOverride?: string[];
      preferredRole?: string;
    };
  };
  response: {
    claimsAndScopeOverrideDetails?: {
      groupOverrideDetails?: {
        groupsToOverride?: string[];
        iamRolesToOverride?: string[];
        preferredRole?: string;
      };
    };
  };
}

export const handler = async (event: PreTokenGenerationEvent) => {
  const groups: string[] = [];

  // Parse groups from Okta SAML assertion (stored as custom:groups attribute)
  const oktaGroups = event.request.userAttributes['custom:groups'];
  if (oktaGroups) {
    // Okta sends groups as comma-separated or JSON array depending on config
    try {
      const parsed = JSON.parse(oktaGroups);
      if (Array.isArray(parsed)) {
        groups.push(...parsed);
      }
    } catch {
      // Fallback: treat as comma-separated
      groups.push(...oktaGroups.split(',').map(g => g.trim()).filter(Boolean));
    }
  }

  // Merge with any existing Cognito groups
  const existingGroups = event.request.groupConfiguration.groupsToOverride || [];
  const allGroups = [...new Set([...existingGroups, ...groups])];

  event.response = {
    claimsAndScopeOverrideDetails: {
      groupOverrideDetails: {
        groupsToOverride: allGroups,
      },
    },
  };

  return event;
};
```

### Pattern 4: Inject Cognito Credentials into ECS
**What:** Pass Cognito secret to existing ECS container via `secrets` property.
**When to use:** When the app needs client ID, client secret, and domain to perform OAuth flows.
**Example:**
```typescript
// Add to existing container definition in stack
// The existing taskDefinition.addContainer('AppContainer', {...}) call needs updating:
secrets: {
  CRON_SECRET: ecs.Secret.fromSecretsManager(cronSecret),
  COGNITO_CLIENT_SECRET: ecs.Secret.fromSecretsManager(cognitoSecret),
},
environment: {
  // ...existing env vars...
  COGNITO_USER_POOL_ID: userPool.userPoolId,
  COGNITO_CLIENT_ID: client.userPoolClientId,
  COGNITO_DOMAIN: `https://${domain.domainName}.auth.us-east-1.amazoncognito.com`,
  COGNITO_REDIRECT_URI: `http://${alb.loadBalancerDnsName}/api/auth/callback`,
},
```

### Anti-Patterns to Avoid
- **Hardcoding Okta metadata XML in CDK code:** Use metadata URL instead -- it auto-refreshes when Okta rotates certificates.
- **Passing client secret as plaintext environment variable:** Use Secrets Manager + ECS `secrets` property. Never put secrets in `environment`.
- **Creating a separate CDK stack for Cognito:** Adds unnecessary cross-stack references. The existing stack is manageable size (~500 lines).
- **Using `UserPoolClient.userPoolClientSecret` directly:** This is a CDK Token that cannot be resolved at deploy time for arbitrary use. Use AwsCustomResource instead.
- **Using V1 PreTokenGeneration trigger:** V2_0 supports both ID token and access token customization; V1 is limited.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SAML metadata parsing | Custom XML parser | `UserPoolIdentityProviderSamlMetadata.url()` | CDK handles metadata fetch and validation |
| Client secret extraction | Post-deploy script | `AwsCustomResource` with `describeUserPoolClient` | Runs during CDK deploy, no manual step |
| Group mapping | Custom JWT middleware | PreTokenGeneration Lambda trigger | Cognito-native, runs before token issuance |
| Hosted UI login page | Custom login page (Phase 26) | Cognito Hosted UI domain | Phase 27 handles app-level auth; Phase 26 just needs Hosted UI for testing |
| Secret rotation | Custom rotation Lambda | Secrets Manager (no rotation needed for POC) | Client secret is static; rotation is v2 concern |

**Key insight:** Cognito provides the SAML SP plumbing (ACS endpoint, metadata, token issuance) -- you configure it, not build it. The only custom code is the ~30-line PreTokenGeneration Lambda.

## Common Pitfalls

### Pitfall 1: Chicken-and-Egg with Okta Metadata
**What goes wrong:** CDK needs Okta metadata URL to deploy, but Okta needs Cognito ACS URL and Entity ID to create the SAML app.
**Why it happens:** Circular dependency between Okta (IdP) and Cognito (SP) configurations.
**How to avoid:** Two-phase setup: (1) Create Okta SAML app with placeholder ACS URL `https://placeholder.auth.us-east-1.amazoncognito.com/saml2/idpresponse` and Entity ID `urn:amazon:cognito:sp:placeholder`. Get the metadata URL from Okta. (2) Deploy CDK with the Okta metadata URL. (3) Update the Okta app with real ACS URL `https://<cognitoDomainPrefix>.auth.us-east-1.amazoncognito.com/saml2/idpresponse` and Entity ID `urn:amazon:cognito:sp:<userPoolId>`. CDK outputs should include both values.
**Warning signs:** SAML authentication fails with "Invalid SAML response" errors.

### Pitfall 2: Cognito Domain Prefix Must Be Globally Unique
**What goes wrong:** `cdk deploy` fails with "Domain already exists" error.
**Why it happens:** Cognito domain prefixes are globally unique across all AWS accounts.
**How to avoid:** Use a distinctive prefix like `requirements-foundry-prod` or add a suffix. Include in CDK context so it can be changed easily.
**Warning signs:** CloudFormation CREATE_FAILED on `AWS::Cognito::UserPoolDomain`.

### Pitfall 3: Okta Group Attribute Format Varies
**What goes wrong:** PreTokenGeneration Lambda fails to parse groups; `cognito:groups` claim is empty.
**Why it happens:** Okta can send groups as a single comma-separated string, a JSON array string, or individual attribute values depending on the Okta SAML attribute statement configuration.
**How to avoid:** Lambda must handle multiple formats (comma-separated, JSON array, single value). Log the raw `custom:groups` attribute during testing.
**Warning signs:** JWT ID token has empty `cognito:groups` even though Okta SAML assertion includes group data.

### Pitfall 4: SAML Attribute Mapping Must Match Okta Statement Names
**What goes wrong:** User attributes are null after SAML login.
**Why it happens:** CDK `attributeMapping` keys must exactly match the SAML attribute names in the Okta assertion (e.g., `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` for email).
**How to avoid:** Check Okta SAML assertion in browser dev tools. The attribute name in `ProviderAttribute.other()` must match the `Name` attribute in Okta's `<saml:Attribute>` element.
**Warning signs:** User created in Cognito but email/name fields are empty.

### Pitfall 5: Custom Attributes Must Be Pre-Declared
**What goes wrong:** Cognito rejects the `custom:groups` mapping because the attribute does not exist on the user pool.
**Why it happens:** Custom attributes must be declared on the `UserPool` before they can be used in attribute mapping.
**How to avoid:** Add `customAttributes: { groups: new cognito.StringAttribute({ mutable: true }) }` to the UserPool constructor.
**Warning signs:** CDK deploy fails or SAML login silently drops the groups attribute.

### Pitfall 6: Client Secret Cannot Be Retrieved from CloudFormation
**What goes wrong:** Trying to use `client.userPoolClientSecret` in Secrets Manager fails or produces a placeholder token.
**Why it happens:** CloudFormation does not expose `UserPoolClient.ClientSecret` as a return attribute.
**How to avoid:** Use `AwsCustomResource` to call `describeUserPoolClient` API during deployment, which returns the actual secret value.
**Warning signs:** ECS container receives empty or token-string for COGNITO_CLIENT_SECRET.

### Pitfall 7: ECS Task Needs Secrets Manager Read for Cognito Secret
**What goes wrong:** ECS task fails to start with "unable to retrieve secret" error.
**Why it happens:** Task execution role does not have permission to read the new Cognito secret from Secrets Manager.
**How to avoid:** Grant `cognitoSecret.grantRead(taskExecutionRole)` in CDK, just like the existing `cronSecret.grantRead(taskExecutionRole)`.
**Warning signs:** ECS task enters STOPPED state with ResourceInitializationError.

## Code Examples

### Complete UserPool with Custom Attributes
```typescript
// Source: CDK aws_cognito module docs
const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: 'requirements-foundry-prod',
  selfSignUpEnabled: false,
  signInAliases: { email: true },
  autoVerify: { email: true },
  standardAttributes: {
    email: { required: true, mutable: true },
    givenName: { required: false, mutable: true },
    familyName: { required: false, mutable: true },
  },
  customAttributes: {
    groups: new cognito.StringAttribute({ mutable: true }),
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

### CDK Stack Outputs for Okta Configuration
```typescript
// These outputs are needed to configure Okta SAML app after first deploy
new cdk.CfnOutput(this, 'CognitoUserPoolId', {
  value: userPool.userPoolId,
  exportName: 'rf-prod-cognito-user-pool-id',
});
new cdk.CfnOutput(this, 'CognitoEntityId', {
  value: `urn:amazon:cognito:sp:${userPool.userPoolId}`,
  exportName: 'rf-prod-cognito-entity-id',
  description: 'Set this as Audience URI (SP Entity ID) in Okta SAML app',
});
new cdk.CfnOutput(this, 'CognitoAcsUrl', {
  value: `https://${domain.domainName}.auth.us-east-1.amazoncognito.com/saml2/idpresponse`,
  exportName: 'rf-prod-cognito-acs-url',
  description: 'Set this as Single Sign On URL in Okta SAML app',
});
new cdk.CfnOutput(this, 'CognitoHostedUiUrl', {
  value: domain.signInUrl(client, {
    redirectUri: `http://${alb.loadBalancerDnsName}/api/auth/callback`,
  }),
  exportName: 'rf-prod-cognito-hosted-ui-url',
  description: 'Use this URL to test SAML login via Cognito Hosted UI',
});
new cdk.CfnOutput(this, 'CognitoClientId', {
  value: client.userPoolClientId,
  exportName: 'rf-prod-cognito-client-id',
});
```

### Okta SAML App Attribute Statements (IT Team Instructions)
```
Attribute Statements:
  Name: email
  Value: user.email

  Name: firstName
  Value: user.firstName

  Name: lastName
  Value: user.lastName

Group Attribute Statements:
  Name: groups
  Filter: Matches regex ".*" (or specific group filter like "RequirementsFoundry.*")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PreTokenGeneration V1 | PreTokenGeneration V2_0 | CDK 2.x | V2 can customize access token scopes too, not just ID token |
| Manual client secret extraction | AwsCustomResource | CDK custom-resources module | No post-deploy script needed |
| CfnUserPoolIdentityProvider (L1) | UserPoolIdentityProviderSaml (L2) | CDK 2.x | Higher-level construct with attribute mapping support |
| Metadata file content | Metadata URL | Always available | Auto-refreshes on Okta cert rotation |

**Deprecated/outdated:**
- `LambdaVersion.V1_0` for PreTokenGeneration: V2_0 is preferred; V1 cannot customize access tokens
- Cognito User Pools standalone login (without domain): A domain is required for SAML federation

## Open Questions

1. **Okta Metadata URL availability**
   - What we know: IT team needs to create the Okta SAML app and provide the metadata URL
   - What's unclear: Whether IT has already created a placeholder app or needs instructions
   - Recommendation: Plan provides step-by-step Okta configuration instructions for IT team. CDK uses context variable `oktaMetadataUrl` so it can be set without code changes. Use a placeholder URL for initial deploy and update after IT provides real one.

2. **Cognito Domain Prefix uniqueness**
   - What we know: Must be globally unique across all AWS accounts
   - What's unclear: Whether `requirements-foundry-prod` is available
   - Recommendation: Use CDK context variable `cognitoDomainPrefix` with fallback. If taken, append account ID or random suffix.

3. **Okta Group Attribute Format**
   - What we know: Okta can send groups in multiple formats depending on statement configuration
   - What's unclear: Exact format IT team will configure
   - Recommendation: Lambda handles both JSON array and comma-separated formats. Include CloudWatch logging for debugging.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via ts-jest, already configured in infra/) |
| Config file | `infra/jest.config.js` |
| Quick run command | `cd infra && npx jest --testPathPattern cognito` |
| Full suite command | `cd infra && npx jest` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Cognito UserPool + SAML IdP deployed | unit (CDK assertions) | `cd infra && npx jest --testPathPattern requirements-foundry-stack` | Existing file, needs new tests |
| INFRA-02 | PreTokenGeneration Lambda trigger configured | unit (CDK assertions) | `cd infra && npx jest --testPathPattern requirements-foundry-stack` | Existing file, needs new tests |
| INFRA-02 | Lambda correctly maps groups | unit (Lambda handler) | `cd infra && npx jest --testPathPattern pre-token` | No -- Wave 0 |
| INFRA-03 | Cognito credentials in Secrets Manager | unit (CDK assertions) | `cd infra && npx jest --testPathPattern requirements-foundry-stack` | Existing file, needs new tests |
| INFRA-01 | SAML login works end-to-end | manual-only | Test via Cognito Hosted UI URL in browser | N/A (requires Okta) |

### Sampling Rate
- **Per task commit:** `cd infra && npx jest`
- **Per wave merge:** `cd infra && npx jest`
- **Phase gate:** Full suite green + manual SAML login verification via Hosted UI

### Wave 0 Gaps
- [ ] `infra/test/pre-token-generation.test.ts` -- unit tests for Lambda handler (covers INFRA-02 logic)
- [ ] Update `infra/test/requirements-foundry-stack.test.ts` -- add assertions for Cognito resources (UserPool, domain, SAML IdP, client, Lambda trigger, Secrets Manager secret, CfnOutputs)

## Sources

### Primary (HIGH confidence)
- [aws-cdk-lib.aws_cognito-readme](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito-readme.html) - UserPool, SAML IdP, UserPoolClient, domain, triggers, attribute mapping
- [UserPoolIdentityProviderSaml construct](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.UserPoolIdentityProviderSaml.html) - SAML metadata options
- [UserPoolTriggers interface](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.UserPoolTriggers.html) - PreTokenGeneration trigger
- [Pre token generation Lambda trigger docs](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html) - V2 event format, groupOverrideDetails

### Secondary (MEDIUM confidence)
- [aws/aws-cdk#7225](https://github.com/aws/aws-cdk/issues/7225) - AwsCustomResource approach to extract client secret
- [aws-samples/amazon-cognito-example-for-external-idp](https://github.com/aws-samples/amazon-cognito-example-for-external-idp) - PreTokenGeneration Lambda example
- [aws-samples/amazon-cognito-saml-idp](https://github.com/aws-samples/amazon-cognito-saml-idp) - Full SAML federation example
- [Set Up Okta as SAML IdP in Cognito (re:Post)](https://repost.aws/knowledge-center/cognito-okta-saml-identity-provider) - Okta configuration steps

### Tertiary (LOW confidence)
- [Cognito SAML Federation with Okta (oneuptime.com)](https://oneuptime.com/blog/post/2026-02-12-cognito-saml-federation-okta/view) - Recent community guide, cross-verified with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All constructs are in aws-cdk-lib already used by the project
- Architecture: HIGH - Patterns verified against CDK docs and AWS samples
- Pitfalls: HIGH - Well-documented issues in AWS re:Post and CDK GitHub issues
- PreTokenGeneration V2 format: MEDIUM - Verified against docs and samples but not hands-on tested

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (CDK and Cognito are stable; Okta SAML is a mature protocol)
