# Requirements: Requirements Foundry

**Defined:** 2026-03-09
**Core Value:** Internal corporate users authenticate via Okta SSO and see only their own projects, with admin oversight across all users.

## v1 Requirements

Requirements for v3.0 milestone. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign in via Okta SAML SSO with seamless redirect (no extra login if already authenticated)
- [ ] **AUTH-02**: Unauthenticated user sees a public landing page with "Sign in with Okta" button
- [ ] **AUTH-03**: User session persists via HTTP-only cookies with automatic refresh via Okta SSO session
- [ ] **AUTH-04**: User can log out and is redirected to the landing page
- [ ] **AUTH-05**: All app routes are protected — unauthenticated requests redirect to landing page

### Data Isolation

- [ ] **DATA-01**: New projects are automatically assigned to the authenticated user
- [ ] **DATA-02**: Users see only their own projects in all views
- [ ] **DATA-03**: All server actions and API routes enforce userId ownership checks
- [ ] **DATA-04**: Existing projects are migrated to the admin user during deployment

### Admin

- [ ] **ADMIN-01**: Users in the Okta admin group are granted admin role via JWT claims
- [ ] **ADMIN-02**: Admin users can toggle between "My Projects" and "All Projects" views
- [ ] **ADMIN-03**: Default admin is sean.mcinerney@merkle.com

### User Experience

- [ ] **UX-01**: Header displays user name/email from Okta with a user menu
- [ ] **UX-02**: User menu includes logout option

### Infrastructure

- [ ] **INFRA-01**: Cognito User Pool deployed via CDK with Okta SAML identity provider
- [ ] **INFRA-02**: PreTokenGeneration Lambda maps Okta groups to JWT claims
- [ ] **INFRA-03**: Cognito client credentials stored securely (Secrets Manager or environment)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Authentication Enhancements

- **AUTH-06**: Refresh token rotation for enhanced security
- **AUTH-07**: Custom Cognito domain (e.g., auth.requirementsfoundry.internal)
- **AUTH-08**: Multi-factor authentication as fallback for non-Okta users

### Admin Enhancements

- **ADMIN-04**: Admin can reassign project ownership between users
- **ADMIN-05**: Admin dashboard with user activity metrics
- **ADMIN-06**: Audit log of user actions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Local username/password auth | Pure SSO — corporate Okta handles all authentication |
| NextAuth / Amplify libraries | Direct Cognito integration is simpler for SAML; avoids unnecessary abstractions |
| PostgreSQL Row-Level Security | Prisma doesn't natively support RLS session variables; app-level filtering sufficient for internal tool |
| IdP-initiated SAML | Cognito doesn't support it; users use landing page or bookmark app in Okta |
| ALB-level Cognito authentication | Breaks logout control; app-level auth preferred |
| User self-registration | Corporate SSO only — users must exist in Okta |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| AUTH-05 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| DATA-04 | — | Pending |
| ADMIN-01 | — | Pending |
| ADMIN-02 | — | Pending |
| ADMIN-03 | — | Pending |
| UX-01 | — | Pending |
| UX-02 | — | Pending |
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 0
- Unmapped: 17 ⚠️

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after initial definition*
