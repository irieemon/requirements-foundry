# Architecture Research: Cognito + Okta SAML SSO Integration

**Domain:** Authentication & multi-user isolation for existing Next.js on ECS Fargate
**Researched:** 2026-03-09
**Confidence:** HIGH

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Internet / Corporate Network                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Browser ──► ALB (port 80) ──► ECS Fargate (port 3000)              │
│      │                              │                                │
│      │    ┌─────────────────┐       │   ┌──────────────────┐         │
│      └───►│ Cognito Hosted  │       ├──►│ Next.js          │         │
│           │ UI (SAML SSO)   │       │   │ middleware.ts     │         │
│           │                 │       │   │ (JWT verify)      │         │
│           │ ┌─────────────┐ │       │   └────────┬─────────┘         │
│           │ │ Okta SAML   │ │       │            │                   │
│           │ │ IdP         │ │       │   ┌────────▼─────────┐         │
│           │ └─────────────┘ │       │   │ Server Actions    │         │
│           └────────┬────────┘       │   │ + API Routes      │         │
│                    │                │   │ (userId filter)    │         │
│                    │ auth code      │   └────────┬─────────┘         │
│                    ▼                │            │                   │
│           ┌────────────────┐        │   ┌────────▼─────────┐         │
│           │ /api/auth/     │────────┘   │ Prisma (RDS PG)  │         │
│           │ callback       │            │ WHERE userId=X    │         │
│           │ (token exchange)│           └──────────────────┘         │
│           └────────────────┘                                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow (Step by Step)

```
1. User visits app ──► middleware.ts checks for session cookie
2. No cookie ──► redirect to /login (public landing page)
3. User clicks "Sign in with Okta" ──► redirect to Cognito Hosted UI
4. Cognito Hosted UI ──► SAML redirect to Okta
5. User authenticates in Okta ──► SAML assertion back to Cognito
6. Cognito ──► authorization code redirect to /api/auth/callback
7. Callback route ──► exchanges code for tokens at Cognito token endpoint
8. Tokens (id_token, access_token, refresh_token) ──► stored in HttpOnly cookies
9. Redirect to /projects ──► middleware reads cookie, verifies JWT, continues
10. Server actions ──► read userId from cookie/session, add to Prisma queries
```

## New CDK Resources Required

### Cognito Constructs (add to existing `RequirementsFoundryStack`)

| Construct | CDK Class | Purpose |
|-----------|-----------|---------|
| UserPool | `cognito.UserPool` | Central user directory, stores federated user profiles |
| UserPoolClient | `cognito.UserPoolClient` | App client with OAuth settings, callback URLs |
| UserPoolDomain | `cognito.UserPoolDomain` | Hosted UI domain for login/logout pages |
| UserPoolIdentityProviderSaml | `cognito.UserPoolIdentityProviderSaml` | Okta SAML federation configuration |
| SSM Parameters (3) | `ssm.StringParameter` | User Pool ID, Client ID, Domain URL for app |

### CDK Implementation Pattern

```typescript
import * as cognito from 'aws-cdk-lib/aws-cognito';

// --- Inside RequirementsFoundryStack constructor ---

// 1. User Pool
const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: 'requirements-foundry-prod-userpool',
  selfSignUpEnabled: false,          // Okta-only, no self-registration
  signInCaseSensitive: false,
  standardAttributes: {
    email: { required: true, mutable: true },
    givenName: { required: false, mutable: true },
    familyName: { required: false, mutable: true },
  },
  customAttributes: {
    'groups': new cognito.StringAttribute({ mutable: true }),  // Okta groups
  },
  removalPolicy: cdk.RemovalPolicy.DESTROY,  // POC
});

// 2. Okta SAML Identity Provider
const oktaSamlProvider = new cognito.UserPoolIdentityProviderSaml(this, 'OktaSaml', {
  userPool,
  name: 'Okta',
  metadata: cognito.UserPoolIdentityProviderSamlMetadata.url(
    // Okta metadata URL - set via CDK context or SSM parameter
    this.node.tryGetContext('oktaMetadataUrl') || 'https://placeholder.okta.com/metadata'
  ),
  attributeMapping: {
    email: cognito.ProviderAttribute.other(
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    ),
    givenName: cognito.ProviderAttribute.other(
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'
    ),
    familyName: cognito.ProviderAttribute.other(
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'
    ),
    custom: {
      'custom:groups': cognito.ProviderAttribute.other('groups'),
    },
  },
});

// 3. App Client (SAML-only, authorization code grant)
const appClient = userPool.addClient('AppClient', {
  userPoolClientName: 'requirements-foundry-app',
  generateSecret: true,  // Server-side app needs client secret
  supportedIdentityProviders: [
    cognito.UserPoolClientIdentityProvider.custom('Okta'),
  ],
  oAuth: {
    flows: { authorizationCodeGrant: true },
    scopes: [
      cognito.OAuthScope.OPENID,
      cognito.OAuthScope.EMAIL,
      cognito.OAuthScope.PROFILE,
    ],
    callbackUrls: [
      `http://${alb.loadBalancerDnsName}/api/auth/callback`,
      'http://localhost:3000/api/auth/callback',  // local dev
    ],
    logoutUrls: [
      `http://${alb.loadBalancerDnsName}/`,
      'http://localhost:3000/',
    ],
  },
  accessTokenValidity: cdk.Duration.hours(1),
  idTokenValidity: cdk.Duration.hours(1),
  refreshTokenValidity: cdk.Duration.days(30),
});

// Ensure client waits for SAML provider
appClient.node.addDependency(oktaSamlProvider);

// 4. Hosted UI Domain
const userPoolDomain = userPool.addDomain('Domain', {
  cognitoDomain: {
    domainPrefix: 'requirements-foundry',
  },
});

// 5. Store Cognito config as SSM Parameters (app reads at startup)
new ssm.StringParameter(this, 'CognitoUserPoolIdParam', {
  parameterName: '/requirements-foundry/prod/cognito-user-pool-id',
  stringValue: userPool.userPoolId,
});
new ssm.StringParameter(this, 'CognitoClientIdParam', {
  parameterName: '/requirements-foundry/prod/cognito-client-id',
  stringValue: appClient.userPoolClientId,
});
new ssm.StringParameter(this, 'CognitoDomainParam', {
  parameterName: '/requirements-foundry/prod/cognito-domain',
  stringValue: `https://${userPoolDomain.domainName}.auth.us-east-1.amazoncognito.com`,
});

// 6. Client secret handling:
// CDK does not directly expose UserPoolClient secrets as constructs.
// Two options:
//   A) Post-deploy script: aws cognito describe-user-pool-client → store in Secrets Manager
//   B) Use a CDK Custom Resource to fetch and store automatically
// Option A is simpler for POC.

// 7. Add Cognito env vars to existing ECS container definition
// Modify the existing container environment block to include:
//   COGNITO_USER_POOL_ID: userPool.userPoolId,
//   COGNITO_CLIENT_ID: appClient.userPoolClientId,
//   COGNITO_DOMAIN: `https://requirements-foundry.auth.us-east-1.amazoncognito.com`,
//   COGNITO_ISSUER: `https://cognito-idp.us-east-1.amazonaws.com/${userPool.userPoolId}`,

// Stack outputs for Cognito
new cdk.CfnOutput(this, 'CognitoUserPoolId', {
  value: userPool.userPoolId,
  exportName: 'rf-prod-cognito-user-pool-id',
});
new cdk.CfnOutput(this, 'CognitoClientId', {
  value: appClient.userPoolClientId,
  exportName: 'rf-prod-cognito-client-id',
});
new cdk.CfnOutput(this, 'CognitoDomainUrl', {
  value: `https://${userPoolDomain.domainName}.auth.us-east-1.amazoncognito.com`,
  exportName: 'rf-prod-cognito-domain',
});
new cdk.CfnOutput(this, 'CognitoSamlSpMetadata', {
  value: `https://cognito-idp.us-east-1.amazonaws.com/${userPool.userPoolId}/saml2/metadata`,
  description: 'Give this URL to Okta admin when creating the SAML app',
  exportName: 'rf-prod-cognito-sp-metadata',
});
```

### Existing Resources Modified

| Resource | Change | Why |
|----------|--------|-----|
| ECS TaskDefinition (container env) | Add COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_DOMAIN, COGNITO_ISSUER, NEXT_PUBLIC_APP_URL | App needs Cognito config at runtime |
| ECS TaskDefinition (container secrets) | Add COGNITO_CLIENT_SECRET from Secrets Manager | Token exchange needs client secret |
| ECS TaskRole | No change needed | Cognito auth uses OAuth (client-side), not IAM credentials |

## Component Responsibilities

| Component | Responsibility | New vs Modified |
|-----------|----------------|-----------------|
| Cognito UserPool | Stores federated user identities from Okta | **NEW** CDK resource |
| Cognito SAML IdP | Bridges Okta SAML assertions to Cognito tokens | **NEW** CDK resource |
| Cognito App Client | OAuth client config (callback URLs, scopes) | **NEW** CDK resource |
| Cognito Domain | Hosted UI for login redirect | **NEW** CDK resource |
| `/api/auth/callback` route | Exchanges auth code for tokens, sets cookies | **NEW** Next.js API route |
| `/api/auth/logout` route | Clears cookies, redirects to Cognito logout | **NEW** Next.js API route |
| `middleware.ts` | JWT verification, redirect unauthenticated, extract userId | **NEW** Next.js middleware |
| `/login` page | Public landing page with "Sign in with Okta" button | **NEW** Next.js page |
| `lib/auth.ts` | Helper: get session from cookies, verify JWT, parse claims | **NEW** utility module |
| `server/actions/projects.ts` | Add userId to `where` clauses and `create` data | **MODIFIED** |
| All server actions (18 files) | Call `getSession()`, pass userId to queries | **MODIFIED** |
| All API routes (9 files) | Verify auth token, extract userId | **MODIFIED** |
| Prisma schema (Project) | Make `userId` non-nullable via phased migration | **MODIFIED** |
| `app/layout.tsx` | Pass user info to AppShell for display | **MODIFIED** |

## Architectural Patterns

### Pattern 1: Server-Side Token Exchange (Authorization Code Grant)

**What:** User authenticates via Cognito Hosted UI. Browser receives an authorization code in the callback URL. Server-side API route exchanges code for tokens using the client secret. Tokens stored in HttpOnly cookies -- never exposed to client JavaScript.

**When to use:** Always for server-rendered Next.js apps. Authorization code grant with server-side exchange is the most secure OAuth flow.

**Why not Amplify:** Amplify stores tokens in localStorage (XSS-vulnerable) and adds ~200KB+ bundle weight. For a server-rendered ECS-hosted app, direct OAuth with HttpOnly cookies is simpler and more secure.

**Trade-offs:** More code than Amplify drop-in, but full control over session lifecycle and no client-side token exposure.

```typescript
// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect('/login?error=no_code');

  // Exchange code for tokens at Cognito token endpoint
  const tokenResponse = await fetch(
    `${process.env.COGNITO_DOMAIN}/oauth2/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.COGNITO_CLIENT_ID!,
        client_secret: process.env.COGNITO_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      }),
    }
  );

  const tokens = await tokenResponse.json();

  // Set HttpOnly cookies
  const cookieStore = await cookies();
  cookieStore.set('id_token', tokens.id_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600, // 1 hour
  });
  cookieStore.set('refresh_token', tokens.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 3600, // 30 days
  });

  return NextResponse.redirect(new URL('/projects', req.url));
}
```

### Pattern 2: Middleware JWT Verification

**What:** Next.js middleware intercepts every request, reads the id_token cookie, verifies its JWT signature against Cognito's JWKS, and either allows the request or redirects to login.

**When to use:** Every protected route. Since this app runs on ECS (self-hosted, not Vercel), middleware uses the Node.js runtime -- so `jsonwebtoken` and `jwks-rsa` work fine. No need for the `jose` library (which is needed only for Edge Runtime on Vercel).

**Trade-offs:** Middleware runs on every request, so keep verification fast. JWKS keys should be cached (`jwks-rsa` has built-in caching). RSA signature verification is ~1ms -- negligible.

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export const config = {
  matcher: [
    // Protect everything except public routes and static assets
    '/((?!login|api/auth|api/health|api/cron|_next/static|_next/image|favicon.ico).*)',
  ],
  runtime: 'nodejs',  // Self-hosted on ECS = full Node.js available
};

const client = jwksClient({
  jwksUri: `https://cognito-idp.us-east-1.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000,  // Cache JWKS keys for 10 minutes
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key?.getPublicKey());
  });
}

async function verifyToken(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      issuer: process.env.COGNITO_ISSUER,
      algorithms: ['RS256'],
    }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded as jwt.JwtPayload);
    });
  });
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('id_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const decoded = await verifyToken(token);
    // Attach user info to request headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', decoded.sub as string);
    response.headers.set('x-user-email', decoded.email as string);
    response.headers.set('x-user-groups', (decoded['custom:groups'] as string) || '');
    return response;
  } catch {
    // Token expired or invalid -- clear cookies, redirect to login
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('id_token');
    response.cookies.delete('refresh_token');
    return response;
  }
}
```

### Pattern 3: Server Action Auth Helper (Per-User Data Filtering)

**What:** A centralized `getSession()` helper reads and decodes the id_token from cookies, returning a typed user object. Every server action calls this before querying the database. Project queries include `WHERE userId = session.userId` (or no filter for admins).

**When to use:** Every server action and API route that accesses user-scoped data.

**Trade-offs:** Adds one function call per server action. Centralizes auth logic so it cannot be accidentally bypassed. Uses `jwt.decode()` (not `jwt.verify()`) since middleware already verified the token on this request.

```typescript
// lib/auth.ts
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export interface Session {
  userId: string;       // Cognito sub (unique, stable ID)
  email: string;
  givenName?: string;
  familyName?: string;
  groups: string[];     // Okta groups from custom:groups claim
  isAdmin: boolean;     // Derived: groups includes 'RequirementsFoundry-Admins'
}

export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const token = cookieStore.get('id_token')?.value;
  if (!token) throw new Error('Not authenticated');

  // Decode only -- full verification already done in middleware
  const decoded = jwt.decode(token) as jwt.JwtPayload;
  if (!decoded?.sub) throw new Error('Invalid token');

  const groups = ((decoded['custom:groups'] as string) || '')
    .split(',')
    .map(g => g.trim())
    .filter(Boolean);

  return {
    userId: decoded.sub,
    email: decoded.email as string,
    givenName: decoded.given_name as string | undefined,
    familyName: decoded.family_name as string | undefined,
    groups,
    isAdmin: groups.includes('RequirementsFoundry-Admins'),
  };
}

// Helper: returns Prisma WHERE filter for project queries
export async function getProjectFilter(): Promise<{ userId?: string }> {
  const session = await getSession();
  if (session.isAdmin) return {};  // Admins see all projects
  return { userId: session.userId };
}
```

### Pattern 4: Prisma Query Filtering

**What:** Modify all project-touching queries to include userId filter. Use `getProjectFilter()` for list queries and `getSession()` + ownership check for single-project operations.

**How existing queries change:**

```typescript
// server/actions/projects.ts -- BEFORE
export async function getProjects() {
  return db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { uploads: true, cards: true, epics: true, runs: true } } },
  });
}

// server/actions/projects.ts -- AFTER
export async function getProjects() {
  const filter = await getProjectFilter();
  return db.project.findMany({
    where: filter,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { uploads: true, cards: true, epics: true, runs: true } } },
  });
}

// BEFORE
export async function createProject(data: { name: string; description?: string }) {
  return db.project.create({
    data: { name: data.name, description: data.description || null },
  });
}

// AFTER
export async function createProject(data: { name: string; description?: string }) {
  const session = await getSession();
  return db.project.create({
    data: { name: data.name, description: data.description || null, userId: session.userId },
  });
}

// Single-project access: verify ownership
export async function getProject(id: string) {
  const session = await getSession();
  const project = await db.project.findUnique({
    where: { id },
    // ... include block unchanged ...
  });
  if (!project) return null;
  if (!session.isAdmin && project.userId !== session.userId) return null;
  return project;
}
```

### Pattern 5: Cron Route Auth Bypass

**What:** The `/api/cron/recover-stale-runs` route is called by Lambda, not by users. It authenticates via the existing CRON_SECRET bearer token. It must be excluded from middleware's JWT check.

**How:** Already handled by middleware matcher exclusion (`api/cron` path excluded). No changes needed to the cron route itself.

## Data Flow

### Authentication Flow

```
Browser                    Cognito Hosted UI          Okta IdP
   |                            |                       |
   |-- GET /projects ---------->|                       |
   |<- 302 /login (middleware)  |                       |
   |                            |                       |
   |-- GET /login ------------->|                       |
   |<- 200 (landing page)      |                       |
   |                            |                       |
   |-- Click "Sign in" ------->|                       |
   |   (redirect to Cognito)    |                       |
   |                            |-- SAML AuthnRequest ->|
   |                            |<- SAML Assertion -----|
   |                            |                       |
   |<- 302 /api/auth/callback  |                       |
   |   ?code=XXXXX              |                       |
   |                            |                       |
   |-- GET /api/auth/callback --|                       |
   |   (server exchanges code)  |                       |
   |<- Set-Cookie: id_token     |                       |
   |   302 /projects            |                       |
   |                            |                       |
   |-- GET /projects ---------->|                       |
   |   Cookie: id_token         |                       |
   |   (middleware verifies)    |                       |
   |<- 200 (user's projects)   |                       |
```

### Data Access Flow (After Auth)

```
Server Component / Server Action
    |
    |-- getSession()           --> reads id_token cookie, decodes JWT
    |   returns { userId, email, groups, isAdmin }
    |
    |-- getProjectFilter()     --> { userId: "xxx" } or {} for admin
    |
    |-- db.project.findMany({ where: filter, ... })
        |-- Prisma --> PostgreSQL (RDS)
            SELECT * FROM "Project" WHERE "userId" = 'xxx'
```

### Okta Groups to Admin Role Flow

```
Okta Group: "RequirementsFoundry-Admins"
    |
    |-- Okta SAML Assertion: attribute "groups" = "RequirementsFoundry-Admins"
    |
    |-- Cognito attribute mapping: custom:groups <-- groups
    |
    |-- id_token JWT claim: "custom:groups" = "RequirementsFoundry-Admins"
    |
    |-- getSession(): groups.includes('RequirementsFoundry-Admins')
    |
    |-- isAdmin = true --> getProjectFilter() returns {} (no userId filter)
```

## New Project Structure (Auth-Related Files Only)

```
app/
|-- login/
|   |-- page.tsx                    # NEW: Public landing page with SSO button
|-- api/
|   |-- auth/
|       |-- callback/
|       |   |-- route.ts            # NEW: OAuth code exchange, set cookies
|       |-- logout/
|           |-- route.ts            # NEW: Clear cookies, Cognito logout
|-- layout.tsx                      # MODIFIED: pass user context to AppShell
|
lib/
|-- auth.ts                         # NEW: getSession(), getProjectFilter()
|
middleware.ts                       # NEW: JWT verification, route protection
|
server/actions/
|-- projects.ts                     # MODIFIED: add userId filtering
|-- analysis.ts                     # MODIFIED: verify project ownership
|-- generation.ts                   # MODIFIED: verify project ownership
|-- batch-stories.ts                # MODIFIED: verify project ownership
|-- subtasks.ts                     # MODIFIED: verify project ownership
|-- uploads.ts                      # MODIFIED: verify project ownership
|-- epics.ts                        # MODIFIED: verify project ownership
|-- export.ts                       # MODIFIED: verify project ownership
|-- jira-export.ts                  # MODIFIED: verify project ownership
|-- questions.ts                    # MODIFIED: verify project ownership
|-- mss.ts                          # NO CHANGE (MSS is global taxonomy, not user-scoped)
|
infra/lib/
|-- requirements-foundry-stack.ts   # MODIFIED: add Cognito constructs
|
prisma/
|-- schema.prisma                   # MODIFIED: userId non-nullable (phased)
```

## Database Migration Strategy

The Project model already has `userId String?` with an `@@index([userId])`. The migration is phased to avoid downtime:

```
Phase 1: Deploy auth code (userId remains nullable)
  - New projects get userId from session
  - Old projects remain with userId = null
  - List queries: WHERE userId = X OR userId IS NULL (transition)
  - This ensures existing projects remain visible during transition

Phase 2: Backfill existing projects
  - Admin assigns ownership to existing projects via UI or script
  - Fallback: UPDATE "Project" SET "userId" = '<admin-cognito-sub>' WHERE "userId" IS NULL

Phase 3: Make userId non-nullable
  - Prisma migration: ALTER COLUMN "userId" SET NOT NULL
  - Remove OR userId IS NULL from queries
  - Clean data model going forward
```

## Anti-Patterns

### Anti-Pattern 1: Client-Side Token Storage (localStorage/sessionStorage)

**What people do:** Use Amplify or custom code that stores Cognito tokens in localStorage.
**Why it's wrong:** XSS vulnerabilities can steal tokens. Any injected script reads localStorage.
**Do this instead:** HttpOnly cookies. The browser sends them automatically; JavaScript cannot read them.

### Anti-Pattern 2: Full JWT Verification in Every Server Action

**What people do:** Call full JWT verification (RSA signature check, JWKS fetch) in every server action.
**Why it's wrong:** Middleware already verified the token before the request reached the server action. Re-verifying 18+ times per page load wastes CPU.
**Do this instead:** Middleware verifies once. Server actions use `jwt.decode()` (not `jwt.verify()`) to read claims, since middleware guarantees the token is valid for this request.

### Anti-Pattern 3: Using Cognito Identity Pool

**What people do:** Add an Identity Pool to get temporary AWS credentials for browser-side API calls.
**Why it's wrong:** This app makes zero browser-to-AWS-service calls. All data flows through Next.js server actions and API routes. The ECS task role handles AWS service access.
**Do this instead:** Use only User Pool + App Client. Skip Identity Pools entirely.

### Anti-Pattern 4: Making userId Non-Nullable Before Data Backfill

**What people do:** Change Prisma schema to `userId String` (required) before handling existing rows.
**Why it's wrong:** Prisma migration fails because existing rows have NULL userId.
**Do this instead:** Three-phase migration: deploy with nullable, backfill data, then make non-nullable.

### Anti-Pattern 5: Storing User Profile Data in App Database

**What people do:** Create a `User` table and sync profile data from Cognito.
**Why it's wrong:** For this app, all user data comes from Okta via Cognito JWT claims. There's no user-editable profile, no in-app preferences, no avatar. Adding a User table creates sync complexity with no benefit.
**Do this instead:** Use `userId` (Cognito sub) as a foreign key on Project. User display info (name, email) comes from the JWT on each request. If user preferences are needed later, add a User table then.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Okta (SAML IdP) | SAML 2.0 via Cognito federation | Requires Okta admin to create SAML app. Chicken-and-egg: deploy Cognito first, get SP metadata URL, configure Okta, update CDK with real metadata URL, redeploy. |
| Cognito Hosted UI | OAuth 2.0 Authorization Code Grant | Browser redirects to Cognito, Cognito redirects to Okta, Okta redirects back. No direct app-to-Okta communication. |
| Cognito Token Endpoint | HTTP POST from `/api/auth/callback` | Server exchanges auth code for tokens. Requires client_secret. URL: `{COGNITO_DOMAIN}/oauth2/token` |
| Cognito JWKS Endpoint | HTTP GET from middleware (cached) | Fetches public keys for JWT signature verification. URL: `cognito-idp.{region}.amazonaws.com/{poolId}/.well-known/jwks.json` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| middleware.ts --> Server Actions | Request headers (`x-user-id`, `x-user-email`, `x-user-groups`) | Middleware sets headers after JWT verification |
| Server Actions --> Prisma | Direct function calls with userId filter | All project queries add userId WHERE clause from session |
| API Routes --> Auth | Cookie reading via `cookies()` | Polling routes, upload route need auth check too |
| `/api/cron/*` --> Auth | CRON_SECRET bearer token (bypass JWT auth) | Lambda cron has no user session; uses existing shared secret |
| CDK Stack --> ECS Container | Environment variables + Secrets Manager | Cognito config as env vars; client secret via Secrets Manager |

## Build Order (Dependency-Aware)

Build order respects the dependency chain: CDK resources must exist before app code can use them, and Okta configuration requires Cognito SP metadata.

| Phase | What to Build | Depends On | Deliverable |
|-------|---------------|------------|-------------|
| 1 | CDK: UserPool, UserPoolDomain, UserPoolClient, SAML IdP (placeholder metadata URL) | Existing CDK stack | Cognito resources deployed; SP metadata URL available |
| 2 | Okta: Create SAML app in Okta admin console, configure with Cognito SP metadata | Phase 1 (SP metadata URL from CDK output) | Okta metadata URL |
| 3 | CDK: Update SAML IdP with real Okta metadata URL, redeploy. Add Cognito env vars to ECS container. | Phase 2 (Okta metadata URL) | Working SAML federation; container has config |
| 4 | App: `lib/auth.ts` (getSession, getProjectFilter helpers) | None (pure code) | Auth utility ready |
| 5 | App: `middleware.ts` (JWT verification, route protection) | Phase 3 (COGNITO_* env vars available) | All routes protected |
| 6 | App: `/api/auth/callback` + `/api/auth/logout` routes | Phase 3 + Phase 4 | Token exchange and logout work |
| 7 | App: `/login` landing page with "Sign in with Okta" button | Phase 5 + Phase 6 | End-to-end login flow works |
| 8 | App: Modify `server/actions/projects.ts` (create, list, get, update, delete) | Phase 4 | Per-user project isolation |
| 9 | App: Modify remaining server actions (analysis, generation, uploads, etc.) | Phase 8 | Full data isolation |
| 10 | App: Admin role logic (skip userId filter for admins) | Phase 9 | Admin sees all projects |
| 11 | DB: Backfill userId on existing projects, then make column non-nullable | Phase 10 | Clean data model |
| 12 | App: UI polish (user menu in AppShell, display name, logout button) | Phase 10 | Complete UX |

**Critical path:** Phases 1-2-3 involve manual Okta admin steps and CDK redeployment. Plan for this handoff -- it's the main blocker.

**Parallelization opportunity:** Phases 4-6 (app auth code) can be developed and tested locally in parallel with Phases 1-3 (CDK + Okta setup) using mock tokens or a local Cognito setup.

## Okta-Cognito Setup: Chicken-and-Egg Resolution

This is the most commonly misunderstood part. The exact sequence:

1. **CDK deploy** with a placeholder Okta metadata URL (use any valid SAML metadata XML or a known-valid URL)
2. **Get Cognito SP metadata** from CDK output: `https://cognito-idp.us-east-1.amazonaws.com/<pool-id>/saml2/metadata`
3. **Create Okta SAML app** in Okta admin with:
   - Single Sign-On URL: `https://requirements-foundry.auth.us-east-1.amazoncognito.com/saml2/idpresponse`
   - Audience URI (SP Entity ID): `urn:amazon:cognito:sp:<pool-id>`
   - Attribute Statements: email, firstName, lastName, groups
   - Group Attribute: `groups` (filter by "RequirementsFoundry-*" or send all)
4. **Get Okta metadata URL** from the Okta SAML app's "Sign On" tab
5. **CDK redeploy** with real metadata URL: `cdk deploy -c oktaMetadataUrl=https://your-okta-domain/app/xxx/sso/saml/metadata`
6. **Assign users** in Okta to the SAML app
7. **Test**: Visit app, click "Sign in with Okta", verify login completes

## Environment Variables (ECS Container)

New variables to add to the existing ECS container definition:

| Variable | Source | Sensitive | How to Pass |
|----------|--------|-----------|-------------|
| `COGNITO_USER_POOL_ID` | CDK output | No | Container environment |
| `COGNITO_CLIENT_ID` | CDK output | No | Container environment |
| `COGNITO_CLIENT_SECRET` | Post-deploy script | **Yes** | Secrets Manager |
| `COGNITO_DOMAIN` | CDK output | No | Container environment |
| `COGNITO_ISSUER` | Derived from pool ID | No | Container environment |
| `NEXT_PUBLIC_APP_URL` | ALB DNS name | No | Container environment |

## Token Refresh Strategy

When the id_token expires (1 hour), the middleware will reject it. Two options:

**Option A (Recommended for POC):** Redirect to login. The user clicks "Sign in with Okta" again. Since they have an active Okta session, Okta SSO silently re-authenticates (no password prompt). This is seamless from the user's perspective.

**Option B (Future enhancement):** Add a refresh flow. When middleware detects an expired id_token, call Cognito's `/oauth2/token` endpoint with the refresh_token to get new tokens. Set new cookies and continue. This avoids even the brief redirect.

Option A is simpler and acceptable for an internal POC with ~20 users. Option B is worth adding if session interruption becomes annoying.

## Sources

- [AWS CDK Cognito Module - UserPoolIdentityProviderSaml](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.UserPoolIdentityProviderSaml.html) -- HIGH confidence
- [AWS CDK Cognito README - full construct reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito-readme.html) -- HIGH confidence
- [Amazon Cognito example for external IdP (GitHub)](https://github.com/aws-samples/amazon-cognito-example-for-external-idp) -- HIGH confidence
- [Okta SAML attributes and Cognito group mapping](https://devforum.okta.com/t/okta-saml-attributes-cognito-and-acces-tokens/22085) -- MEDIUM confidence
- [SAML Group assertions from IDP to AWS Cognito](https://repost.aws/questions/QUjYKehBfFSL-gWEEviEI3cQ/saml-group-assertions-from-idp-to-aws-cognito) -- MEDIUM confidence
- [Next.js middleware Node.js runtime support (v15.2+)](https://github.com/vercel/next.js/discussions/71727) -- HIGH confidence
- [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting) -- HIGH confidence
- [Cognito SSO with Hosted UI](https://blog.srcinnovations.com.au/2024/04/03/single-sign-on-sso-with-aws-cognitos-hosted-ui/) -- MEDIUM confidence
- [How to Implement Cognito Authentication in Next.js](https://oneuptime.com/blog/post/2026-02-12-cognito-authentication-nextjs/view) -- MEDIUM confidence

---
*Architecture research for: Cognito + Okta SAML SSO integration with existing Next.js on ECS Fargate*
*Researched: 2026-03-09*
