"use server";

import { db } from "@/lib/db";
import { getAuthorizedProject } from "@/lib/auth/authorization";

export async function getEpic(id: string) {
  // Look up epic's project for ownership check
  const epicCheck = await db.epic.findUnique({ where: { id }, select: { projectId: true } });
  if (!epicCheck) return null;
  try { await getAuthorizedProject(epicCheck.projectId); } catch { return null; }

  return db.epic.findUnique({
    where: { id },
    include: {
      project: true,
      stories: {
        include: {
          _count: {
            select: { subtasks: true }
          }
        },
        orderBy: { code: "asc" },
      },
    },
  });
}

export async function getEpicsForProject(projectId: string) {
  await getAuthorizedProject(projectId);

  return db.epic.findMany({
    where: { projectId },
    orderBy: { priority: "asc" },
    include: {
      _count: { select: { stories: true } },
    },
  });
}

export async function getEpicWithStories(epicId: string) {
  // Look up epic's project for ownership check
  const epicCheck = await db.epic.findUnique({ where: { id: epicId }, select: { projectId: true } });
  if (!epicCheck) return null;
  try { await getAuthorizedProject(epicCheck.projectId); } catch { return null; }

  return db.epic.findUnique({
    where: { id: epicId },
    include: {
      stories: {
        orderBy: { code: "asc" },
      },
      project: true,
    },
  });
}
