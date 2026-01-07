"use server";

import { db } from "@/lib/db";

export async function getEpic(id: string) {
  return db.epic.findUnique({
    where: { id },
    include: {
      project: true,
      stories: {
        orderBy: { code: "asc" },
      },
    },
  });
}

export async function getEpicsForProject(projectId: string) {
  return db.epic.findMany({
    where: { projectId },
    orderBy: { priority: "asc" },
    include: {
      _count: { select: { stories: true } },
    },
  });
}

export async function getEpicWithStories(epicId: string) {
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
