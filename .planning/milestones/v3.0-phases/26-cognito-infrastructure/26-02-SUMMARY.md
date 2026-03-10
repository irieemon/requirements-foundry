---
phase: 26-cognito-infrastructure
plan: 02
subsystem: infra
tags: [cognito, saml, okta, cdk, aws, ecs, secrets-manager, lambda]

# Dependency graph
requires:
  - phase: 26-cognito-infrastructure/01
    provides: PreTokenGeneration Lambda handler for Cognito V2_0 trigger
  - phase: 25-ai-capabilities
    provides: Existing CDK stack with VPC, ALB, ECS, RDS, S3
provides:
  - Cognito UserPool with Okta SAML federation
  - Cognito domain for Hosted UI access
  - UserPoolClient with authorization code grant flow
  - PreTokenGeneration Lambda trigger wired to UserPool
  - Client secret extraction via AwsCustomResource and Secrets Manager storage
  - ECS container wired with Cognito credentials (env vars + secrets)
  - CDK outputs for Okta SAML configuration (Entity ID, ACS URL, Hosted UI URL)
affects: [27-auth-flow, 28-rbac, 29-admin]

# Tech tracking
tech-stack:
  added: [aws-cognito, aws-custom-resources]
  patterns: [AwsCustomResource-for-secret-extraction, SAML-federation-via-CDK-context, ECS-secret-injection]

key-files:
  created: []
  modified:
    - infra/lib/requirements-foundry-stack.ts
    - infra/test/requirements-foundry-stack.test.ts

key-decisions:
  - "Used AwsCustomResource to extract Cognito client secret at deploy time rather than post-deploy script"
  - "Okta metadata URL passed via CDK context for environment-specific SAML configuration"
  - "Cognito domain prefix configurable via CDK context with prod default"

patterns-established:
  - "AwsCustomResource pattern: describeUserPoolClient to extract generated secrets"
  - "SAML IdP configuration: metadata URL via CDK context, attribute mapping for email and groups"
  - "ECS secret injection: Secrets Manager secret with grantRead to task execution role"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03]

# Metrics
duration: 1min
completed: 2026-03-10
---

# Phase 26 Plan 02: CDK Cognito Infrastructure Summary

**Cognito UserPool with Okta SAML federation, AwsCustomResource client secret extraction, and ECS credential injection via CDK**

## Performance

- **Duration:** 1 min (continuation from checkpoint approval)
- **Started:** 2026-03-10T04:20:00Z
- **Completed:** 2026-03-10T04:21:00Z
- **Tasks:** 2 (1 TDD auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments
- Cognito UserPool deployed with selfSignUpEnabled=false, email sign-in, and custom:groups attribute
- Okta SAML identity provider configured with metadata URL from CDK context and attribute mapping
- UserPoolClient with authorization code grant, openid/email/profile scopes, and ALB callback URLs
- PreTokenGeneration Lambda wired as V2_0 trigger on the UserPool
- Client secret extracted via AwsCustomResource and stored in Secrets Manager
- ECS container receives COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_DOMAIN, COGNITO_REDIRECT_URI as env vars and COGNITO_CLIENT_SECRET from Secrets Manager
- CDK outputs provide Entity ID, ACS URL, Hosted UI URL, and Client ID for Okta configuration
- All CDK assertion tests pass including Cognito-specific tests

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing CDK assertion tests for Cognito infrastructure** - `2f61d07` (test)
2. **Task 1 (GREEN): Implement Cognito resources in CDK stack** - `01d93cf` (feat)
3. **Task 2: Verify CDK stack synthesizes correctly** - checkpoint:human-verify (approved, no commit needed)

_Note: TDD task had RED and GREEN commits. Checkpoint task required no code changes._

## Files Created/Modified
- `infra/lib/requirements-foundry-stack.ts` - Added Cognito UserPool, SAML IdP, domain, client, Lambda trigger, AwsCustomResource, Secrets Manager secret, ECS wiring, and 5 CDK outputs
- `infra/test/requirements-foundry-stack.test.ts` - Added Cognito Infrastructure test suite with 13 CDK assertion tests

## Decisions Made
- Used AwsCustomResource to extract Cognito client secret at deploy time (avoids post-deploy scripts)
- Okta metadata URL passed via CDK context for environment-specific SAML configuration
- Cognito domain prefix configurable via CDK context with 'requirements-foundry-prod' default

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration.** The plan's `user_setup` section documents Okta SAML app configuration:
- Create SAML 2.0 app in Okta admin console
- Configure attribute statements (email, firstName, lastName) and group attribute
- Get metadata URL and pass as CDK context: `-c oktaMetadataUrl=https://...`
- After CDK deploy, update Okta app with real ACS URL and Entity ID from CDK outputs

## Issues Encountered
None

## Next Phase Readiness
- All Cognito infrastructure is defined in CDK and ready for deployment
- Phase 27 (auth flow) can implement the authentication endpoints using the Cognito credentials injected into ECS
- Okta SAML app configuration is an external dependency that must be completed before SSO testing
- CDK outputs will provide the exact values needed for Okta app configuration after deployment

## Self-Check: PASSED

- FOUND: infra/lib/requirements-foundry-stack.ts
- FOUND: infra/test/requirements-foundry-stack.test.ts
- FOUND: 26-02-SUMMARY.md
- FOUND: commit 2f61d07
- FOUND: commit 01d93cf

---
*Phase: 26-cognito-infrastructure*
*Completed: 2026-03-10*
