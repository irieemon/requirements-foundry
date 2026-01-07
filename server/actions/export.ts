"use server";

import { db } from "@/lib/db";
import { exportToJiraCSV } from "@/lib/export/jira-csv";
import { exportProjectToJSON } from "@/lib/export/json-export";

export async function exportProjectAsCSV(projectId: string) {
  const epics = await db.epic.findMany({
    where: { projectId },
    orderBy: { priority: "asc" },
    include: {
      stories: {
        orderBy: { code: "asc" },
      },
    },
  });

  const csv = exportToJiraCSV(epics);
  return csv;
}

export async function exportProjectAsJSON(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const uploads = await db.upload.findMany({
    where: { projectId },
    include: { cards: true },
  });

  const cards = await db.card.findMany({
    where: { projectId },
  });

  const epics = await db.epic.findMany({
    where: { projectId },
    include: { stories: true },
  });

  const json = exportProjectToJSON(project, uploads, cards, epics);
  return JSON.stringify(json, null, 2);
}

export async function exportEpicAsCSV(epicId: string) {
  const epic = await db.epic.findUnique({
    where: { id: epicId },
    include: {
      stories: {
        orderBy: { code: "asc" },
      },
    },
  });

  if (!epic) {
    throw new Error("Epic not found");
  }

  const csv = exportToJiraCSV([epic]);
  return csv;
}
