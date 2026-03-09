# Pitfalls Research: Cognito + Okta SAML SSO for Existing Next.js App

**Domain:** Adding authentication, multi-user isolation, and admin roles to an existing Next.js 16 app on ECS Fargate
**Researched:** 2026-03-09
**Confidence:** HIGH (verified against AWS docs, Cognito SAML documentation, community reports, codebase analysis)

---

## Critical Pitfalls

### Pitfall 1: SAML Group Claims Cannot Map Directly to cognito:groups

**What goes wrong:**
Okta sends group membership in the SAML assertion (e.g., `<Attribute Name="groups"><AttributeValue>RequirementsFoundry-Admin</AttributeValue></Attribute>`). Developers assume they can map this directly to the `cognito:groups` claim in the JWT token. They cannot. Cognito's `cognito:groups` is a reserved attribute tied to Cognito User Pool Groups -- SAML attributes can only map to custom user pool attributes like `custom:groups`. Without additional processing, the app never sees group membership, and the admin role check silently fails -- every user appears as a regular user.

**Why it happens:**
The Cognito documentation is unclear about this limitation. The attribute mapping UI lets you map SAML attributes to user pool attributes, and developers reasonably expect "groups" to work like any other attribute. The distinction between Cognito User Pool Groups and IdP-asserted groups is non-obvious.

**How to avoid:**
1. Map the Okta SAML `groups` attribute to `custom:groups` in the Cognito SAML IdP attribute mapping
2. Create a PreTokenGeneration Lambda trigger that reads `custom:groups`, parses it, and injects `cognito:groups` into the JWT claims
3. In Okta, configure a Group Filter on the SAML app to only send relevant groups (e.g., groups matching `RequirementsFoundry-*`) to stay under the 2,048-character custom attribute limit
4. Test the full flow end-to-end: Okta login -> SAML assertion -> Cognito attribute mapping -> Lambda trigger -> JWT with groups -> app reads groups

**Warning signs:**
- `custom:groups` appears in the Cognito user profile but `cognito:groups` is empty in the JWT
- Admin users cannot see other users' projects despite being in the Okta admin group
- The ID token decoded in the app shows no groups claim

**Phase to address:**
Infrastructure phase (Cognito User Pool + Lambda trigger setup). This must be working before any app-level admin role logic is implemented.

**Confidence:** HIGH -- verified via [AWS RBAC with external IdP blog](https://aws.amazon.com/blogs/security/role-based-access-control-using-amazon-cognito-and-an-external-identity-provider/), [AWS re:Post SAML group assertions](https://repost.aws/questions/QUjYKehBfFSL-gWEEviEI3cQ/saml-group-assertions-from-idp-to-aws-cognito), [aws-samples PreTokenGeneration example](https://github.com/aws-samples/amazon-cognito-example-for-external-idp)

---

### Pitfall 2: ALB Cognito Authentication Logout Does Not Actually Log Users Out

**What goes wrong:**
When using ALB's built-in Cognito authentication (the `authenticate-cognito` action on the ALB listener rule), the ALB sets `AWSELBAuthSessionCookie` on the user's browser. Calling Cognito's `/logout` endpoint revokes the Cognito session, but the ALB's session cookie remains valid. The ALB automatically uses the refresh token to get new access tokens without involving the user. Result: the user clicks "Sign Out," the Cognito session ends, but the ALB immediately re-authenticates them transparently. They appear to never actually log out.

**Why it happens:**
The ALB manages its own authentication session independently of Cognito. The ALB session cookie has its own expiry (controlled by `AuthenticationRequestExtraParams.SessionTimeout`). The ALB treats Cognito as a token provider, not a session authority. This is by design for availability, but it creates a confusing logout experience.

**How to avoid:**
Two architectural choices:

**Option A (Recommended): App-level Cognito auth, not ALB-level.**
Do NOT use ALB's `authenticate-cognito` action. Instead, handle Cognito OIDC/SAML authentication in the Next.js app itself (via Cognito Hosted UI redirect or a library like `next-auth` with the Cognito provider). This gives full control over session lifecycle, logout, and token management. The ALB stays as a plain HTTP load balancer.

**Option B: ALB auth with workaround.**
If using ALB auth, implement logout by: (1) deleting the `AWSELBAuthSessionCookie` on the client, (2) redirecting to the Cognito `/logout` endpoint, and (3) setting `SessionTimeout` to a short duration (e.g., 3600 seconds). Accept that logout is "best effort" -- the ALB may still re-authenticate if the cookie is not properly cleared.

**Warning signs:**
- Users report clicking "Sign Out" and immediately being logged back in
- Session persists across browser tabs even after logout
- Security review flags that sessions cannot be forcefully terminated

**Phase to address:**
Architecture decision phase (before any auth code is written). This determines whether auth lives at the ALB layer or app layer.

**Confidence:** HIGH -- verified via [AWS blog on ALB + Cognito](https://aws.amazon.com/blogs/containers/securing-amazon-elastic-container-service-applications-using-application-load-balancer-and-amazon-cognito/), [AWS re:Post on ALB logout](https://repost.aws/questions/QUjQAFfXLsRtekzgp5yFw_1g/alb-cognito-oidc-how-to-force-immediate-logout-and-invalidate-awselbauthsessioncookie)

---

### Pitfall 3: Existing Projects Have NULL userId -- Query Filter Silently Excludes Them

**What goes wrong:**
The current schema has `userId String?` on the Project model (nullable). All existing projects have `userId = null`. After adding auth, the natural query becomes `prisma.project.findMany({ where: { userId: currentUser.sub } })`. This correctly returns only the authenticated user's projects -- but it also correctly excludes ALL pre-existing projects because `null !== "user-123"`. Every existing project vanishes from the UI with no error message.

**Why it happens:**
The filter logic is technically correct. The pitfall is that developers test with new projects created after auth is enabled, see them working, and declare success. They never notice the old projects are gone because they were not looking for them. This is a silent data loss scenario -- the data still exists in the database but is inaccessible.

**How to avoid:**
1. **Before enabling auth filters:** Run a data migration to assign existing projects to a specific user (e.g., the default admin `sean.mcinerney@merkle.com`)
2. Write a migration script: `UPDATE "Project" SET "userId" = '<admin-cognito-sub>' WHERE "userId" IS NULL`
3. After backfill, make `userId` required: change from `String?` to `String` in the Prisma schema
4. Add a Prisma migration with a default value or a multi-step migration (add column with default, backfill, remove default, add NOT NULL constraint)
5. Admin users should have an explicit "all projects" query that does not filter by userId

**Warning signs:**
- Project count drops to zero for all users after deploying auth
- Admin cannot see projects created before auth was added
- Dashboard metrics show zero projects despite database having data

**Phase to address:**
Data migration phase -- must run BEFORE enabling userId-based query filtering in the app code. Must happen AFTER Cognito is set up so you know the admin's Cognito `sub` value to use for backfill.

**Confidence:** HIGH -- direct codebase analysis of `prisma/schema.prisma` showing `userId String?`

---

### Pitfall 4: Cognito Does NOT Support IdP-Initiated SAML Flow

**What goes wrong:**
Corporate users expect to click the "Requirements Foundry" tile in their Okta dashboard and land directly in the app. This is IdP-initiated SSO. Cognito User Pools do not support IdP-initiated SAML flow. If users click the Okta tile, they get an error from Cognito ("Invalid SAML response" or "unsolicited response"). The only supported flow is SP-initiated: the user starts at the app's login page, clicks "Sign in with Okta," gets redirected to Okta, authenticates, and returns.

**Why it happens:**
Most enterprise IdPs (Okta, Azure AD, Ping) support both SP-initiated and IdP-initiated flows. Cognito only supports SP-initiated. This is a deliberate AWS design choice documented in the Cognito developer guide, but it catches teams off guard because it breaks corporate user expectations.

**How to avoid:**
1. Accept SP-initiated flow only: build a landing page with a clear "Sign in with Okta" button that redirects to Cognito's `/oauth2/authorize` endpoint
2. In Okta, configure the app as a Bookmark App pointing to your landing page URL (not the SAML app's ACS URL). This way, clicking the tile in Okta goes to your landing page, which initiates the SP flow
3. Communicate to users that they should use the app URL, not the Okta tile, for the initial release
4. Document this limitation for the corporate IT team that manages Okta

**Warning signs:**
- Users report "SAML error" when clicking the Okta tile
- Support tickets about login failures that only happen from Okta dashboard
- Confusion in QA about why the Okta tile does not work

**Phase to address:**
Infrastructure phase (Okta SAML app configuration) and UX phase (landing page design). Configure Okta correctly early to avoid user confusion.

**Confidence:** HIGH -- verified via [AWS re:Post Cognito SSO via Okta](https://repost.aws/questions/QUl5Z9j9WpR3WhAlFXCiDYDg/cognito-support-sso-via-okta), [Okta Help Center on IdP-initiated with Cognito](https://support.okta.com/help/s/question/0D54z0000A3q8sQCQQ/idp-initiated-sso-login-using-amazon-cognito)

---

### Pitfall 5: SAML Callback URL Mismatch Between Cognito, Okta, and ALB

**What goes wrong:**
SAML authentication involves three parties (Okta, Cognito, your app) that must agree on exact URLs. Common mismatches:
- Cognito's ACS URL is `https://<domain>.auth.<region>.amazoncognito.com/saml2/idpresponse` but Okta has the wrong domain prefix
- The app client callback URL uses `http://` but the ALB serves `https://`
- The callback URL includes a trailing slash in one config but not the other
- After deploying, the ALB URL changes (e.g., from the generated ALB DNS name to a custom domain) but Cognito/Okta are not updated

Any of these causes a `redirect_mismatch` error from Cognito, and the user sees a generic error page with no actionable information.

**Why it happens:**
Three systems need synchronized URL configuration. Changes to any one (ALB DNS, Cognito domain, Okta app settings) must be reflected in the other two. During development, URLs change frequently (local dev, staging, production) and it is easy to miss one.

**How to avoid:**
1. Document all three URL configurations in a single reference:
   - Okta SAML App: Single Sign-On URL = Cognito's ACS URL
   - Okta SAML App: Audience URI = Cognito User Pool URN (`urn:amazon:cognito:sp:<pool-id>`)
   - Cognito App Client: Callback URL = your app URL (ALB DNS or custom domain) + callback path
   - Cognito App Client: Sign-out URL = your app's landing page URL
2. Use exact string matching -- no trailing slashes, no http/https mismatch
3. In CDK, derive all URLs from a single source of truth (e.g., the ALB DNS name) to prevent drift
4. Test immediately after any infrastructure change that affects URLs

**Warning signs:**
- `redirect_mismatch` error on the Cognito hosted UI
- "Invalid SAML response" errors in CloudWatch logs for the Cognito User Pool
- Login works in one environment but fails in another

**Phase to address:**
Infrastructure phase (CDK stack defining Cognito, ALB, and outputting URLs for Okta configuration).

**Confidence:** HIGH -- verified via [AWS Cognito federation error responses](https://docs.aws.amazon.com/cognito/latest/developerguide/federation-endpoint-idp-responses.html), [amplify-js redirect_mismatch issue](https://github.com/aws-amplify/amplify-js/issues/5127)

---

### Pitfall 6: Admin Role Check Only at UI Level, Not at Data Access Level

**What goes wrong:**
Developers implement admin visibility by conditionally showing "All Projects" in the UI based on the user's group membership. But the API routes and server actions still filter by `userId` in their Prisma queries. An admin sees "All Projects" in the nav, clicks it, and gets an empty list because the server action only returns their own projects. Or worse: the admin check is only in the frontend, and a regular user can call the API directly and access any project by ID because the server never validates ownership.

**Why it happens:**
It is natural to start with UI changes (show/hide based on role) and forget that the data access layer is the actual security boundary. In Next.js with Server Actions, the boundary between client and server is blurred -- a server action looks like a function call but it is an API endpoint that must enforce authorization independently.

**How to avoid:**
1. Implement authorization at the data access layer (Prisma queries), not the UI layer
2. Create a helper function like `getAuthorizedProjects(userId, isAdmin)` that either filters by userId or returns all
3. Every server action that accesses projects must call this helper -- no direct Prisma queries that assume a userId
4. For individual project access, add an `assertProjectAccess(projectId, userId, isAdmin)` guard that throws if the user is not the owner and not an admin
5. Add server-side tests that verify: (a) regular user cannot access another user's project, (b) admin can access any project

**Warning signs:**
- Admin sees correct UI but empty data
- Regular user can access project by URL-guessing the project ID
- Authorization logic is duplicated between multiple server actions with subtle differences

**Phase to address:**
App code phase -- after Cognito auth is working, implement authorization in the data layer before building admin UI features.

**Confidence:** HIGH -- standard authorization pattern, verified by codebase analysis showing all queries go through server actions

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding admin email instead of using Cognito groups | Avoids PreTokenGeneration Lambda complexity | Cannot add more admins without code change, breaks if email changes | POC only; replace with group-based check before adding second admin |
| Skipping CSRF protection on server actions | Faster development | Cross-site request forgery attacks possible | Never for auth-protected routes; Next.js Server Actions have built-in CSRF via origin check, verify it is enabled |
| Storing Cognito `sub` as userId instead of email | Simpler, guaranteed unique | `sub` is opaque; debugging requires Cognito console lookup to find which user it is | Acceptable -- use `sub` as the foreign key but store email separately for display |
| Using Cognito Hosted UI instead of custom UI | Zero frontend work for login | Cognito Hosted UI is ugly, limited customization, requires redirect away from app | Acceptable for internal POC; replace with custom UI if UX matters |
| Keeping `userId` nullable on Project model | No migration needed | Every query must handle null userId; authorization logic gets complex with null checks | Only during transition; make required after backfill |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cognito + Okta SAML | Configuring Okta to send ALL user groups in the SAML assertion | Filter to only app-relevant groups (e.g., prefix `ReqFoundry-`) to stay under 2,048-char custom attribute limit |
| Cognito Hosted UI | Using the default Cognito domain (`https://xxx.auth.us-east-1.amazoncognito.com`) for production | Acceptable for internal POC; use custom domain for external-facing apps |
| Cognito + ALB | Putting `authenticate-cognito` action on ALL listener rules including health check path | Health check path (`/api/health` or `/`) must be unauthenticated; ALB health checks do not carry cookies |
| Cognito token in Next.js middleware | Verifying JWT in middleware on every request including static assets | Exclude `/_next/static/*`, `/favicon.ico`, and other static paths from middleware matcher |
| Prisma migration + live data | Running `ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL` before backfilling | Backfill ALL rows first, verify zero NULLs, then add NOT NULL constraint in a separate migration |
| Cognito PreTokenGeneration Lambda | Forgetting to configure the Lambda trigger version (V1 vs V2) | Use V2_0 trigger for access token customization; V1_0 only customizes ID tokens |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| JWT verification on every request without caching JWKS | Increased latency on all authenticated requests (50-100ms per request) | Cache the JWKS (JSON Web Key Set) from Cognito; refresh every hour or on key rotation | Noticeable at >50 concurrent users |
| Cognito token refresh blocking page navigation | Pages hang or flash loading state while token refreshes | Use a background refresh strategy; refresh tokens before they expire, not after | When access token lifetime is short (<15 min) |
| N+1 queries when admin loads "all projects" | Admin dashboard slow, database CPU spikes | Paginate admin project list; add database indexes on userId; use cursor-based pagination | When total projects exceed ~200 |
| PreTokenGeneration Lambda cold start on first login | First login after idle period takes 5-10 extra seconds | Use provisioned concurrency if login latency is critical; or accept it for internal POC | After Lambda has been idle for 15+ minutes |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting `X-AMZN-OIDC-*` headers from ALB without verifying the ALB signature | Header spoofing if requests bypass the ALB (e.g., direct access to container on port 3000) | Either verify the ALB's JWT signature on the `X-AMZN-OIDC-DATA` header, OR ensure the ECS security group only allows inbound from the ALB security group (no direct access) |
| Storing Cognito tokens in localStorage | XSS can steal tokens and impersonate users | Use HTTP-only cookies for token storage; Next.js server-side session is preferred |
| Not validating `iss` (issuer) and `aud` (audience) claims in the JWT | Tokens from other Cognito User Pools or apps could be accepted | Always verify `iss` matches your User Pool URL and `aud` matches your App Client ID |
| Admin role check uses client-side cookie/state that user can modify | Any user can grant themselves admin by modifying local state | Admin role must come from the JWT `cognito:groups` claim, verified server-side on every request |
| Leaving the Cognito App Client without a secret (public client) when it should be confidential | Token endpoint can be called without authentication | For server-side apps (not SPAs), use a confidential client with a client secret |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Redirect to Cognito Hosted UI with no context | User sees a generic login page and does not know why they were redirected | Show a landing page first that explains the app and has a clear "Sign in with Okta" CTA |
| After login, redirecting to home page instead of original URL | User navigates to `/projects/abc123`, gets redirected to login, then lands on `/` after auth | Store the original URL in the `state` parameter of the OAuth flow; redirect back after auth |
| No loading state during SSO redirect chain | User sees blank screens during Okta->Cognito->App redirect (can take 2-3 seconds) | Show a "Signing you in..." interstitial page |
| Session expiry with no warning | User fills out a form, submits, gets redirected to login, loses their work | Implement token refresh before expiry; show a warning toast 5 minutes before session expires |
| Admin switching between "my projects" and "all projects" loses context | Admin toggles view and loses scroll position, filters, or current page | Use URL params for view mode (`?view=all`); preserve across navigation |

## "Looks Done But Isn't" Checklist

- [ ] **Login flow:** Works in Chrome but test in Safari/Firefox -- Cognito cookies and redirect handling differ across browsers
- [ ] **Admin role:** Admin can see all projects, but verify admin can also EDIT/DELETE other users' projects if intended -- read access != write access
- [ ] **Token refresh:** Login works, but let the session sit for 1 hour and verify the app still works without requiring re-login
- [ ] **Deep links:** Bookmark a project URL, close browser, reopen -- verify the auth flow returns you to the bookmarked URL, not the home page
- [ ] **Concurrent sessions:** Log in on two browsers/devices -- verify both sessions work independently and logging out of one does not break the other
- [ ] **Data migration:** All pre-existing projects are visible to the admin after auth is enabled -- query the database directly to verify `userId IS NOT NULL` on all rows
- [ ] **S3 file access:** Uploads created before auth still have working download URLs -- S3 presigned URLs should not depend on the user's auth state
- [ ] **Server actions auth:** Call a server action from the browser console without a valid session cookie -- verify it returns 401, not data
- [ ] **Health check:** ALB health check still passes after adding auth middleware -- health check path must be excluded from auth

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| NULL userId projects invisible (P3) | LOW | Run SQL: `UPDATE "Project" SET "userId" = '<admin-sub>' WHERE "userId" IS NULL`; no data loss, just reassignment |
| SAML URL mismatch (P5) | LOW | Update the mismatched URL in Cognito/Okta console; no code change needed; takes effect immediately |
| Groups not in JWT (P1) | MEDIUM | Create and deploy PreTokenGeneration Lambda; requires CDK change + Cognito configuration update; users must re-login to get updated tokens |
| Logout not working (P2) | HIGH | Requires architectural change if ALB auth was chosen; switching from ALB auth to app-level auth is a significant refactor |
| Admin bypass via client-side state (Security) | HIGH | Must audit and fix all server actions to verify groups from JWT; if data was accessed, audit access logs |
| Missing ownership check on server actions (P6) | HIGH | Must add authorization guards to every server action; risk of data exposure until fixed |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1: Groups not in cognito:groups | Infra (Cognito + Lambda) | Decode JWT after login; verify `cognito:groups` contains expected groups |
| P2: ALB logout broken | Architecture decision | Choose app-level auth over ALB auth; verify logout clears session and requires re-auth |
| P3: NULL userId hides projects | Data migration | Query `SELECT COUNT(*) FROM "Project" WHERE "userId" IS NULL` returns 0 after migration |
| P4: IdP-initiated not supported | Infra (Okta config) | Test clicking Okta tile redirects to app landing page, not SAML error |
| P5: URL mismatch | Infra (CDK outputs) | Full login flow works from scratch (incognito browser, no cookies) |
| P6: Admin check only in UI | App code (authorization layer) | Automated test: regular user API call to another user's project returns 403 |
| Token refresh | App code (session management) | Let session idle for access token lifetime; verify app refreshes token transparently |
| Health check auth | Infra (ALB listener rules) | Verify ALB health check returns 200 while app routes require auth |

## Sources

- [AWS: Securing ECS apps with ALB and Cognito](https://aws.amazon.com/blogs/containers/securing-amazon-elastic-container-service-applications-using-application-load-balancer-and-amazon-cognito/)
- [AWS: Role-based access control with Cognito and external IdP](https://aws.amazon.com/blogs/security/role-based-access-control-using-amazon-cognito-and-an-external-identity-provider/)
- [AWS re:Post: SAML group assertions from IdP to Cognito](https://repost.aws/questions/QUjYKehBfFSL-gWEEviEI3cQ/saml-group-assertions-from-idp-to-aws-cognito)
- [AWS re:Post: ALB + Cognito OIDC logout](https://repost.aws/questions/QUjQAFfXLsRtekzgp5yFw_1g/alb-cognito-oidc-how-to-force-immediate-logout-and-invalidate-awselbauthsessioncookie)
- [AWS re:Post: Cognito SSO via Okta](https://repost.aws/questions/QUl5Z9j9WpR3WhAlFXCiDYDg/cognito-support-sso-via-okta)
- [AWS: Set up Okta as SAML IdP in Cognito](https://repost.aws/knowledge-center/cognito-okta-saml-identity-provider)
- [AWS: Cognito federation error responses](https://docs.aws.amazon.com/cognito/latest/developerguide/federation-endpoint-idp-responses.html)
- [AWS: PreTokenGeneration Lambda trigger](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html)
- [AWS: Cognito attribute mapping](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-specifying-attribute-mapping.html)
- [aws-samples: Cognito external IdP example (PreTokenGeneration)](https://github.com/aws-samples/amazon-cognito-example-for-external-idp)
- [Medium: SAML IdP group mappings with Cognito](https://medium.com/geekculture/using-saml-idp-group-mappings-with-aws-cognito-34e297cf1aa8)
- [tecRacer: Fargate container app with Cognito auth](https://www.tecracer.com/blog/2020/03/building-a-fargate-based-container-app-with-cognito-authentication.html)
- [Cognito Hosted UI with ALB](https://www.kdgregory.com/index.php?page=aws.albCognito)
- [Okta Help Center: IdP-initiated SSO with Cognito](https://support.okta.com/help/s/question/0D54z0000A3q8sQCQQ/idp-initiated-sso-login-using-amazon-cognito)

---
*Pitfalls research for: Cognito + Okta SAML SSO on existing Next.js ECS Fargate app*
*Researched: 2026-03-09*
