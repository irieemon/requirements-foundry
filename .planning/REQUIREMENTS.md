# Requirements: Requirements Foundry

**Defined:** 2026-03-09
**Core Value:** Internal corporate users authenticate via Okta SSO and see only their own projects, with admin oversight across all users.

## v1 Requirements

Requirements for v3.0 milestone. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can sign in via Okta SAML SSO with seamless redirect (no extra login if already authenticated)
- [x] **AUTH-02**: Unauthenticated user sees a public landing page with "Sign in with Okta" button
- [x] **AUTH-03**: User session persists via HTTP-only cookies with automatic refresh via Okta SSO session
- [x] **AUTH-04**: User can log out and is redirected to the landing page
- [x] **AUTH-05**: All app routes are protected — unauthenticated requests redirect to landing page

### Data Isolation

- [x] **DATA-01**: New projects are automatically assigned to the authenticated user
- [x] **DATA-02**: Users see only their own projects in all views
- [x] **DATA-03**: All server actions and API routes enforce userId ownership checks
- [x] **DATA-04**: Existing projects are migrated to the admin user during deployment

### Admin

- [x] **ADMIN-01**: Users in the Okta admin group are granted admin role via JWT claims
- [ ] **ADMIN-02**: Admin users can toggle between "My Projects" and "All Projects" views
- [x] **ADMIN-03**: Default admin is sean.mcinerney@merkle.com

### User Experience

- [ ] **UX-01**: Header displays user name/email from Okta with a user menu
- [ ] **UX-02**: User menu includes logout option

### Infrastructure

- [x] **INFRA-01**: Cognito User Pool deployed via CDK with Okta SAML identity provider
- [x] **INFRA-02**: PreTokenGeneration Lambda maps Okta groups to JWT claims
- [x] **INFRA-03**: Cognito client credentials stored securely (Secrets Manager or environment)

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
| AUTH-01 | Phase 27 | Complete |
| AUTH-02 | Phase 27 | Complete |
| AUTH-03 | Phase 27 | Complete |
| AUTH-04 | Phase 27 | Complete |
| AUTH-05 | Phase 27 | Complete |
| DATA-01 | Phase 28 | Complete |
| DATA-02 | Phase 28 | Complete |
| DATA-03 | Phase 28 | Complete |
| DATA-04 | Phase 28 | Complete |
| ADMIN-01 | Phase 28 | Complete |
| ADMIN-02 | Phase 29 | Pending |
| ADMIN-03 | Phase 28 | Complete |
| UX-01 | Phase 29 | Pending |
| UX-02 | Phase 29 | Pending |
| INFRA-01 | Phase 26 | Complete |
| INFRA-02 | Phase 26 | Complete |
| INFRA-03 | Phase 26 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
