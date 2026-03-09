# Project Research Summary

**Project:** Requirements Foundry - Authentication & Multi-User (v3.0)
**Domain:** SSO authentication, per-user data isolation, and admin role management for an existing internal Next.js application on ECS Fargate
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

Requirements Foundry is an existing internal Next.js 16 application running on ECS Fargate with RDS PostgreSQL, currently operating as a single-user tool. The v3.0 milestone adds Okta SAML SSO authentication via AWS Cognito, per-user project isolation, and Okta-group-driven admin roles. Research across stack, features, architecture, and pitfalls converges on a clear approach: use Cognito User Pool as the SAML service provider with Okta as the identity provider, handle the OAuth authorization code flow server-side, store tokens in HTTP-only cookies, verify JWTs in Next.js 16's `proxy.ts`, and filter all Prisma queries by `userId` with an admin bypass. The only new npm dependency is `aws-jwt-verify`; all CDK constructs come from the existing `aws-cdk-lib`.

The recommended architecture avoids ALB-level Cognito authentication (which has a well-documented logout problem) in favor of app-level auth. It avoids NextAuth, Amplify, and other abstraction layers that add complexity without benefit for this use case. The Cognito Hosted UI handles SAML assertion exchange (the only viable option for SAML), but users never see it because the app redirects directly to Okta via the `identity_provider=Okta` parameter. The existing `Project.userId` nullable column provides a natural migration path -- backfill existing projects to the admin user, then make the column required. No User table is needed; user display info comes from JWT claims and the Cognito `sub` serves as the foreign key.

The primary risks are: (1) SAML group claims cannot map directly to `cognito:groups` and require a PreTokenGeneration Lambda trigger, (2) the Okta-Cognito setup has a chicken-and-egg dependency requiring two CDK deployments with manual Okta configuration in between, (3) existing projects with NULL `userId` will silently vanish if query filters are added before data migration, and (4) Cognito does not support IdP-initiated SAML flow, so the Okta dashboard tile must be configured as a bookmark. All four risks have known, well-documented solutions.

## Key Findings

### Recommended Stack

The stack addition is minimal. Only one new npm package (`aws-jwt-verify` v5.1.1) is needed on the app side. All Cognito CDK constructs are already available in `aws-cdk-lib`. The research explicitly rejected NextAuth/Auth.js (unnecessary abstraction over what Cognito already provides), Amplify (heavyweight 200KB+ client-side SDK incompatible with server-side patterns), `jose` (Edge runtime compatibility irrelevant since `proxy.ts` runs on Node.js), and `amazon-cognito-identity-js` (legacy, designed for direct auth not federated SAML).

**Core technologies:**
- `aws-jwt-verify` v5.1.1: Server-side JWT verification -- purpose-built for Cognito, handles JWKS caching and key rotation automatically, 460K+ weekly npm downloads
- `aws-cdk-lib/aws-cognito`: UserPool, SAML IdP, AppClient, Domain constructs -- no new CDK packages needed, just new imports from existing dependency
- PreTokenGeneration Lambda (Node.js 20): Maps Okta `custom:groups` attribute to `cognito:groups` JWT claim -- required because Cognito cannot natively map SAML group attributes to its reserved groups claim

### Expected Features

**Must have (table stakes):**
- SSO login via Okta with direct IdP redirect (bypass Cognito Hosted UI appearance)
- Protected routes via `proxy.ts` JWT verification with redirect to landing page
- Per-user project isolation (enforce `Project.userId` on all Prisma queries)
- Admin role derived from Okta group membership (no local role management needed)
- Session persistence via HTTP-only cookies with configurable token expiry
- Logout that clears both Cognito session and browser cookies
- User identity display (name/email) in app header
- Migration of existing projects to default admin user

**Should have (differentiators):**
- Automatic user provisioning on first Okta login (no invite flow)
- Admin project management with view/reassign capability
- Graceful session expiry handling (silent refresh or friendly re-auth modal)

**Defer (v2+):**
- Project sharing between users
- Fine-grained permissions (viewer/editor roles)
- Audit logging for admin actions
- User activity dashboard

### Architecture Approach

The architecture follows a server-side authorization code grant pattern. The browser redirects to Cognito (which redirects to Okta), receives an authorization code on callback, and the server exchanges it for tokens stored in HTTP-only cookies. `proxy.ts` verifies JWTs on every request using `aws-jwt-verify` (one verification per request, not per server action). Server actions use `jwt.decode()` (not `jwt.verify()`) since the proxy already validated the token. A centralized `getSession()` helper extracts user identity, and a `getProjectFilter()` helper returns the appropriate Prisma `where` clause based on admin status. No User table is needed -- `userId` (Cognito `sub`) is stored as a foreign key on Project, and display info comes from JWT claims. The three-phase database migration (deploy with nullable, backfill, make required) avoids downtime.

**Major components:**
1. Cognito User Pool + SAML IdP + PreTokenGeneration Lambda (CDK) -- handles SAML assertion exchange, token issuance, group mapping
2. `proxy.ts` -- centralized JWT verification, route protection, user identity extraction via request headers
3. `/api/auth/callback` + `/api/auth/logout` routes -- token exchange (code-for-tokens) and session cleanup
4. `lib/auth.ts` -- `getSession()` and `getProjectFilter()` helpers consumed by all server actions
5. Modified server actions (18 files) -- add `userId` filtering to all project-scoped queries with admin bypass
6. Landing page (`/login`) -- public entry point with "Sign in with Okta" button

### Critical Pitfalls

1. **SAML groups cannot map to cognito:groups** -- Requires a PreTokenGeneration Lambda trigger to read `custom:groups` and inject into `cognito:groups`. Without this, admin role detection silently fails. Must be working before any app-level admin logic.

2. **ALB Cognito auth has broken logout** -- The ALB's `AWSELBAuthSessionCookie` persists independently of Cognito sessions, causing users to be silently re-authenticated after logout. Use app-level auth (not ALB `authenticate-cognito` action). This is an architecture decision, not a bug to fix later.

3. **NULL userId hides existing projects** -- All pre-existing projects have `userId = null`. Adding `where: { userId }` filters silently excludes them. Must backfill userId on all existing projects BEFORE enabling query filters.

4. **Cognito does not support IdP-initiated SAML** -- Users clicking the Okta dashboard tile get a SAML error. Configure the Okta app as a Bookmark pointing to the app landing page to initiate SP flow instead.

5. **Authorization at UI level only** -- Admin visibility implemented only in the frontend while server actions still filter by userId. Authorization must be enforced at the data access layer with `getProjectFilter()`, not in React components.

## Implications for Roadmap

Based on research, the work naturally splits into four phases following a strict dependency chain.

### Phase 1: Cognito Infrastructure

**Rationale:** Everything depends on Cognito existing first. The Okta-Cognito setup has a chicken-and-egg dependency requiring two CDK deployments with manual Okta admin configuration in between. This is the critical path blocker.
**Delivers:** Working Cognito User Pool with Okta SAML federation, PreTokenGeneration Lambda for group mapping, Cognito config values as ECS environment variables, client secret in Secrets Manager.
**Addresses:** Cognito + Okta SAML setup, Okta group-to-JWT mapping, CDK infrastructure additions.
**Avoids:** P1 (groups not in JWT -- Lambda trigger built here), P4 (IdP-initiated not supported -- Okta configured as bookmark), P5 (URL mismatch -- all URLs derived from CDK outputs).

### Phase 2: Auth Flow (Login, Session, Logout)

**Rationale:** With Cognito infrastructure in place, the app needs the end-to-end authentication flow before data isolation work can begin. Protected routes depend on session management existing.
**Delivers:** Landing page with SSO button, `/api/auth/callback` token exchange route, `/api/auth/logout`, `proxy.ts` JWT verification, `lib/auth.ts` session helpers, HTTP-only cookie management.
**Addresses:** SSO login, protected routes, session persistence, logout, user identity display, direct IdP redirect.
**Avoids:** P2 (ALB logout broken -- uses app-level auth), security mistakes (HTTP-only cookies, server-side token exchange, issuer/audience validation).

### Phase 3: Per-User Data Isolation

**Rationale:** Auth flow must work before data isolation can be enforced because queries need the authenticated user's identity. Data migration must happen before query filters are enabled to avoid hiding existing projects.
**Delivers:** Data migration (backfill existing projects to admin user), `userId` made required on Project model, `getProjectFilter()` applied to all 18 server action files, ownership verification on single-project operations.
**Addresses:** Per-user project isolation, existing data migration, admin view-all-projects bypass.
**Avoids:** P3 (NULL userId hides projects -- migration runs first), P6 (admin check only in UI -- authorization enforced at data access layer).

### Phase 4: Admin Features and Polish

**Rationale:** Admin features depend on both working auth (Phase 2) and working data isolation (Phase 3). UI polish is best done after core functionality is stable and testable.
**Delivers:** Admin role detection from JWT groups claim, admin project list showing all projects with owner info, user menu in AppShell with display name and logout button, graceful session expiry handling.
**Addresses:** Admin role from Okta groups, admin project management, user identity in header, session expiry UX.
**Avoids:** P6 (admin check only in UI -- server-side enforcement already in place from Phase 3).

### Phase Ordering Rationale

- Phases follow a strict dependency chain: infrastructure (Cognito must exist) -> auth flow (sessions must work) -> data isolation (user identity must be known) -> admin features (isolation must be enforced)
- The Okta-Cognito chicken-and-egg problem (two CDK deploys with manual Okta config in between) is the critical path and must be resolved first
- App-side auth code (Phases 2-3) can be developed locally in parallel with Phase 1 using mock JWT tokens, but cannot be deployed until Phase 1 is complete
- Data migration is placed in Phase 3 (not Phase 1) because the admin user's Cognito `sub` is not known until after Cognito is deployed and the admin logs in for the first time
- All 18 server action files need modification in Phase 3 -- this is high surface area but mechanically simple (add `getProjectFilter()` call)

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Okta admin console configuration is manual and involves coordination with IT. Exact SAML attribute statement names and group filter syntax depend on the Okta org. The client secret retrieval from Cognito (post-deploy script vs CDK Custom Resource) needs a decision.
- **Phase 3:** Three-phase migration sequence (backfill, make non-nullable, remove null handling) requires careful Prisma migration authoring. Test against a database snapshot before production.

Phases with standard patterns (skip research-phase):
- **Phase 2:** OAuth authorization code grant with HTTP-only cookies is thoroughly documented. `aws-jwt-verify` handles Cognito-specific validation with a single constructor call. Complete code samples provided in STACK.md and ARCHITECTURE.md.
- **Phase 4:** Admin role checks, conditional UI rendering, and session management follow standard patterns with no novel technical challenges.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only one new dependency (`aws-jwt-verify`). Official AWS library, 460K+ weekly downloads. All alternatives evaluated and rejected with clear rationale. Version pinned. |
| Features | HIGH | Feature set well-scoped with clear table-stakes vs. differentiator separation. Anti-features list prevents scope creep (no local passwords, no ACLs, no RLS, no local user CRUD). |
| Architecture | HIGH | Server-side auth code grant with HTTP-only cookies is the canonical pattern for server-rendered Next.js on ECS. CDK code samples provided and verified against AWS CDK v2 docs. |
| Pitfalls | HIGH | Six critical pitfalls identified from official AWS docs, re:Post, and community reports. Each has documented prevention strategy, warning signs, and recovery steps. |

**Overall confidence:** HIGH

### Gaps to Address

- **Okta admin access:** The Okta SAML app creation requires Okta admin privileges. Confirm who has access and plan the handoff before starting Phase 1.
- **Cognito client secret retrieval:** CDK does not directly expose the UserPoolClient secret as a construct output. A post-deploy script (`aws cognito-idp describe-user-pool-client`) or CDK Custom Resource is needed to store it in Secrets Manager. Decide during Phase 1 planning.
- **Token refresh strategy:** Research recommends redirect-to-login for POC (Okta SSO silently re-authenticates within Okta session window). Silent refresh using the refresh token is deferred. Evaluate if session interruption becomes a user complaint.
- **PreTokenGeneration Lambda trigger version:** V1_0 is correct for this use case (ID token group override). V2_0 is only needed for access token scope customization, which is not required here.
- **Next.js 16 proxy.ts vs middleware.ts:** STACK.md correctly identifies `proxy.ts` as the Next.js 16 replacement for `middleware.ts`. ARCHITECTURE.md references `middleware.ts` in some code samples (written for broader compatibility). Implementation should use `proxy.ts` exclusively.

## Sources

### Primary (HIGH confidence)
- [AWS re:Post: Set Up Okta as SAML IdP in Cognito](https://repost.aws/knowledge-center/cognito-okta-saml-identity-provider)
- [AWS CDK Cognito Module](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito-readme.html)
- [aws-jwt-verify on GitHub](https://github.com/awslabs/aws-jwt-verify) (v5.1.1)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) (proxy.ts replaces middleware.ts)
- [AWS: Role-based access control with Cognito and external IdP](https://aws.amazon.com/blogs/security/role-based-access-control-using-amazon-cognito-and-an-external-identity-provider/)
- [aws-samples/amazon-cognito-example-for-external-idp](https://github.com/aws-samples/amazon-cognito-example-for-external-idp)
- [Cognito PreTokenGeneration Lambda](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html)
- [AWS: Securing ECS apps with ALB and Cognito](https://aws.amazon.com/blogs/containers/securing-amazon-elastic-container-service-applications-using-application-load-balancer-and-amazon-cognito/)
- [Cognito JWT verification best practices](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)

### Secondary (MEDIUM confidence)
- [Medium: SAML IdP Group Mappings with Cognito](https://medium.com/geekculture/using-saml-idp-group-mappings-with-aws-cognito-34e297cf1aa8)
- [Okta Dev Forum: SAML attributes and Cognito](https://devforum.okta.com/t/okta-saml-attributes-cognito-and-acces-tokens/22085)
- [ZenStack: Multi-Tenancy with Prisma](https://zenstack.dev/blog/multi-tenant)
- [tecRacer: Fargate container app with Cognito](https://www.tecracer.com/blog/2020/03/building-a-fargate-based-container-app-with-cognito-authentication.html)
- [Okta Help Center: IdP-initiated SSO with Cognito](https://support.okta.com/help/s/question/0D54z0000A3q8sQCQQ/idp-initiated-sso-login-using-amazon-cognito)

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
