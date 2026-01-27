// ═══════════════════════════════════════════════════════════════
// DATA EXTRACTOR
// Extracts data from database based on export scope
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { ExportScope, ExtractedData, EpicWithRelations, EpicOption } from "./types";

// ─────────────────────────────────────────────────────────────────
// Main Extraction Function
// ─────────────────────────────────────────────────────────────────

export async function extractExportData(
  projectId: string,
  scope: ExportScope
): Promise<ExtractedData> {
  // First verify project exists
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) {
    throw new Error(`EEXTRACT001: Project not found: ${projectId}`);
  }

  // Build where clause based on scope
  const whereClause = buildWhereClause(projectId, scope);

  // Fetch epics with all relations (including MSS)
  const epics = await db.epic.findMany({
    where: whereClause,
    orderBy: [
      { priority: "asc" },
      { code: "asc" },
    ],
    include: {
      mssServiceArea: {
        include: { serviceLine: true },
      },
      stories: {
        orderBy: { code: "asc" },
        include: {
          mssServiceArea: {
            include: { serviceLine: true },
          },
          subtasks: {
            orderBy: { code: "asc" },
          },
        },
      },
    },
  });

  return {
    project,
    epics: epics as EpicWithRelations[],
  };
}

// ─────────────────────────────────────────────────────────────────
// Where Clause Builder
// ─────────────────────────────────────────────────────────────────

function buildWhereClause(
  projectId: string,
  scope: ExportScope
): { projectId: string; id?: { in: string[] }; runId?: string } {
  const baseWhere = { projectId };

  switch (scope.mode) {
    case "all":
      return baseWhere;

    case "selected":
      if (!scope.epicIds || scope.epicIds.length === 0) {
        throw new Error("ESCOPE001: Selected mode requires epicIds");
      }
      return {
        ...baseWhere,
        id: { in: scope.epicIds },
      };

    case "by-run":
      if (!scope.runId) {
        throw new Error("ESCOPE002: By-run mode requires runId");
      }
      return {
        ...baseWhere,
        runId: scope.runId,
      };

    default:
      return baseWhere;
  }
}

// ─────────────────────────────────────────────────────────────────
// Epic Options for Scope Selector
// ─────────────────────────────────────────────────────────────────

export async function getEpicOptions(projectId: string): Promise<EpicOption[]> {
  const epics = await db.epic.findMany({
    where: { projectId },
    orderBy: [
      { priority: "asc" },
      { code: "asc" },
    ],
    select: {
      id: true,
      code: true,
      title: true,
      _count: {
        select: {
          stories: true,
        },
      },
      stories: {
        select: {
          _count: {
            select: {
              subtasks: true,
            },
          },
        },
      },
    },
  });

  return epics.map((epic) => ({
    id: epic.id,
    code: epic.code,
    title: epic.title,
    storyCount: epic._count.stories,
    subtaskCount: epic.stories.reduce((sum, story) => sum + story._count.subtasks, 0),
  }));
}

// ─────────────────────────────────────────────────────────────────
// Quick Count Functions
// ─────────────────────────────────────────────────────────────────

export async function getQuickCounts(
  projectId: string,
  scope: ExportScope
): Promise<{ epicCount: number; storyCount: number; subtaskCount: number }> {
  const data = await extractExportData(projectId, scope);

  let storyCount = 0;
  let subtaskCount = 0;

  for (const epic of data.epics) {
    storyCount += epic.stories.length;
    for (const story of epic.stories) {
      subtaskCount += story.subtasks.length;
    }
  }

  return {
    epicCount: data.epics.length,
    storyCount,
    subtaskCount,
  };
}
