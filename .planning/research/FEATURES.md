# Feature Research: Authentication & Multi-User

**Domain:** SSO authentication, per-user data isolation, and admin role management for an existing internal Next.js application
**Researched:** 2026-03-09
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| SSO login via Okta | Corporate users expect single click into the app using their existing Okta credentials. No separate username/password. | MEDIUM | Cognito User Pool with Okta as SAML 2.0 IdP. Cognito handles the SAML assertion exchange. User redirects to Okta, authenticates, returns with tokens. |
| Public landing page with "Sign in with Okta" button | Users need an unauthenticated entry point that clearly communicates how to access the app. | LOW | Simple page with branding and a single CTA button. The button triggers redirect to the Cognito authorize endpoint with `identity_provider=Okta`. |
| Protected routes (redirect to login) | Unauthenticated users hitting any app route must be redirected to login. No partial access. | MEDIUM | Next.js middleware checks for valid session token on every request. Matcher config excludes `/`, `/api/auth/*`, and static assets. Redirect to `/` (landing page) if no valid session. |
| Per-user project isolation | Each user sees only their own projects. Clicking around the app should never reveal another user's data. | MEDIUM | The `Project.userId` field already exists (nullable). Migration: make it required, populate existing projects with the default admin user. All Prisma queries add `where: { userId }` filter. |
| Session persistence across page reloads | Users expect to stay logged in after refreshing or closing/reopening the browser tab within a reasonable window. | LOW | Cognito issues access tokens (1hr default) and refresh tokens (30 days default). Store tokens in httpOnly cookies. Refresh silently before expiry. |
| Logout that actually logs out | Clicking "Sign Out" must clear the session AND the Cognito/Okta session so the user is truly logged out, not auto-re-authenticated. | LOW | Call Cognito's `/logout` endpoint with redirect, which clears the Cognito session. For full Okta logout, redirect to Okta's SLO endpoint. Store logout redirect URI in Cognito app client config. |
| User identity display | Show who is logged in (name/email) in the app header. Users need to confirm they are in the right account. | LOW | Extract `email` and `name` from the Cognito ID token claims. Display in the existing sidebar/header. |
| Admin: view all projects | Admin users need to see every project across all users for oversight, troubleshooting, and governance. | LOW | Admin role bypasses the `userId` filter. Query all projects when `role === 'admin'`. Show the project owner's email alongside each project for context. |

### Differentiators (Competitive Advantage)

Features that set the product apart from a basic auth implementation. Not required for launch, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Admin role derived from Okta group membership | No local role management UI needed. Okta admins manage who is an admin via Okta group assignment. Zero operational overhead. | MEDIUM | Okta sends group membership as a SAML attribute. Map it to a Cognito custom attribute (`custom:groups`). App reads this claim from the ID token to determine admin status. The `cognito:groups` claim does NOT contain Okta groups -- must use the custom attribute. |
| Automatic user provisioning on first login | No user invite flow needed. Any Merkle employee assigned the Okta app automatically gets an account on first login. | LOW | Cognito auto-creates a user profile on first SAML federation. The app creates a local user record (if needed) on first authenticated request. No manual provisioning step. |
| Admin project management (view/reassign) | Admin can see which user owns which project and potentially reassign orphaned projects. | MEDIUM | Useful when employees leave. Admin UI shows all projects with owner info. Reassignment updates `Project.userId`. |
| Direct IdP redirect (skip Cognito hosted UI) | Users go straight to Okta login instead of seeing the generic Cognito hosted UI. Feels like a native SSO experience. | LOW | Use the Cognito `/oauth2/authorize` endpoint with `identity_provider=Okta` parameter to bypass the hosted UI entirely. The user never sees a Cognito-branded page. |
| Graceful session expiry handling | Instead of a jarring error when the token expires, silently refresh or show a "Session expired, click to re-authenticate" modal. | LOW | Check token expiry on each request in middleware. If access token expired but refresh token valid, refresh silently. If refresh token expired, redirect to login with a `?expired=true` query param for a friendly message on the landing page. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in this context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Local username/password registration | "What if someone doesn't have Okta?" | This is an internal corporate tool. Everyone has Okta. Local passwords create a security liability, bypass SSO compliance, and add password reset/storage complexity. | Only Okta SAML. If someone needs access, they get assigned the Okta app by IT. |
| Granular per-resource permissions (ACLs) | "Users should control who sees each project" | Massive complexity for a tool where projects are personal workspaces. ACLs need a sharing UI, permission checks on every query, invitation flows, and conflict resolution. | Simple model: users own projects, admins see all. If sharing is ever needed, add it as a separate milestone. |
| Custom role management UI | "Admins should be able to assign roles in the app" | Duplicates Okta group management. Creates sync issues between Okta and the app. Who is the source of truth? | Roles come from Okta groups exclusively. Admin adds/removes users from the Okta group. Single source of truth. |
| Multi-factor authentication in the app | "Add MFA for security" | MFA is Okta's responsibility. Okta already enforces org-wide MFA policies. Adding MFA at the app level is redundant and confusing. | Rely on Okta's MFA policies. The app trusts the SAML assertion. |
| PostgreSQL Row-Level Security (RLS) | "Database-level isolation is more secure" | RLS with Prisma is awkward. Prisma does not natively support `SET app.current_tenant`. Requires raw SQL for session variables per transaction. Adds significant complexity to every query path for marginal security gain in an internal tool. | Application-level filtering via a helper function that injects `userId` into every query. Simpler, testable, sufficient for internal use. |
| Real-time session sync across tabs | "If I log out in one tab, all tabs should log out" | Requires BroadcastChannel API or localStorage event listeners. Edge cases with stale tabs. Over-engineering for an internal tool. | Each tab checks its own session on next request. Slightly stale but simple and reliable. |
| User management CRUD in the app | "Admins should manage users within the app" | Cognito/Okta IS the user directory. Building local user CRUD duplicates it and creates sync nightmares. | Users are auto-provisioned on first login. Admin sees users via the Okta admin console. The app only stores the userId reference on projects. |

## Feature Dependencies

```
[Cognito User Pool + Okta SAML Config]
    |
    +--requires--> [Landing Page with SSO Button]
    |
    +--requires--> [Token Handling (cookies, refresh)]
                       |
                       +--requires--> [Next.js Auth Middleware (protected routes)]
                       |                   |
                       |                   +--requires--> [Per-User Project Isolation]
                       |                   |                   |
                       |                   |                   +--requires--> [Admin Override (view all)]
                       |                   |
                       |                   +--requires--> [User Identity Display in Header]
                       |
                       +--requires--> [Logout Flow]

[Okta Group Attribute Mapping]
    +--requires--> [Admin Role Detection from Token]
                       +--requires--> [Admin Override (view all)]
                       +--requires--> [Admin Project Management]
```

### Dependency Notes

- **Auth Middleware requires Token Handling:** Middleware must be able to validate tokens before it can protect routes. Token storage (cookies) and validation logic must exist first.
- **Per-User Isolation requires Auth Middleware:** You cannot filter by `userId` until you know who the user is. Auth middleware extracts the user identity from the token.
- **Admin Override requires both Per-User Isolation AND Okta Group Mapping:** Admin needs the role claim from Okta AND the isolation logic must have an admin bypass path.
- **Landing Page requires Cognito User Pool:** The SSO button URL includes the Cognito domain, client ID, and redirect URI -- all from the User Pool configuration.
- **Logout requires Token Handling:** Must know where tokens are stored to clear them, and must know the Cognito logout endpoint URL.

## MVP Definition

### Launch With (v3.0)

Everything needed for the app to be usable by multiple authenticated users.

- [ ] Cognito User Pool with Okta SAML IdP -- the authentication backbone
- [ ] Public landing page with "Sign in with Okta" button -- entry point
- [ ] Direct IdP redirect (bypass Cognito hosted UI) -- seamless UX
- [ ] Token handling in httpOnly cookies with silent refresh -- session persistence
- [ ] Next.js middleware protecting all app routes -- security gate
- [ ] Per-user project isolation (enforce `Project.userId`) -- data separation
- [ ] Admin role from Okta group claim (`custom:okta_groups`) -- role detection
- [ ] Admin bypass to view all projects -- oversight capability
- [ ] User identity display in header/sidebar -- "who am I"
- [ ] Logout flow (clear Cognito session + cookies) -- clean exit
- [ ] Migration: populate existing projects with default admin userId -- data continuity

### Add After Validation (v3.x)

Features to add once core auth is working and stable.

- [ ] Admin project reassignment UI -- triggered when an employee leaves and projects need a new owner
- [ ] Session expiry modal (friendly UX) -- triggered when users report confusion about being redirected to login
- [ ] Audit log for admin actions -- triggered when compliance or governance asks "who did what"

### Future Consideration (v4+)

Features to defer until there is clear demand.

- [ ] Project sharing between users -- only if collaboration becomes a real need
- [ ] Fine-grained permissions (viewer/editor roles) -- only if sharing is built
- [ ] User activity dashboard for admins -- only if admin oversight needs grow beyond "view all projects"

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Cognito + Okta SAML setup | HIGH | MEDIUM | P1 |
| Landing page with SSO button | HIGH | LOW | P1 |
| Direct IdP redirect (bypass hosted UI) | MEDIUM | LOW | P1 |
| Next.js auth middleware | HIGH | MEDIUM | P1 |
| Token handling (cookies, refresh) | HIGH | MEDIUM | P1 |
| Per-user project isolation | HIGH | MEDIUM | P1 |
| Okta group to admin role mapping | HIGH | MEDIUM | P1 |
| Admin view all projects | HIGH | LOW | P1 |
| User identity in header | MEDIUM | LOW | P1 |
| Logout flow | HIGH | LOW | P1 |
| Existing data migration | HIGH | LOW | P1 |
| Admin project reassignment | MEDIUM | MEDIUM | P2 |
| Session expiry UX | LOW | LOW | P2 |
| Audit logging | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (v3.0)
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Implementation Notes

### Cognito + Okta SAML Flow (How It Works)

1. User clicks "Sign in with Okta" on landing page
2. Browser redirects to Cognito's `/oauth2/authorize` endpoint with `identity_provider=Okta`
3. Cognito redirects to Okta's SAML sign-on URL
4. User authenticates with Okta (Okta handles MFA if configured)
5. Okta posts a SAML assertion back to Cognito's `/saml2/idpresponse` endpoint
6. Cognito validates the assertion, creates/updates the user profile
7. Cognito redirects back to the app's callback URL with an authorization code
8. App exchanges the code for tokens (ID token, access token, refresh token)
9. App stores tokens in httpOnly cookies and redirects to the dashboard

### Per-User Isolation Strategy

The `Project` model already has `userId String?` with an index. The migration strategy:

1. Add a Prisma migration making `userId` required (with a default value for existing rows)
2. Create a helper function like `getSessionUser()` that extracts userId and role from the token
3. Create a data access layer (e.g., `getProjectsForUser(userId, isAdmin)`) that wraps queries
4. All project queries go through this layer, which adds `where: { userId }` for regular users
5. Admin users skip the userId filter (or optionally filter by a selected user)
6. Server actions call `getSessionUser()` before any database operation

### Admin Role Detection

Okta groups flow through SAML as an attribute statement. The critical mapping chain:

1. **In Okta:** Configure the SAML app to send a `groups` attribute containing the user's Okta group names
2. **In Cognito:** Map the SAML `groups` attribute to a custom attribute `custom:okta_groups`
3. **In the app:** Read `custom:okta_groups` from the ID token. Check if it contains the admin group name (e.g., `RequirementsFoundry-Admins`)
4. **Important:** Do NOT rely on `cognito:groups` -- it only contains Cognito-side groups, not Okta groups. This is a known limitation that catches many teams.

### Existing Schema Compatibility

The schema is well-prepared for auth. Key observations:

- `Project.userId` already exists as nullable with an index -- just needs to become required
- No other models need a `userId` -- all data chains through `Project` (Project -> Upload -> Card, Project -> Epic -> Story -> Subtask)
- The cascade delete structure means isolating at the Project level isolates everything
- MSS taxonomy tables (`MssServiceLine`, `MssServiceArea`, `MssActivity`) are global (shared across users) -- no isolation needed
- `PromptTemplate` is also global -- no isolation needed
- The `Run` model links to `Project`, so run isolation is automatic via project isolation

### CDK Infrastructure Addition

The Cognito User Pool and Okta SAML IdP configuration should be added to the existing CDK stack (already used for ECS, RDS, S3, etc.). Key CDK constructs:

- `cognito.UserPool` -- the user pool
- `cognito.UserPoolIdentityProviderSaml` -- Okta as SAML IdP
- `cognito.UserPoolClient` -- app client with OAuth settings
- `cognito.UserPoolDomain` -- Cognito domain for the hosted UI endpoints (needed even when bypassing hosted UI)

## Sources

- [AWS re:Post: Set Up Okta as a SAML IdP in Cognito](https://repost.aws/knowledge-center/cognito-okta-saml-identity-provider) -- HIGH confidence
- [AWS Docs: Using SAML IdPs with a User Pool](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-saml-idp.html) -- HIGH confidence
- [AWS Docs: Add a SAML 2.0 IdP Tutorial](https://docs.aws.amazon.com/cognito/latest/developerguide/tutorial-create-user-pool-saml-idp.html) -- HIGH confidence
- [AWS Blog: Hosted UI vs Custom UI in Cognito](https://aws.amazon.com/blogs/security/use-the-hosted-ui-or-create-a-custom-ui-in-amazon-cognito/) -- HIGH confidence
- [Medium: Using SAML IdP Group Mappings with AWS Cognito](https://medium.com/geekculture/using-saml-idp-group-mappings-with-aws-cognito-34e297cf1aa8) -- MEDIUM confidence
- [Okta Dev Forum: Okta SAML attributes, Cognito and access tokens](https://devforum.okta.com/t/okta-saml-attributes-cognito-and-acces-tokens/22085) -- MEDIUM confidence
- [NextAuth.js: Amazon Cognito Provider](https://next-auth.js.org/providers/cognito) -- HIGH confidence
- [Next.js Docs: Middleware](https://nextjs.org/docs/14/app/building-your-application/routing/middleware) -- HIGH confidence
- [ZenStack: Multi-Tenancy Approaches with Prisma](https://zenstack.dev/blog/multi-tenant) -- MEDIUM confidence
- [DEV.to: Multi-Tenant SaaS with Next.js 16, Prisma 7, and Auth.js](https://dev.to/frostbyte_nz/how-we-built-a-multi-tenant-saas-with-nextjs-16-prisma-7-and-authjs-57gj) -- MEDIUM confidence

---
*Feature research for: Authentication & Multi-User (v3.0 milestone)*
*Researched: 2026-03-09*
