# Technology Stack: Authentication & Multi-User (v3.0)

**Project:** Requirements Foundry - Cognito + Okta SAML SSO
**Researched:** 2026-03-09
**Overall Confidence:** HIGH

## Existing Stack (unchanged)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.1 | Full-stack React framework |
| React | 19.2.3 | UI library |
| Prisma | 7.2.0 | ORM with `@prisma/adapter-pg` driver adapter |
| AWS CDK | v2 (latest) | Infrastructure as Code (TypeScript) |
| ECS Fargate | ARM64 | Container compute |
| RDS PostgreSQL | 16.3 | Database |
| S3 | N/A | File storage |
| Bedrock | Claude Sonnet 4 | AI inference |

## Packages to ADD

### Authentication (App-side)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `aws-jwt-verify` | ^5.1.1 | Cognito JWT token verification | Official AWS library purpose-built for Cognito. Verifies ID and access tokens, handles JWKS key rotation and caching automatically. 460K+ weekly npm downloads. Works in Node.js runtime -- and Next.js 16's `proxy.ts` runs on Node.js (not Edge), so there is no compatibility issue. | HIGH |

### Authentication (Infrastructure-side)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `aws-cdk-lib/aws-cognito` | (already in aws-cdk-lib) | Cognito User Pool + SAML IdP in CDK | Part of the existing `aws-cdk-lib` dependency in `infra/`. Provides `UserPool`, `UserPoolClient`, `UserPoolDomain`, and `UserPoolIdentityProviderSaml` L2 constructs. No new npm install needed -- just new imports. | HIGH |
| `aws-cdk-lib/aws-lambda` | (already in aws-cdk-lib) | Pre Token Generation Lambda trigger | Already imported in the CDK stack. Used for a Lambda that maps Okta `custom:groups` attribute to `cognito:groups` in the JWT claims. Required because Cognito cannot natively map SAML group attributes to `cognito:groups`. | HIGH |

## Packages NOT to Add

| Package | Why Not |
|---------|---------|
| `next-auth` / `auth.js` | Unnecessary abstraction layer. Cognito Hosted UI handles OAuth/SAML redirect flow. The app only needs to verify JWTs from cookies -- `aws-jwt-verify` does this directly. NextAuth adds a session database, provider abstraction, and callback complexity that duplicates what Cognito already provides. |
| `@aws-amplify/auth` | Amplify is a heavyweight SDK designed for client-side SPAs. It bundles 200KB+ of JavaScript, requires client-side configuration, and conflicts with Next.js server component patterns. The app needs server-side token verification, not client-side auth management. |
| `amazon-cognito-identity-js` | Legacy library. Designed for Cognito User Pool direct auth (username/password), not federated SAML SSO. Cognito Hosted UI handles the SAML redirect flow without this library. |
| `jose` | Edge-runtime-compatible JWT library (48M weekly downloads). Would be necessary if using `middleware.ts` (Edge runtime), but Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts` which runs on Node.js. Since `aws-jwt-verify` works on Node.js and is purpose-built for Cognito (auto-handles JWKS URLs, issuer validation, token_use claims), it is the better choice. |
| `jsonwebtoken` / `jwks-rsa` | Generic JWT libraries. `aws-jwt-verify` handles Cognito-specific validation (user pool ID, app client ID, token_use claim) out of the box with a single configuration object. These generic libraries require manual JWKS endpoint construction, manual claim validation, and manual key caching. |
| `@aws-sdk/client-cognito-identity-provider` | Admin SDK for managing Cognito programmatically (create users, manage pools). Not needed at runtime -- CDK handles pool creation, and the app only verifies tokens. Only add this if you later need admin APIs like "list all users" from the app itself. |

## Packages to KEEP (unchanged)

All existing dependencies remain unchanged. Authentication adds to the stack; it does not replace anything.

## How Authentication Works (Architecture Decision)

### Cognito Hosted UI + Authorization Code Flow

Use Cognito's Hosted UI (managed login) for the SAML SSO flow. This is the only way to do SAML with Cognito -- you cannot build a custom SAML login form because SAML requires HTTP redirects between the IdP (Okta) and SP (Cognito).

**Flow:**
1. User clicks "Sign in with Okta" on the landing page
2. Browser redirects to Cognito Hosted UI domain (`https://<prefix>.auth.us-east-1.amazoncognito.com/oauth2/authorize`)
3. Cognito redirects to Okta SAML login page
4. User authenticates with Okta (SSO, MFA, etc.)
5. Okta POSTs SAML assertion back to Cognito (`/saml2/idpresponse`)
6. Cognito validates assertion, creates/updates user, issues authorization code
7. Cognito redirects to app callback URL (`/api/auth/callback`) with `?code=...`
8. App server exchanges code for tokens at Cognito's `/oauth2/token` endpoint
9. App sets tokens in HTTP-only cookies
10. Subsequent requests: `proxy.ts` reads cookie, verifies JWT with `aws-jwt-verify`

### Why NOT a Custom UI

SAML 2.0 requires browser redirects to the IdP. There is no way to embed Okta SAML login in a custom form. The Hosted UI handles the entire SAML handshake, certificate validation, and assertion parsing. Customization of the Hosted UI appearance is possible via CSS in the Cognito console (logo, colors, fonts).

### Why proxy.ts Instead of middleware.ts

Next.js 16 renamed `middleware.ts` to `proxy.ts` and changed the runtime from Edge to Node.js. This is a breaking change documented in the [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16). Since the project is on Next.js 16.1.1, use `proxy.ts`:

- `proxy.ts` runs on **Node.js runtime** (not Edge)
- This means `aws-jwt-verify` works directly (it requires Node.js APIs)
- No need for Edge-compatible alternatives like `jose`
- The `middleware.ts` filename still works but is **deprecated** and will be removed in a future version

## CDK Infrastructure Additions

All constructs come from the existing `aws-cdk-lib` dependency. No new CDK packages needed.

### Cognito User Pool

```typescript
import * as cognito from 'aws-cdk-lib/aws-cognito';

const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: 'requirements-foundry-prod',
  selfSignUpEnabled: false,         // Okta-only, no self-registration
  signInAliases: { email: true },
  standardAttributes: {
    email: { required: true, mutable: false },
  },
  customAttributes: {
    groups: new cognito.StringAttribute({ mutable: true }),  // Okta groups
  },
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

### SAML Identity Provider (Okta)

```typescript
const samlProvider = new cognito.UserPoolIdentityProviderSaml(this, 'OktaSaml', {
  userPool,
  name: 'Okta',
  metadata: cognito.UserPoolIdentityProviderSamlMetadata.url(
    'https://your-okta-domain.okta.com/app/YOUR_APP_ID/sso/saml/metadata'
  ),
  attributeMapping: {
    email: cognito.ProviderAttribute.other('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'),
    custom: {
      'custom:groups': cognito.ProviderAttribute.other('groups'),
    },
  },
});
```

### User Pool Domain (Hosted UI)

```typescript
const domain = userPool.addDomain('CognitoDomain', {
  cognitoDomain: { domainPrefix: 'requirements-foundry' },
});
```

### User Pool Client (App)

```typescript
const userPoolClient = userPool.addClient('AppClient', {
  userPoolClientName: 'requirements-foundry-app',
  generateSecret: true,                      // Server-side app needs client secret
  oAuth: {
    flows: { authorizationCodeGrant: true },  // PKCE not needed for server-side
    scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
    callbackUrls: ['https://YOUR_ALB_DNS/api/auth/callback'],
    logoutUrls: ['https://YOUR_ALB_DNS/'],
  },
  supportedIdentityProviders: [
    cognito.UserPoolClientIdentityProvider.custom('Okta'),
  ],
});
userPoolClient.node.addDependency(samlProvider);
```

### Pre Token Generation Lambda (Groups Mapping)

```typescript
const preTokenLambda = new lambda.Function(this, 'PreTokenGeneration', {
  functionName: 'requirements-foundry-pre-token-gen',
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromInline(`
    exports.handler = async (event) => {
      const groups = event.request.userAttributes['custom:groups'];
      if (groups) {
        // Parse groups from Okta (format: "[admin,users]" or "admin,users")
        const parsed = groups.replace(/[\\[\\]]/g, '').split(',').map(g => g.trim()).filter(Boolean);
        event.response.claimsOverrideDetails = {
          groupOverrideDetails: { groupsToOverride: parsed },
        };
      }
      return event;
    };
  `),
  timeout: cdk.Duration.seconds(5),
  memorySize: 128,
});

userPool.addTrigger(cognito.UserPoolOperation.PRE_TOKEN_GENERATION, preTokenLambda);
```

**Important:** CDK's `addTrigger` defaults to V1_0 for Pre Token Generation. V1_0 supports `groupOverrideDetails` which is sufficient for mapping Okta groups to `cognito:groups` in the ID token. V2_0 is only needed if customizing access token scopes (not required here).

## Prisma Schema Changes

### Make `userId` required + add User model

```prisma
model User {
  id        String   @id           // Cognito sub (UUID)
  email     String   @unique
  name      String?
  role      String   @default("user")  // "user" or "admin"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projects Project[]

  @@index([email])
  @@index([role])
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  userId      String   // NOW REQUIRED -- FK to User.id

  user    User     @relation(fields: [userId], references: [id])
  // ... existing relations unchanged
}
```

**Migration strategy:** The existing `Project.userId` column is nullable with an `@@index([userId])`. The migration will:
1. Add the `User` table
2. Create a default admin user (sean.mcinerney@merkle.com)
3. Assign all existing projects to the admin user
4. Alter `userId` to NOT NULL
5. Add the foreign key constraint

## Environment Variables (New)

| Variable | Where Set | Purpose |
|----------|-----------|---------|
| `COGNITO_USER_POOL_ID` | ECS task env (from CDK output) | User Pool ID for JWT verification |
| `COGNITO_CLIENT_ID` | ECS task env (from CDK output) | App client ID for OAuth flow |
| `COGNITO_CLIENT_SECRET` | ECS secret (from Secrets Manager) | App client secret for token exchange |
| `COGNITO_DOMAIN` | ECS task env (from CDK output) | Hosted UI domain for login/logout URLs |
| `NEXTAUTH_URL` / `APP_URL` | ECS task env | Base URL for callback (ALB DNS) |

## Key Integration Points

### 1. proxy.ts (Route Protection)

```typescript
// proxy.ts (Next.js 16 -- replaces middleware.ts)
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  clientId: process.env.COGNITO_CLIENT_ID!,
  tokenUse: 'id',  // Use ID token (has email, groups claims)
});

export function proxy(request: Request) {
  // Public routes: landing page, auth callback, health check
  // Protected routes: everything else -- verify JWT from cookie
}
```

### 2. Server Actions / API Routes (User Context)

Every server action reads the current user from the verified JWT cookie. Prisma queries filter by `userId` for data isolation:

```typescript
// All project queries include: where: { userId: currentUser.sub }
// Admin users (cognito:groups includes "admin"): skip userId filter
```

### 3. CDK Stack (Infrastructure)

Add Cognito resources to the existing `RequirementsFoundryStack` in `infra/lib/requirements-foundry-stack.ts`. New imports: `aws-cdk-lib/aws-cognito`. The Pre Token Generation Lambda and Cognito constructs sit alongside the existing ECS, RDS, and S3 infrastructure.

### 4. Okta Admin Console (Manual Setup)

Okta SAML app configuration is done manually in the Okta admin console, NOT via CDK. Required settings:
- **Single Sign On URL:** `https://requirements-foundry.auth.us-east-1.amazoncognito.com/saml2/idpresponse`
- **Audience URI (SP Entity ID):** `urn:amazon:cognito:sp:<UserPoolId>`
- **Attribute Statements:** `email` -> `user.email`
- **Group Attribute Statements:** `groups` -> filter by relevant Okta groups (e.g., "RequirementsFoundry_Admin", "RequirementsFoundry_Users")

The Okta metadata URL is then provided to CDK's `UserPoolIdentityProviderSaml` construct.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Auth Library | `aws-jwt-verify` (direct) | `next-auth` / `auth.js` with Cognito provider | NextAuth adds session management, CSRF tokens, database adapter -- all redundant when Cognito handles sessions via JWTs. NextAuth's Cognito provider still requires token verification, so it is an unnecessary wrapper. Adds ~150KB bundle, 5+ config files, and a learning curve for what amounts to cookie parsing + JWT verify. |
| Auth Library | `aws-jwt-verify` (direct) | AWS Amplify | Amplify is designed for client-side SPAs. It bundles auth, storage, API, analytics into a monolithic SDK. We need exactly one thing: server-side JWT verification. Amplify cannot run in `proxy.ts`. |
| SAML Flow | Cognito Hosted UI | Custom SAML implementation | SAML requires SP metadata, assertion consumer service, certificate management, XML parsing, and redirect handling. Cognito Hosted UI handles all of this. Building custom SAML is weeks of work with security risk. |
| JWT Library | `aws-jwt-verify` | `jose` | `jose` is the industry standard (48M weekly downloads) and works on Edge runtime. But since Next.js 16 `proxy.ts` runs on Node.js, the Edge compatibility advantage is irrelevant. `aws-jwt-verify` provides Cognito-specific validation (user pool ID, client ID, token_use) with a single constructor call vs. manual JWKS endpoint construction with `jose`. |
| Groups Mapping | Pre Token Generation Lambda | Application-side groups parsing | Lambda trigger writes groups directly into the JWT `cognito:groups` claim, making it available everywhere without extra parsing. Application-side parsing requires reading `custom:groups` and parsing in every auth check -- error-prone and inconsistent. |
| Session Storage | HTTP-only cookies (JWT) | Redis / ElastiCache session store | JWTs are self-contained -- no server-side storage needed. The app already listed ElastiCache as out of scope. Cognito tokens have configurable expiry (1hr access, 30-day refresh by default). Cookie-based sessions work with ECS Fargate's stateless architecture. |
| Route Protection | `proxy.ts` (Next.js 16) | Per-route `getServerSession()` checks | `proxy.ts` runs before every request, providing centralized auth. Per-route checks are easy to forget, leading to unprotected routes. Proxy catches unauthenticated requests before they reach the route handler. |

## Installation

```bash
# App-side: JWT verification for Cognito tokens
npm install aws-jwt-verify

# Infrastructure: No new packages needed -- aws-cdk-lib already includes cognito constructs
```

## Security Considerations

| Concern | Approach |
|---------|----------|
| Token storage | HTTP-only, Secure, SameSite=Lax cookies. Not accessible via JavaScript. |
| CSRF protection | SameSite=Lax cookies prevent cross-origin requests. Authorization code flow uses `state` parameter. |
| Token refresh | Refresh token stored in HTTP-only cookie. Server-side refresh when access token expires. |
| Client secret | Stored in Secrets Manager, injected as ECS secret. Never exposed to browser. |
| SAML assertion | Validated by Cognito (certificate pinning, audience restriction, replay protection). App never touches raw SAML. |

## Sources

- [AWS re:Post: Set Up Okta as SAML IdP in Cognito](https://repost.aws/knowledge-center/cognito-okta-saml-identity-provider) - Official AWS guide for Okta+Cognito SAML
- [AWS CDK UserPoolIdentityProviderSaml](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.UserPoolIdentityProviderSaml.html) - CDK construct API reference
- [aws-jwt-verify on npm](https://www.npmjs.com/package/aws-jwt-verify) - v5.1.1, 460K+ weekly downloads
- [aws-jwt-verify on GitHub](https://github.com/awslabs/aws-jwt-verify) - Official AWS Labs library
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) - proxy.ts replaces middleware.ts, Node.js runtime
- [Cognito Pre Token Generation Lambda](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html) - Groups override documentation
- [AWS CDK Cognito module](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito-readme.html) - UserPool, SAML, OAuth constructs
- [Cognito JWT verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html) - Token verification best practices
- [SAML group assertions in Cognito](https://repost.aws/questions/QUjYKehBfFSL-gWEEviEI3cQ/saml-group-assertions-from-idp-to-aws-cognito) - custom:groups mapping pattern
- [aws-samples/amazon-cognito-example-for-external-idp](https://github.com/aws-samples/amazon-cognito-example-for-external-idp) - Reference CDK implementation
- [Cognito Hosted UI vs Custom UI](https://aws.amazon.com/blogs/security/use-the-hosted-ui-or-create-a-custom-ui-in-amazon-cognito/) - AWS Security Blog decision guide
- [jose on npm](https://www.npmjs.com/package/jose) - v6.2.0, 48M+ weekly downloads (not recommended for this project)
- [aws-jwt-verify Edge runtime issue](https://github.com/awslabs/aws-jwt-verify/issues/108) - Documents incompatibility with Edge runtime (irrelevant for proxy.ts)
- [Node.js Middleware Runtime in Next.js 16](https://medium.com/@mernstackdevbykevin/node-js-middleware-runtime-in-next-js-16-now-stable-what-this-means-for-your-full-stack-apps-d8f1660f4193) - proxy.ts uses Node.js runtime
