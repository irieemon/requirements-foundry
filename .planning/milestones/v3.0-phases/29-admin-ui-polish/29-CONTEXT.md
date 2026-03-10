# Phase 29: Admin UI and Polish - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin users get a toggle to switch between "My Projects" and "All Projects" views on the Projects page. All users see their identity (initials avatar + name) in the sidebar with a dropdown user menu containing logout. Builds on Phase 27 auth flow and Phase 28 data isolation. Does NOT include Okta group-based admin detection, admin dashboards, audit logs, or theme customization.

</domain>

<decisions>
## Implementation Decisions

### User identity placement
- User info displayed at the bottom of the sidebar, replacing the existing collapse toggle button
- Expanded sidebar: initials avatar circle + user name, clickable to open dropdown menu
- Collapsed sidebar: initials avatar circle only, clickable to open same dropdown menu
- User's email shown inside the dropdown menu, not in the sidebar itself
- Use UserInfo.name for display name, UserInfo.email for initials generation and menu display

### User menu contents
- Dropdown menu opens on click of the avatar/name area (uses existing DropdownMenu component)
- Menu header: user name with small "Admin" badge (if admin), email below
- Menu items: "Collapse sidebar" action + divider + "Log out" action
- Collapse sidebar functionality moves from dedicated button to menu item
- Logout is immediate — no confirmation dialog (SSO re-login is easy)
- Logout triggers existing Cognito logout flow → redirect to landing page (from Phase 27)

### Admin project toggle
- Segmented toggle button [My | All] in the PageHeader actions area on the Projects page
- Only visible to admin users — non-admins see no toggle
- Toggle state persisted via URL parameter (?view=all) — bookmarkable, defaults to "My Projects" when no param
- "All Projects" view uses existing ownerLabel display on project cards (Phase 28) — no visual changes needed
- Admin toggle only on Projects page — Runs page stays scoped to user's projects (admin navigates via project)

### Claude's Discretion
- Initials avatar color/styling
- Exact segmented toggle component implementation
- Mobile user menu placement (mobile-nav component)
- Loading states during logout redirect
- How to pass user info to the sidebar (server component → client component data flow)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/dropdown-menu.tsx`: DropdownMenu, DropdownMenuContent, DropdownMenuItem — ready for user menu
- `components/layout/sidebar.tsx`: Bottom section currently has collapse toggle — will be replaced with user section
- `components/layout/page-header.tsx`: Has `actions` prop slot — admin toggle goes here
- `components/projects/project-card.tsx`: Already has `ownerLabel` display for admin view
- `lib/auth/types.ts`: `UserInfo { sub, email, name, groups }` — all needed user data available
- `lib/auth/authorization.ts`: `getAuthorizedProjects()` returns `{ projects, user, isAdmin }` — toggle logic connects here

### Established Patterns
- Client components use "use client" directive with hooks for state
- Sidebar collapse state persisted in localStorage — same pattern available for other preferences
- Server components pass data down to client components via props
- Badge component available for admin indicator
- Lucide icons used throughout (User, LogOut, ChevronDown, etc.)

### Integration Points
- `app/(authenticated)/projects/page.tsx`: Server component that calls `getAuthorizedProjects()` — needs to pass `isAdmin` and handle `?view=all` param
- `components/layout/app-shell.tsx`: Wraps all authenticated pages — needs to receive user info for sidebar
- `app/(authenticated)/layout.tsx`: Server component that renders AppShell — can call `getCurrentUser()` and pass user down
- `lib/auth/authorization.ts`: `getAuthorizedProjects()` already supports returning all projects for admin — needs a parameter to control filtering
- `server/actions/projects.ts`: May need a `getAllProjects()` variant or a `viewAll` parameter on `getAuthorizedProjects()`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-admin-ui-polish*
*Context gathered: 2026-03-10*
