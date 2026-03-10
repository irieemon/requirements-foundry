import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "./index";
import { db } from "@/lib/db";

export const ADMIN_EMAIL = "sean.mcinerney@merkle.com";

export function isAdmin(email: string): boolean {
  return email === ADMIN_EMAIL;
}

/**
 * Get a project by ID with ownership verification.
 * Returns the project if the current user owns it or is admin.
 * Calls notFound() if unauthorized (returns 404, not 403 -- don't leak existence).
 */
export async function getAuthorizedProject(projectId: string) {
  const user = await getCurrentUser();
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    notFound();
  }

  if (project.userId !== user.email && !isAdmin(user.email)) {
    notFound();
  }

  return { project, user, isAdmin: isAdmin(user.email) };
}

/**
 * Get all projects for the current user (or all projects for admin).
 * Matches the orderBy and _count include from getProjects() in server/actions/projects.ts.
 */
export async function getAuthorizedProjects() {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);
  const where = admin ? {} : { userId: user.email };

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
