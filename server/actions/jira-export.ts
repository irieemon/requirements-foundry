"use server";

// ═══════════════════════════════════════════════════════════════
// JIRA EXPORT SERVER ACTIONS
// Server-side functions for the Jira export feature
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import {
  extractExportData,
  getEpicOptions,
  normalizeForExport,
  mapToJiraRows,
  validateExport,
  generateJiraCSV,
  generateInstructions,
  calculateStats,
  runExportPipeline,
} from "@/lib/export/jira";
import type {
  ExportScope,
  ExportConfig,
  ExportStats,
  ExportBundle,
  ExportPreview,
  RunOption,
  EpicOption,
  JiraExportRow,
  PreviewItem,
  FullPreviewData,
} from "@/lib/export/jira";

// ─────────────────────────────────────────────────────────────────
// getExportStats
// Get counts for scope display without full data fetch
// ─────────────────────────────────────────────────────────────────

export async function getExportStats(
  projectId: string,
  scope?: ExportScope
): Promise<ExportStats> {
  const effectiveScope: ExportScope = scope || { mode: "all" };

  try {
    const data = await extractExportData(projectId, effectiveScope);
    const items = normalizeForExport(data, true); // Include subtasks for counting

    return calculateStats(items, true);
  } catch (error) {
    console.error("getExportStats error:", error);
    throw new Error(
      `ESTATUS001: Failed to get export stats: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// previewExport
// Generate preview with sample rows for format selection
// ─────────────────────────────────────────────────────────────────

export async function previewExport(
  projectId: string,
  config: ExportConfig
): Promise<ExportPreview> {
  try {
    // Extract data
    const data = await extractExportData(projectId, config.scope);

    if (data.epics.length === 0) {
      return {
        sampleRows: [],
        validation: {
          isValid: false,
          errors: [{ code: "E001", message: "No items to export" }],
          warnings: [],
        },
        stats: {
          epicCount: 0,
          storyCount: 0,
          subtaskCount: 0,
          totalRows: 0,
          estimatedImportTime: "N/A",
        },
      };
    }

    // Normalize all items
    const items = normalizeForExport(data, config.includeSubtasks);

    // Validate
    const validation = validateExport(items, data, config);

    // Map to Jira rows
    const rows = mapToJiraRows(items, config.preset, config.contentLevel);

    // Take sample: first epic + first story + first subtask (up to 3 rows)
    const sampleRows: JiraExportRow[] = [];
    const firstEpic = rows.find((r) => r["Issue Type"] === "Epic");
    const firstStory = rows.find((r) => r["Issue Type"] === "Story");
    const firstSubtask = rows.find((r) =>
      r["Issue Type"] === "Sub-task" || r["Issue Type"] === "Subtask"
    );

    if (firstEpic) sampleRows.push(firstEpic);
    if (firstStory) sampleRows.push(firstStory);
    if (firstSubtask && config.includeSubtasks) sampleRows.push(firstSubtask);

    // Calculate stats
    const stats = calculateStats(items, config.includeSubtasks);

    return {
      sampleRows,
      validation,
      stats,
    };
  } catch (error) {
    console.error("previewExport error:", error);
    throw new Error(
      `EPREV001: Failed to generate preview: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// generateExport
// Generate full export bundle
// ─────────────────────────────────────────────────────────────────

export async function generateExport(
  projectId: string,
  config: ExportConfig
): Promise<ExportBundle> {
  try {
    return await runExportPipeline(projectId, config);
  } catch (error) {
    console.error("generateExport error:", error);
    throw new Error(
      `EGEN003: Export generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// getAvailableRuns
// Get runs for "By Run" scope selector
// ─────────────────────────────────────────────────────────────────

export async function getAvailableRuns(projectId: string): Promise<RunOption[]> {
  const runs = await db.run.findMany({
    where: {
      projectId,
      type: { in: ["GENERATE_EPICS", "ANALYZE_CARDS"] },
      status: "SUCCEEDED",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      createdAt: true,
    },
  });

  // Get epic/story counts for each run
  const runOptions: RunOption[] = await Promise.all(
    runs.map(async (run) => {
      const [epicCount, storyCount] = await Promise.all([
        db.epic.count({ where: { runId: run.id } }),
        db.story.count({
          where: {
            epic: { runId: run.id },
          },
        }),
      ]);

      return {
        id: run.id,
        type: run.type,
        createdAt: run.createdAt,
        epicCount,
        storyCount,
      };
    })
  );

  // Filter out runs with no epics
  return runOptions.filter((r) => r.epicCount > 0);
}

// ─────────────────────────────────────────────────────────────────
// getEpicsForSelection
// Get epic options for "Select Epics" scope
// ─────────────────────────────────────────────────────────────────

export async function getEpicsForSelection(projectId: string): Promise<EpicOption[]> {
  return getEpicOptions(projectId);
}

// ─────────────────────────────────────────────────────────────────
// getProjectForExport
// Get project info for the export page header
// ─────────────────────────────────────────────────────────────────

export async function getProjectForExport(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      _count: {
        select: {
          epics: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return project;
}

// ─────────────────────────────────────────────────────────────────
// getFullPreviewItems
// Get all items for full export preview tree display
// ─────────────────────────────────────────────────────────────────

export async function getFullPreviewItems(
  projectId: string,
  config: ExportConfig
): Promise<FullPreviewData> {
  try {
    // Extract data from database
    const data = await extractExportData(projectId, config.scope);

    if (data.epics.length === 0) {
      return {
        items: [],
        stats: {
          epicCount: 0,
          storyCount: 0,
          subtaskCount: 0,
          totalRows: 0,
          estimatedImportTime: "N/A",
        },
        validation: {
          isValid: false,
          errors: [{ code: "E001", message: "No items to export" }],
          warnings: [],
        },
      };
    }

    // Normalize all items
    const normalizedItems = normalizeForExport(data, config.includeSubtasks);

    // Validate
    const validation = validateExport(normalizedItems, data, config);

    // Calculate stats
    const stats = calculateStats(normalizedItems, config.includeSubtasks);

    // Count children per parent for display
    const storyCountByEpic = new Map<string, number>();
    const subtaskCountByStory = new Map<string, number>();

    for (const item of normalizedItems) {
      if (item.issueType === "Story" && item.parentTempId) {
        storyCountByEpic.set(
          item.parentTempId,
          (storyCountByEpic.get(item.parentTempId) || 0) + 1
        );
      } else if (item.issueType === "Sub-task" && item.parentTempId) {
        subtaskCountByStory.set(
          item.parentTempId,
          (subtaskCountByStory.get(item.parentTempId) || 0) + 1
        );
      }
    }

    // Map to lighter PreviewItem format
    const items: PreviewItem[] = normalizedItems.map((item) => ({
      tempId: item.tempId,
      parentTempId: item.parentTempId,
      issueType: item.issueType,
      code: item.code,
      title: item.title,
      priority: item.priority || null,
      effort: item.effort || null,
      storyCount:
        item.issueType === "Epic"
          ? storyCountByEpic.get(item.tempId) || 0
          : undefined,
      subtaskCount:
        item.issueType === "Story"
          ? subtaskCountByStory.get(item.tempId) || 0
          : undefined,
    }));

    return {
      items,
      stats,
      validation,
    };
  } catch (error) {
    console.error("getFullPreviewItems error:", error);
    throw new Error(
      `EPREV002: Failed to get preview items: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
