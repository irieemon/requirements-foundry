# Phase 29: Admin UI and Polish - Research

**Researched:** 2026-03-10
**Domain:** Next.js UI components, Radix DropdownMenu, server-to-client data flow, URL search params
**Confidence:** HIGH

## Summary

Phase 29 is a pure UI phase that connects existing backend capabilities (user identity from session, admin detection, authorized project queries) to new frontend components. All backend plumbing is already complete from Phases 27-28. The work involves: (1) a user identity section at the bottom of the sidebar with a dropdown menu, (2) an admin-only segmented toggle on the Projects page to switch between "My Projects" and "All Projects" views, and (3) the same user identity in the mobile nav.

The codebase already has all required UI primitives (DropdownMenu from Radix, Badge component, Lucide icons, Button variants) and all backend functions (`getCurrentUser()`, `getAuthorizedProjects()`, `isAdmin()`, logout route at `/api/auth/logout`). The primary challenge is threading user data from server components through to client components (sidebar is "use client"), and making `getAuthorizedProjects()` respect a `viewAll` parameter controlled by URL search params.

**Primary recommendation:** Pass user info and isAdmin flag from the authenticated layout (server component) through AppShell props down to Sidebar and MobileNav. Use Next.js `searchParams` on the Projects page to read `?view=all` and conditionally fetch all projects vs. user projects.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- User info displayed at the bottom of the sidebar, replacing the existing collapse toggle button
- Expanded sidebar: initials avatar circle + user name, clickable to open dropdown menu
- Collapsed sidebar: initials avatar circle only, clickable to open same dropdown menu
- User's email shown inside the dropdown menu, not in the sidebar itself
- Use UserInfo.name for display name, UserInfo.email for initials generation and menu display
- Dropdown menu opens on click of the avatar/name area (uses existing DropdownMenu component)
- Menu header: user name with small "Admin" badge (if admin), email below
- Menu items: "Collapse sidebar" action + divider + "Log out" action
- Collapse sidebar functionality moves from dedicated button to menu item
- Logout is immediate -- no confirmation dialog (SSO re-login is easy)
- Logout triggers existing Cognito logout flow -> redirect to landing page (from Phase 27)
- Segmented toggle button [My | All] in the PageHeader actions area on the Projects page
- Only visible to admin users -- non-admins see no toggle
- Toggle state persisted via URL parameter (?view=all) -- bookmarkable, defaults to "My Projects" when no param
- "All Projects" view uses existing ownerLabel display on project cards (Phase 28) -- no visual changes needed
- Admin toggle only on Projects page -- Runs page stays scoped to user's projects

### Claude's Discretion
- Initials avatar color/styling
- Exact segmented toggle component implementation
- Mobile user menu placement (mobile-nav component)
- Loading states during logout redirect
- How to pass user info to the sidebar (server component -> client component data flow)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMIN-02 | Admin users can toggle between "My Projects" and "All Projects" views | Segmented toggle in PageHeader actions, URL param `?view=all`, `getAuthorizedProjects()` already supports admin view -- needs a `viewAll` parameter to control filtering |
| UX-01 | Header displays user name/email from Okta with a user menu | User info section in sidebar bottom with DropdownMenu, initials avatar, name display; data flows from authenticated layout server component via props |
| UX-02 | User menu includes logout option | DropdownMenuItem with LogOut icon, navigates to `/api/auth/logout` route (already exists) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dropdown-menu | 2.1.16 | User menu dropdown | Already installed and wrapped in `components/ui/dropdown-menu.tsx` |
| lucide-react | (installed) | Icons: User, LogOut, ChevronDown, PanelLeftClose | Already used throughout the app |
| next/navigation | (Next.js) | useSearchParams, useRouter for URL param toggle | Standard Next.js navigation hooks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | (installed) | Badge variant styling | Already used by Badge component for admin indicator |
| @radix-ui/react-tooltip | (installed) | Tooltip on collapsed sidebar avatar | Already used in sidebar for collapsed nav items |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom segmented toggle | Radix ToggleGroup | ToggleGroup is not installed; a simple button pair with active styling is sufficient and avoids a new dependency |
| URL param for toggle state | localStorage | URL param is bookmarkable and shareable, per user decision |

## Architecture Patterns

### Recommended Data Flow
```
app/(authenticated)/layout.tsx  (server component)
  └── calls getCurrentUser() to get UserInfo
  └── calls isAdmin(user.email) to get admin flag
  └── passes { user, isAdmin } to AppShell

components/layout/app-shell.tsx  (client component)
  └── receives userInfo and isAdmin as props
  └── passes to Sidebar and MobileNav

components/layout/sidebar.tsx  (client component)
  └── receives userInfo, isAdmin, collapsed, onToggle
  └── renders UserMenu at bottom (replacing collapse toggle button)

components/layout/user-menu.tsx  (new client component)
  └── receives userInfo, isAdmin, collapsed, onToggle
  └── renders initials avatar + dropdown menu
```

### Pattern 1: Server-to-Client User Data Prop Drilling
**What:** The authenticated layout is a server component that can call `getCurrentUser()`. It passes user data as serializable props to AppShell (client component), which distributes to children.
**When to use:** When server-only auth data needs to reach client UI components.
**Example:**
```typescript
// app/(authenticated)/layout.tsx
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";
import { AppShell } from "@/components/layout/app-shell";

export default async function AuthenticatedLayout({ children }) {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);

  return (
    <AppShell user={user} isAdmin={admin}>
      <main id="main-content" role="main" className="min-h-screen">
        {children}
      </main>
    </AppShell>
  );
}
```

### Pattern 2: URL Search Param Toggle (Projects Page)
**What:** The admin toggle sets `?view=all` URL parameter. The server component reads this via `searchParams` prop and passes it to `getAuthorizedProjects()`.
**When to use:** When toggle state should be bookmarkable and survive page refreshes.
**Example:**
```typescript
// app/(authenticated)/projects/page.tsx
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const viewAll = params.view === "all";
  const { projects, user, isAdmin } = await getAuthorizedProjects(viewAll);
  // ...
}
```

### Pattern 3: Initials Avatar Generation
**What:** Extract first letter of first and last name from UserInfo.name, or fall back to first two letters of email.
**When to use:** For the avatar circle in sidebar.
**Example:**
```typescript
function getInitials(name: string, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}
```

### Anti-Patterns to Avoid
- **Do NOT use useEffect to fetch user data on the client:** The user info is available server-side in the session. Fetching it client-side creates a flash of empty content and an unnecessary API call.
- **Do NOT store admin toggle state in localStorage:** The user explicitly decided URL params for bookmarkability.
- **Do NOT create a separate API route for user info:** Pass it as props from the server component layout.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown menu | Custom popover with click-outside handling | Existing `DropdownMenu` from `components/ui/dropdown-menu.tsx` (Radix) | Accessibility, focus management, positioning handled |
| Logout flow | Custom token clearing + redirect | Existing `/api/auth/logout` route | Already handles session destruction + Cognito logout redirect |
| Admin detection | Re-checking groups or email in client | Pass `isAdmin` boolean from server component | Single source of truth, no client-side auth logic |

**Key insight:** Every backend capability needed is already built. This phase is pure UI wiring.

## Common Pitfalls

### Pitfall 1: DropdownMenu inside collapsed sidebar positioning
**What goes wrong:** When sidebar is collapsed (w-16), the dropdown trigger is near the edge. The menu may render clipped or off-screen.
**Why it happens:** Radix DropdownMenu defaults to opening below the trigger.
**How to avoid:** Use `side="top"` and `align="start"` on DropdownMenuContent since the user menu is at the bottom of the sidebar. This opens the menu above the avatar.
**Warning signs:** Menu appears cut off or below the viewport.

### Pitfall 2: searchParams in Next.js App Router server components
**What goes wrong:** Forgetting that `searchParams` is a Promise in Next.js 15+ App Router page components.
**Why it happens:** Next.js changed `searchParams` from sync to async in recent versions.
**How to avoid:** Always `await searchParams` in the page component: `const params = await searchParams;`
**Warning signs:** Type error or runtime error accessing `.view` on a Promise.

### Pitfall 3: Sidebar collapse toggle moving to menu
**What goes wrong:** The collapse toggle button at the sidebar bottom gets removed but collapse functionality breaks because `onToggle` is no longer called.
**Why it happens:** Forgetting to wire `onToggle` into the dropdown menu item.
**How to avoid:** The "Collapse sidebar" menu item must call the same `onToggle` callback that the current button uses.
**Warning signs:** Sidebar no longer collapses/expands.

### Pitfall 4: Serialization of user data across server/client boundary
**What goes wrong:** Passing non-serializable objects (like Date) through the server-client boundary causes hydration errors.
**Why it happens:** `UserInfo` contains only strings and string arrays, so this is not an issue here. But if additional session data were passed, it could be.
**How to avoid:** Only pass `UserInfo` (sub, email, name, groups) and a boolean `isAdmin` -- all serializable.
**Warning signs:** Hydration mismatch warnings in console.

### Pitfall 5: getAuthorizedProjects currently always returns all projects for admin
**What goes wrong:** Currently `getAuthorizedProjects()` has no parameter to control whether admin sees all or just their own. It always returns all for admin users.
**Why it happens:** Phase 28 implemented admin-sees-all as the default behavior.
**How to avoid:** Add a `viewAll?: boolean` parameter. When `viewAll` is false (or admin is false), filter by `userId`. This way the default "My Projects" view works for admins too.
**Warning signs:** Admin always sees all projects even when toggle is on "My."

## Code Examples

### Existing Components to Modify

#### 1. getAuthorizedProjects -- add viewAll parameter
```typescript
// lib/auth/authorization.ts -- modify existing function
export async function getAuthorizedProjects(viewAll: boolean = false) {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);
  // Only show all projects when admin AND viewAll is true
  const where = (admin && viewAll) ? {} : { userId: user.email };

  const projects = await db.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { uploads: true, cards: true, epics: true, runs: true },
      },
    },
  });

  return { projects, user, isAdmin: admin };
}
```

#### 2. UserMenu component (new)
```typescript
// components/layout/user-menu.tsx
"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LogOut, PanelLeftClose, PanelLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { UserInfo } from "@/lib/auth/types";

interface UserMenuProps {
  user: UserInfo;
  isAdmin: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

function getInitials(name: string, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu({ user, isAdmin, collapsed, onToggle }: UserMenuProps) {
  const initials = getInitials(user.name, user.email);

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const avatar = (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium shrink-0">
      {initials}
    </div>
  );

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        className={cn(
          "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
          "hover:bg-sidebar-accent text-sidebar-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          collapsed ? "justify-center" : "justify-start"
        )}
      >
        {avatar}
        {!collapsed && (
          <span className="truncate font-medium">{user.name || user.email}</span>
        )}
      </button>
    </DropdownMenuTrigger>
  );

  return (
    <div className="border-t border-sidebar-border p-3">
      <DropdownMenu>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right">{user.name || user.email}</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user.name}
                {isAdmin && (
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                    Admin
                  </Badge>
                )}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onToggle}>
            {collapsed ? (
              <PanelLeft className="mr-2 h-4 w-4" />
            ) : (
              <PanelLeftClose className="mr-2 h-4 w-4" />
            )}
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

#### 3. Admin Toggle (segmented) component
```typescript
// components/projects/admin-view-toggle.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function AdminViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAll = searchParams.get("view") === "all";

  const handleToggle = (viewAll: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (viewAll) {
      params.set("view", "all");
    } else {
      params.delete("view");
    }
    router.push(`/projects?${params.toString()}`);
  };

  return (
    <div className="inline-flex rounded-lg border bg-muted p-0.5" role="group">
      <button
        onClick={() => handleToggle(false)}
        className={cn(
          "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
          !isAll
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        My
      </button>
      <button
        onClick={() => handleToggle(true)}
        className={cn(
          "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
          isAll
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        All
      </button>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `searchParams` as sync object | `searchParams` as Promise (Next.js 15+) | Next.js 15 | Must `await searchParams` in page components |
| Separate header component for user | Sidebar-integrated user section | Phase 29 decision | User info at sidebar bottom, not page header |

## Open Questions

1. **Mobile nav user menu placement**
   - What we know: Mobile nav uses a Sheet (slide-out) component with hamburger trigger
   - What's unclear: Where exactly user info should go in the mobile nav -- bottom of the sheet or as a separate element in the mobile header bar
   - Recommendation: Add user avatar + menu at bottom of the Sheet content (matches sidebar pattern). On the mobile header bar itself, no user info needed since it is cramped.

2. **Loading state during logout redirect**
   - What we know: Logout navigates to `/api/auth/logout` which destroys session and redirects to Cognito logout then back to landing page
   - What's unclear: Whether to show a loading spinner or disable the menu during redirect
   - Recommendation: Simple `window.location.href` redirect is fast enough; no loading state needed. The page will naturally show browser loading indicator.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `vitest.config.mts`) |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-02 | getAuthorizedProjects respects viewAll param | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -x` | No -- Wave 0 |
| UX-01 | getInitials generates correct initials from name/email | unit | `npx vitest run components/layout/__tests__/user-menu.test.ts -x` | No -- Wave 0 |
| UX-02 | Logout menu item navigates to /api/auth/logout | manual-only | N/A -- requires browser interaction | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `lib/auth/__tests__/authorization.test.ts` -- unit test for `getAuthorizedProjects(viewAll)` parameter behavior (covers ADMIN-02)
- [ ] `components/layout/__tests__/user-menu.test.ts` -- unit test for `getInitials()` helper function (covers UX-01)
- [ ] Note: Vitest config `include` pattern is `**/*.test.ts` and environment is `node` -- component rendering tests would need `jsdom` environment override or a separate config. Pure logic tests (getInitials, getAuthorizedProjects) work fine.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `components/layout/sidebar.tsx`, `components/layout/app-shell.tsx`, `app/(authenticated)/layout.tsx`, `lib/auth/authorization.ts`, `lib/auth/types.ts`, `app/api/auth/logout/route.ts`
- Codebase analysis: `components/ui/dropdown-menu.tsx` (Radix wrapper), `components/ui/badge.tsx`, `components/layout/page-header.tsx`
- Codebase analysis: `app/(authenticated)/projects/page.tsx`, `components/projects/project-card.tsx` (ownerLabel already supported)

### Secondary (MEDIUM confidence)
- Next.js App Router `searchParams` as Promise -- based on Next.js 15 conventions observed in existing project patterns

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use
- Architecture: HIGH -- patterns follow existing codebase conventions exactly
- Pitfalls: HIGH -- identified from direct code inspection of current implementation

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external dependency changes expected)
