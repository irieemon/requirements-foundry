"use server";

import { db } from "@/lib/db";
import { getAuthorizedProject } from "@/lib/auth/authorization";
import { revalidatePath } from "next/cache";

/**
 * Search for users to share a project with.
 * Excludes the project owner and already-shared users.
 * Returns max 10 results. Requires at least 2 characters.
 */
export async function searchUsers(
  query: string,
  projectId: string,
  excludeUserIds: string[] = []
) {
  if (query.length < 2) return [];

  // Look up project to get owner email
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) return [];

  // Look up owner's User record to get their User.id
  const ownerUser = await db.user.findUnique({
    where: { email: project.userId },
    select: { id: true },
  });

  // Build exclude list: passed IDs + owner
  const excludeIds = [...excludeUserIds];
  if (ownerUser) {
    excludeIds.push(ownerUser.id);
  }

  const users = await db.user.findMany({
    where: {
      AND: [
        { id: { notIn: excludeIds } },
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

  return users;
}

/**
 * Share a project with a user. Defaults to "editor" role.
 * Only project owners and admins can share.
 */
export async function shareProject(
  projectId: string,
  userId: string,
  role: "editor" | "viewer" = "editor"
) {
  const auth = await getAuthorizedProject(projectId);

  if (auth.role !== "owner" && auth.role !== "admin") {
    return { success: false, error: "Only owners can share projects" };
  }

  try {
    await db.projectShare.create({
      data: { projectId, userId, role },
    });
  } catch (error: unknown) {
    // Handle duplicate share (unique constraint on [projectId, userId])
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return { success: false, error: "User already has access to this project" };
    }
    throw error;
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/**
 * Update the role of an existing share.
 * Only project owners and admins can modify shares.
 */
export async function updateShareRole(
  shareId: string,
  role: "editor" | "viewer"
) {
  const share = await db.projectShare.findUnique({
    where: { id: shareId },
  });

  if (!share) {
    return { success: false, error: "Share not found" };
  }

  const auth = await getAuthorizedProject(share.projectId);

  if (auth.role !== "owner" && auth.role !== "admin") {
    return { success: false, error: "Only owners can modify shares" };
  }

  await db.projectShare.update({
    where: { id: shareId },
    data: { role },
  });

  revalidatePath(`/projects/${share.projectId}`);
  return { success: true };
}

/**
 * Remove a share (revoke access).
 * Only project owners and admins can remove shares.
 */
export async function removeShare(shareId: string) {
  const share = await db.projectShare.findUnique({
    where: { id: shareId },
  });

  if (!share) {
    return { success: false, error: "Share not found" };
  }

  const auth = await getAuthorizedProject(share.projectId);

  if (auth.role !== "owner" && auth.role !== "admin") {
    return { success: false, error: "Only owners can remove shares" };
  }

  await db.projectShare.delete({
    where: { id: shareId },
  });

  revalidatePath(`/projects/${share.projectId}`);
  return { success: true };
}

/**
 * Get all shares for a project with user details.
 * Only project owners and admins can view shares.
 */
export async function getProjectShares(projectId: string) {
  const auth = await getAuthorizedProject(projectId);

  if (auth.role !== "owner" && auth.role !== "admin") {
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
