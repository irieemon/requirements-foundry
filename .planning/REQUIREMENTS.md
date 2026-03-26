# Requirements: Requirements Foundry

**Defined:** 2026-03-26
**Core Value:** Transform uploaded documents into structured, exportable requirements with AI — securely isolated per user with corporate SSO.

## v5.0 Requirements

Requirements for Bug Reporting milestone. Each maps to roadmap phases.

### Bug Report Submission

- [ ] **SUB-01**: User can click a persistent "Report Bug" button visible on all authenticated pages
- [ ] **SUB-02**: User can describe a bug in a freeform text modal that captures page URL and user identity automatically
- [ ] **SUB-03**: User sees a success toast confirming their bug report was submitted
- [ ] **SUB-04**: Bug report captures browser metadata (userAgent, viewport size) automatically

### Email Notifications

- [ ] **EMAIL-01**: Admin receives an email notification via AWS SES when a bug report is submitted
- [ ] **EMAIL-02**: Notification email is rich HTML with report details and a direct link to the admin dashboard

### Admin Dashboard

- [ ] **ADMIN-01**: Admin can view all bug reports on a dedicated `/bug-reports` page showing submitter, date, page URL, description, and status
- [ ] **ADMIN-02**: Admin can update bug report status (open → in-progress → resolved → closed)
- [ ] **ADMIN-03**: Admin can add internal notes to bug reports
- [ ] **ADMIN-04**: Admin can filter reports by status and sort by date
- [ ] **ADMIN-05**: Admin sees an open report count badge in the sidebar navigation

### Infrastructure

- [x] **INFRA-01**: BugReport model exists in the database with all required fields (description, page URL, submitter, browser metadata, status, notes, timestamps)
- [x] **INFRA-02**: AWS SES is configured in CDK with email identity verification and ECS task role permissions

## Future Requirements

Deferred to v5.x+. Tracked but not in current roadmap.

### Reporter Visibility

- **VIS-01**: User can view their own submitted bug reports and statuses
- **VIS-02**: User receives email notification when their report status changes

### Attachments

- **ATT-01**: User can attach screenshots to bug reports
- **ATT-02**: Admin can view attached screenshots inline on the dashboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full ticketing system (assignment, due dates, labels, sprints) | JIRA/Linear already exist; this is an intake funnel, not an issue tracker |
| Real-time updates on dashboard | Existing polling architecture; page refresh is sufficient for admin |
| User self-registration for bug reporting | All users authenticate via corporate SSO |
| Screenshot capture tool (in-browser) | High complexity; users can describe bugs in text |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 34 | Complete |
| INFRA-02 | Phase 34 | Complete |
| SUB-01 | Phase 35 | Pending |
| SUB-02 | Phase 35 | Pending |
| SUB-03 | Phase 35 | Pending |
| SUB-04 | Phase 35 | Pending |
| EMAIL-01 | Phase 35 | Pending |
| EMAIL-02 | Phase 35 | Pending |
| ADMIN-01 | Phase 36 | Pending |
| ADMIN-02 | Phase 36 | Pending |
| ADMIN-03 | Phase 36 | Pending |
| ADMIN-04 | Phase 36 | Pending |
| ADMIN-05 | Phase 36 | Pending |

**Coverage:**
- v5.0 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
