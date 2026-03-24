# Phase 32: Share Management - Research

**Researched:** 2026-03-24
**Domain:** UI dialogs, combobox/autocomplete, Prisma CRUD, server actions, role-based access
**Confidence:** HIGH

## Summary

Phase 32 adds owner-facing share management: a share dialog on the project detail page, a user search combobox, role assignment/change, and access removal. The data model (User, ProjectShare) and authorization infrastructure (getAuthorizedProject returning role/canEdit/isAdmin) are fully in place from Phases 30-31. This phase is purely UI + server actions + Prisma queries.

The main technical challenge is the user picker combobox -- no Command or Combobox component exists in the project yet. The recommended approach is adding the shadcn/ui Command component (backed by `cmdk`) plus a Popover, which is the established shadcn combobox pattern. This fits the existing Radix-based stack. All other UI needs (Dialog, AlertDialog, Select, toast, loading states) are already present and proven.

**Primary recommendation:** Use shadcn/ui Command + Popover for the user picker combobox. Use server actions for all share mutations (not API routes). Follow the create-project-dialog pattern for dialog structure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Share button lives in the project detail page header, next to project name/actions. Not on project cards.
- **D-02:** Share UI opens as a Radix Dialog (modal), reusing the existing dialog pattern from create-project-dialog.
- **D-03:** Users are added one at a time. After adding, the dialog stays open so the owner can add more. No batch multi-user selection.
- **D-04:** Search-as-you-type combobox with dropdown results. Queries the local User table (only users who have logged in before).
- **D-05:** Search matches against both email and display name fields.
- **D-06:** Each result row shows display name as primary text and email as secondary text. Falls back to email-only when no display name exists (per Phase 30 D-04).
- **D-07:** No Combobox/Command component exists yet -- one must be added (shadcn/ui cmdk pattern or similar).
- **D-08:** Default role when sharing is editor (not viewer). Owner explicitly downgrades to viewer if needed.
- **D-09:** Role changes for existing shares use an inline dropdown/toggle next to each user in the share list. Changes take effect immediately (no separate save step).
- **D-10:** Removing a user's access requires a confirmation dialog before executing. Prevents accidental unshares.
- **D-11:** Only project owners and admins can open the share dialog and manage collaborators. Editors and viewers cannot share.
- **D-12:** Share button is hidden (not rendered) for non-owners. No disabled state or tooltip -- clean absence.
- **D-13:** Access gating uses the `role` field from `getAuthorizedProject` return (Phase 31 D-11). Owner role = show button, admin role = show button, editor/viewer = hide.

### Claude's Discretion
- Exact combobox component choice (shadcn/ui Command, cmdk, or custom) -- pick what fits the existing stack best
- Debounce timing for search-as-you-type queries
- Server action vs API route for user search endpoint
- Whether the share dialog shows the current user (owner) in the collaborator list or omits them
- Toast messaging for share/unshare/role-change success/error feedback
- Empty state when no users are shared yet (likely a simple message)
- Whether to exclude users already shared from search results

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHARE-01 | User can share their project with one or more existing users via a share dialog | Share dialog component (D-02), user picker combobox (D-04/D-07), shareProject server action, PageHeader actions slot integration |
| SHARE-02 | User can search for other users by email or name when sharing (user picker) | Command + Popover combobox pattern, searchUsers server action with Prisma `contains` query on User.email and User.name, debounced input |
| SHARE-03 | User can remove a share or change a shared user's role (viewer/editor) | Inline Select for role change (D-09), AlertDialog for remove confirmation (D-10), updateShareRole and removeShare server actions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cmdk | 1.1.1 | Command menu / combobox engine | Powers shadcn/ui Command component, handles fuzzy search + keyboard nav |
| @radix-ui/react-popover | 1.1.15 | Popover container for combobox dropdown | Required for shadcn/ui combobox pattern (Command inside Popover) |
| @radix-ui/react-dialog | 1.1.15 | Share dialog modal | Already installed, existing pattern |
| @radix-ui/react-alert-dialog | 1.1.15 | Remove-access confirmation | Already installed, existing component |
| @radix-ui/react-select | 2.2.6 | Role dropdown (editor/viewer) | Already installed, existing component |
| sonner | 2.0.7 | Toast notifications | Already installed, existing pattern |
| @prisma/client | 7.2.0 | Database queries | Already installed |

### New Dependencies to Install
| Library | Version | Purpose |
|---------|---------|---------|
| cmdk | 1.1.1 | Command menu primitive for user search combobox |
| @radix-ui/react-popover | 1.1.15 | Popover wrapper for combobox dropdown |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cmdk + Popover | shadcn/ui v4 native Combobox (Base UI) | Project is fully Radix-based; switching to Base UI for one component introduces inconsistency |
| cmdk + Popover | Custom input + dropdown | Loses keyboard navigation, fuzzy search, accessibility; violates "don't hand-roll" |
| Server action for search | API route (GET /api/users/search) | Server actions are the project pattern; API routes add unnecessary routing complexity for a simple query |

**Installation:**
```bash
npm install cmdk@1.1.1 @radix-ui/react-popover@1.1.15
```

Then add shadcn/ui components:
```bash
npx shadcn@latest add command popover
```

## Architecture Patterns

### Recommended Project Structure
```
components/
  ui/
    command.tsx          # NEW: shadcn/ui Command component (from cmdk)
    popover.tsx          # NEW: shadcn/ui Popover component
  projects/
    share-dialog.tsx     # NEW: Main share dialog (owner-only)
    share-user-list.tsx  # NEW: List of current shares with role/remove controls
    user-search.tsx      # NEW: User search combobox (Command + Popover)
server/
  actions/
    shares.ts            # NEW: shareProject, removeShare, updateShareRole, searchUsers
```

### Pattern 1: Share Dialog (Radix Dialog, controlled open state)
**What:** Modal dialog for managing project shares. Contains user search combobox at top, list of current shares below.
**When to use:** Triggered by Share button in project page header.
**Example:**
```typescript
// Follows create-project-dialog.tsx pattern exactly
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareDialogProps {
  projectId: string;
  // role comes from getAuthorizedProject in the server component
}

export function ShareDialog({ projectId }: ShareDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Dialog stays open after adding users (D-03)
  // On close, refresh to pick up changes
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) router.refresh();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
        </DialogHeader>
        {/* UserSearch combobox + ShareUserList go here */}
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 2: User Search Combobox (Command + Popover)
**What:** Search-as-you-type input that queries local User table, shows matching users in a dropdown.
**When to use:** Inside the share dialog, for finding users to add.
**Example:**
```typescript
"use client";
import { useState, useEffect } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface UserSearchResult {
  id: string;
  email: string;
  name: string | null;
}

interface UserSearchProps {
  projectId: string;
  onSelect: (user: UserSearchResult) => void;
  excludeUserIds?: string[]; // Already-shared users to exclude
}

export function UserSearch({ projectId, onSelect, excludeUserIds = [] }: UserSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced search - 300ms delay
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const users = await searchUsers(query, projectId, excludeUserIds);
      setResults(users);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, projectId, excludeUserIds]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-muted-foreground">
          Search users by name or email...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command shouldFilter={false}> {/* Server-side filtering */}
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search..." />
          <CommandList>
            <CommandEmpty>{loading ? "Searching..." : "No users found."}</CommandEmpty>
            <CommandGroup>
              {results.map((user) => (
                <CommandItem key={user.id} value={user.id} onSelect={() => {
                  onSelect(user);
                  setQuery("");
                  setOpen(false);
                }}>
                  <div>
                    <div className="font-medium">{user.name || user.email}</div>
                    {user.name && <div className="text-sm text-muted-foreground">{user.email}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Pattern 3: Server Actions for Share CRUD
**What:** Four server actions: searchUsers, shareProject, updateShareRole, removeShare.
**When to use:** All share operations go through server actions (project convention).
**Example:**
```typescript
"use server";
import { db } from "@/lib/db";
import { getAuthorizedProject } from "@/lib/auth/authorization";
import { revalidatePath } from "next/cache";

export async function searchUsers(query: string, projectId: string, excludeUserIds: string[]) {
  // Authorization: caller must have access to the project
  await getAuthorizedProject(projectId);

  return db.user.findMany({
    where: {
      AND: [
        { id: { notIn: excludeUserIds } },
        {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: { id: true, email: true, name: true },
    take: 10,
  });
}

export async function shareProject(projectId: string, userId: string, role: "editor" | "viewer" = "editor") {
  const { role: callerRole } = await getAuthorizedProject(projectId);
  if (callerRole !== "owner" && callerRole !== "admin") {
    return { success: false, error: "Only owners can share projects" };
  }

  await db.projectShare.create({
    data: { projectId, userId, role },
  });
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function updateShareRole(shareId: string, role: "editor" | "viewer") {
  const share = await db.projectShare.findUnique({ where: { id: shareId } });
  if (!share) return { success: false, error: "Share not found" };

  const { role: callerRole } = await getAuthorizedProject(share.projectId);
  if (callerRole !== "owner" && callerRole !== "admin") {
    return { success: false, error: "Only owners can modify shares" };
  }

  await db.projectShare.update({ where: { id: shareId }, data: { role } });
  revalidatePath(`/projects/${share.projectId}`);
  return { success: true };
}

export async function removeShare(shareId: string) {
  const share = await db.projectShare.findUnique({ where: { id: shareId } });
  if (!share) return { success: false, error: "Share not found" };

  const { role: callerRole } = await getAuthorizedProject(share.projectId);
  if (callerRole !== "owner" && callerRole !== "admin") {
    return { success: false, error: "Only owners can remove shares" };
  }

  await db.projectShare.delete({ where: { id: shareId } });
  revalidatePath(`/projects/${share.projectId}`);
  return { success: true };
}
```

### Pattern 4: Inline Role Change with Select
**What:** Each shared user row has a Select dropdown to change role. Changes fire immediately.
**Example:**
```typescript
<Select
  value={share.role}
  onValueChange={async (newRole) => {
    const result = await updateShareRole(share.id, newRole as "editor" | "viewer");
    if (result.success) {
      toast.success("Role updated");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update role");
    }
  }}
>
  <SelectTrigger className="w-[100px]" size="sm">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="editor">Editor</SelectItem>
    <SelectItem value="viewer">Viewer</SelectItem>
  </SelectContent>
</Select>
```

### Pattern 5: Conditional Share Button in Page Header (Server Component)
**What:** Project detail page (server component) passes role to the actions slot. Share button renders only for owner/admin.
**Example:**
```typescript
// In app/(authenticated)/projects/[id]/page.tsx
import { getAuthorizedProject } from "@/lib/auth/authorization";
import { ShareDialog } from "@/components/projects/share-dialog";

// Replace getProject with getAuthorizedProject to get role
const { project, role } = await getAuthorizedProject(id);

// In PageHeader actions prop:
actions={
  <div className="flex items-center gap-2">
    {(role === "owner" || role === "admin") && (
      <ShareDialog projectId={project.id} />
    )}
    <ExportProjectButton projectId={project.id} hasEpics={project._count.epics > 0} />
  </div>
}
```

### Anti-Patterns to Avoid
- **Querying Cognito ListUsers API:** Decision D-04 locks us to the local User table. Cognito has rate limits and no FK relationship.
- **Building a custom autocomplete from scratch:** cmdk handles keyboard nav, ARIA attributes, fuzzy search. Hand-rolling loses all of this.
- **Using API routes for share operations:** Project convention is server actions for mutations. Consistency matters.
- **Showing share button in disabled state for non-owners:** D-12 says hidden, not disabled.
- **Rendering shares inside getProject query:** Keep share queries in the share dialog component to avoid bloating the main project query.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Autocomplete/combobox | Custom input + dropdown + keyboard handling | cmdk + shadcn Command | Keyboard navigation, ARIA, fuzzy search, focus management |
| Popover positioning | Manual position calculation | @radix-ui/react-popover | Handles viewport edges, scroll, resize, z-index |
| Confirmation dialog | Custom modal for remove confirmation | AlertDialog (already exists) | Accessible, blocks background interaction, standard pattern |
| Debounced search | Custom debounce utility | setTimeout in useEffect (simple enough) or useDeferredValue | For 300ms debounce, a useEffect timer is fine; no library needed |
| Role validation | Custom string checks | Zod schema for "editor" | "viewer" | Type-safe at runtime, matches project pattern |

**Key insight:** The combobox is the only genuinely complex UI piece. Everything else reuses existing components (Dialog, AlertDialog, Select, Button, toast).

## Common Pitfalls

### Pitfall 1: Owner Can Share With Themselves
**What goes wrong:** If the search results include the project owner, they could create a ProjectShare for themselves, creating a confusing duplicate access path.
**Why it happens:** The User table contains all users including the owner. No automatic exclusion.
**How to avoid:** In searchUsers, exclude the project owner (by looking up Project.userId email -> User.id) from results. Also exclude the current user's User.id from the search.
**Warning signs:** ProjectShare record where userId maps to the same email as Project.userId.

### Pitfall 2: Stale Share List After Mutation
**What goes wrong:** After adding/removing a share, the dialog's share list doesn't update.
**Why it happens:** Server actions revalidatePath only refreshes the server component tree. Client components inside the dialog need local state refresh.
**How to avoid:** After each mutation, re-fetch the share list within the dialog (either via a dedicated server action or by maintaining local state optimistically and refreshing). Use `router.refresh()` in combination with re-fetching dialog data.
**Warning signs:** User adds a share but it doesn't appear in the list until dialog is closed and reopened.

### Pitfall 3: cmdk shouldFilter Conflict With Server Search
**What goes wrong:** cmdk does client-side filtering by default. If the server already filters results, double-filtering produces empty/wrong results.
**Why it happens:** cmdk's built-in fuzzy search runs on CommandItem values.
**How to avoid:** Set `shouldFilter={false}` on the Command component when doing server-side search. This disables cmdk's built-in filtering.
**Warning signs:** Search results disappear even though the server returned matching users.

### Pitfall 4: Race Condition in Debounced Search
**What goes wrong:** Fast typing triggers multiple concurrent search requests. An older, slower request returns after a newer one, overwriting results.
**Why it happens:** Each keystroke schedules a new setTimeout; previous requests are cancelled but in-flight fetch responses are not.
**How to avoid:** Use an AbortController per request, or track a request ID and discard stale responses.
**Warning signs:** Flickering search results that don't match the current query.

### Pitfall 5: Missing Unique Constraint Handling on Duplicate Share
**What goes wrong:** Trying to share a project with a user who already has access throws a Prisma unique constraint error.
**Why it happens:** ProjectShare has @@unique([projectId, userId]). A duplicate create call fails.
**How to avoid:** Either (a) exclude already-shared users from search results, or (b) use upsert instead of create, or (c) catch the P2002 error and return a friendly message.
**Warning signs:** Unhandled Prisma error in production logs.

### Pitfall 6: getProject Does Not Return Role
**What goes wrong:** Current project detail page calls `getProject(id)` which does NOT return the caller's role. The share button visibility check needs `role`.
**Why it happens:** `getProject` re-queries the database after authorization but strips the role from the return value.
**How to avoid:** Either (a) also call `getAuthorizedProject(id)` in the page to get the role separately, or (b) modify the page to use `getAuthorizedProject` for the role and `getProject` for the full data. The role is needed only for the header actions conditional rendering.
**Warning signs:** Share button always visible or never visible.

## Code Examples

### Fetching Current Shares for the Dialog
```typescript
// In server/actions/shares.ts
export async function getProjectShares(projectId: string) {
  const { role } = await getAuthorizedProject(projectId);
  if (role !== "owner" && role !== "admin") {
    return { success: false, error: "Only owners can view shares", shares: [] };
  }

  const shares = await db.projectShare.findMany({
    where: { projectId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return { success: true, shares };
}
```

### Remove Confirmation with AlertDialog
```typescript
// In share-user-list.tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
      <Trash2 className="h-4 w-4" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Remove Access</AlertDialogTitle>
      <AlertDialogDescription>
        Remove {user.name || user.email} from this project? They will lose all access.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom autocomplete | cmdk-based Command component | shadcn/ui since 2023 | Standard, accessible combobox pattern |
| Separate API routes for search | Server actions with "use server" | Next.js 14+ (2023) | Simpler, no route file needed |
| Callback-based state refresh | router.refresh() + revalidatePath | Next.js App Router | Server component tree re-renders automatically |

**Deprecated/outdated:**
- shadcn/ui v4 introduced a Base UI-based Combobox, but it is for Base UI stacks. This project uses Radix primitives throughout; cmdk + Popover is the correct Radix-compatible approach.

## Open Questions

1. **Should the owner appear in the share list?**
   - What we know: The owner is not stored in ProjectShare (ownership is via Project.userId). Showing the owner in the list would require synthesizing a fake entry.
   - What's unclear: Whether users expect to see the owner listed (like Google Docs shows the owner in the sharing panel).
   - Recommendation: Omit the owner from the share list. Show a note like "You are the owner" at the top of the dialog instead. Simpler and avoids confusion about "removing" the owner.

2. **Should already-shared users be excluded from search results?**
   - What we know: Excluding them prevents duplicate share attempts (Pitfall 5). Including them lets the owner see who they've already shared with.
   - Recommendation: Exclude already-shared users from search results. The share list below the search already shows who has access.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 |
| Config file | vitest.config.mts |
| Quick run command | `npx vitest run server/actions/__tests__/shares.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHARE-01 | shareProject creates ProjectShare record, rejects non-owner | unit | `npx vitest run server/actions/__tests__/shares.test.ts -t "shareProject"` | Wave 0 |
| SHARE-02 | searchUsers returns matching users by email/name, excludes owner | unit | `npx vitest run server/actions/__tests__/shares.test.ts -t "searchUsers"` | Wave 0 |
| SHARE-03a | updateShareRole changes role for existing share | unit | `npx vitest run server/actions/__tests__/shares.test.ts -t "updateShareRole"` | Wave 0 |
| SHARE-03b | removeShare deletes ProjectShare record, rejects non-owner | unit | `npx vitest run server/actions/__tests__/shares.test.ts -t "removeShare"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run server/actions/__tests__/shares.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/actions/__tests__/shares.test.ts` -- covers SHARE-01, SHARE-02, SHARE-03
- [ ] Mock pattern: follow `lib/auth/__tests__/authorization.test.ts` for mocking `server-only`, `@/lib/db`, `@/lib/auth`, `next/cache`

## Sources

### Primary (HIGH confidence)
- Project codebase: `prisma/schema.prisma` -- User, ProjectShare, Project models verified
- Project codebase: `lib/auth/authorization.ts` -- AuthResult interface, getAuthorizedProject, role resolution verified
- Project codebase: `server/actions/projects.ts` -- server action pattern verified
- Project codebase: `components/projects/create-project-dialog.tsx` -- dialog pattern verified
- Project codebase: `components/ui/alert-dialog.tsx` -- confirmation dialog verified
- Project codebase: `components/ui/select.tsx` -- Select component verified
- Project codebase: `app/(authenticated)/projects/[id]/page.tsx` -- PageHeader actions slot verified
- npm registry: cmdk@1.1.1, @radix-ui/react-popover@1.1.15 -- versions verified

### Secondary (MEDIUM confidence)
- [shadcn/ui Combobox docs](https://ui.shadcn.com/docs/components/radix/combobox) -- combobox pattern reference
- [shadcn/ui Command docs](https://ui.shadcn.com/docs/components/radix/command) -- Command component reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries either already installed or verified on npm; patterns proven in codebase
- Architecture: HIGH -- follows established dialog/server-action/Prisma patterns from existing code
- Pitfalls: HIGH -- derived from actual codebase analysis (e.g., getProject doesn't return role, cmdk shouldFilter default)

**Research date:** 2026-03-24
**Valid until:** 2026-04-23 (stable domain, no fast-moving dependencies)
