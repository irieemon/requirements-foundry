import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "./index";
import { db } from "@/lib/db";
import type { UserInfo } from "./types";
import type { Project, Run } from "@prisma/client";

export const ADMIN_EMAIL = "sean.mcinerney@merkle.com";

export type ProjectRole = "admin" | "owner" | "editor" | "viewer";

export interface AuthResult {
  project: Project;
  user: UserInfo;
  role: ProjectRole;
  canEdit: boolean;
  isAdmin: boolean;
}

export interface AuthResultWithEntity<T> extends AuthResult {
  entity: T;
}

export function isAdmin(email: string): boolean {
  return email === ADMIN_EMAIL;
}

/**
 * Resolve the highest applicable role for a user on a project.
 * Priority: admin > owner > editor > viewer > null (no access).
 */
export function resolveRole(params: {
  isAdmin: boolean;
  isOwner: boolean;
  shareRole?: "editor" | "viewer";
}): ProjectRole | null {
  if (params.isAdmin) return "admin";
  if (params.isOwner) return "owner";
  if (params.shareRole === "editor") return "editor";
  if (params.shareRole === "viewer") return "viewer";
  return null;
}

/**
 * Get a project by ID with role-based authorization.
 * Looks up User record by email to check ProjectShare records.
 * Returns enriched AuthResult with role, canEdit, isAdmin.
 * Calls notFound() if unauthorized (returns 404, not 403 -- don't leak existence).
 */
export async function getAuthorizedProject(projectId: string): Promise<AuthResult> {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);

  // Look up User record by email to get User.id for share lookup
  const dbUser = await db.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });

  // Fetch project with conditional shares include
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: dbUser
      ? {
          shares: {
            where: { userId: dbUser.id },
            select: { role: true },
            take: 1,
          },
        }
      : undefined,
  });

  if (!project) {
    notFound();
  }

  // Resolve role: admin > owner > editor > viewer > none
  const role = resolveRole({
    isAdmin: admin,
    isOwner: project.userId === user.email,
    shareRole: (project as Record<string, unknown>).shares
      ? ((project as Record<string, unknown>).shares as Array<{ role: string }>)?.[0]
          ?.role as "editor" | "viewer" | undefined
      : undefined,
  });

  if (!role) {
    notFound(); // No access at all -> 404
  }

  // Strip shares from returned project to prevent data leakage
  const { shares: _shares, ...projectWithoutShares } = project as typeof project & {
    shares?: unknown;
  };

  return {
    project: projectWithoutShares as Project,
    user,
    role,
    canEdit: role !== "viewer",
    isAdmin: admin,
  };
}

/**
 * Get all projects for the current user (or all projects for admin with viewAll).
 * Includes owned projects and shared projects with per-project roles.
 */
export async function getAuthorizedProjects(viewAll: boolean = false) {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);

  // Admin with viewAll: return everything with 'admin' role
  if (admin && viewAll) {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { uploads: true, cards: true, epics: true, runs: true },
        },
      },
    });
    return {
      ownedProjects: projects.map((p) => ({ ...p, role: "admin" as ProjectRole })),
      sharedProjects: [] as Array<(typeof projects)[0] & { role: ProjectRole; ownerName: string }>,
      user,
      isAdmin: true,
    };
  }

  // Look up User.id for share lookup
  const dbUser = await db.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });

  // Two queries merged: owned projects + shared projects
  const [ownedProjects, sharedProjects] = await Promise.all([
    db.project.findMany({
      where: { userId: user.email },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { uploads: true, cards: true, epics: true, runs: true },
        },
      },
    }),
    dbUser
      ? db.project.findMany({
          where: {
            shares: { some: { userId: dbUser.id } },
            userId: { not: user.email }, // Exclude owned (already in first query)
          },
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: { uploads: true, cards: true, epics: true, runs: true },
            },
            shares: {
              where: { userId: dbUser.id },
              select: { role: true },
              take: 1,
            },
          },
        })
      : [],
  ]);

  const annotatedOwned = ownedProjects.map((p) => ({
    ...p,
    role: (admin ? "admin" : "owner") as ProjectRole,
  }));

  // Batch-fetch owner names for shared projects (per D-09)
  const ownerEmails = [...new Set(sharedProjects.map((p) => p.userId))];
  const owners =
    ownerEmails.length > 0
      ? await db.user.findMany({
          where: { email: { in: ownerEmails } },
          select: { email: true, name: true },
        })
      : [];
  const ownerMap = new Map(owners.map((o) => [o.email, o.name || o.email]));

  const annotatedShared = sharedProjects.map((p) => {
    const { shares: _shares, ...rest } = p as typeof p & {
      shares?: Array<{ role: string }>;
    };
    return {
      ...rest,
      role: ((p as typeof p & { shares?: Array<{ role: string }> }).shares?.[0]
        ?.role || "viewer") as ProjectRole,
      ownerName: ownerMap.get(p.userId) || p.userId, // D-10: fallback to email
    };
  });

  return {
    ownedProjects: annotatedOwned,
    sharedProjects: annotatedShared,
    user,
    isAdmin: admin,
  };
}

/**
 * Get a run by ID with authorization on its parent project.
 * Returns the run as entity plus full AuthResult for the parent project.
 */
export async function getAuthorizedRun(runId: string): Promise<AuthResultWithEntity<Run>> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: { project: true },
  });

  if (!run) {
    notFound();
  }

  const auth = await getAuthorizedProject(run.projectId);
  return { ...auth, entity: run };
}
