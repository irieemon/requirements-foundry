"use server";

import { db } from "@/lib/db";
import { parseMssCSV, importMssToDatabase } from "@/lib/mss/csv-import";
import type { MssImportResult, MssStats } from "@/lib/mss/types";

/**
 * Import MSS taxonomy from CSV content
 */
export async function importMssFromCSV(csvContent: string): Promise<
  | { success: true; data: MssImportResult }
  | { success: false; error: string }
> {
  try {
    // Parse CSV
    const { rows, autoMapping } = parseMssCSV(csvContent);

    if (!autoMapping) {
      return {
        success: false,
        error:
          "Could not auto-detect column mapping. Expected columns for L2/L3/L4 codes and names (e.g., 'L2 Code', 'L2 Name', 'L3 Code', etc.).",
      };
    }

    if (rows.length === 0) {
      return {
        success: false,
        error: "No valid rows found in CSV. Ensure all rows have L2, L3, and L4 codes.",
      };
    }

    // Import to database
    const result = await importMssToDatabase(rows);

    // If there were errors but some items succeeded, report as partial success
    if (result.errors.length > 0) {
      console.warn("MSS import completed with errors:", result.errors);
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("MSS import failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during import",
    };
  }
}

/**
 * Get statistics about the current MSS data
 */
export async function getMssStats(): Promise<
  | { success: true; data: MssStats }
  | { success: false; error: string }
> {
  try {
    const [serviceLines, serviceAreas, activities] = await Promise.all([
      db.mssServiceLine.count(),
      db.mssServiceArea.count(),
      db.mssActivity.count(),
    ]);

    return {
      success: true,
      data: {
        serviceLines,
        serviceAreas,
        activities,
      },
    };
  } catch (error) {
    console.error("Failed to get MSS stats:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get full MSS hierarchy with all levels
 */
export async function getMssHierarchy() {
  try {
    const serviceLines = await db.mssServiceLine.findMany({
      include: {
        serviceAreas: {
          include: {
            activities: true,
          },
          orderBy: { code: "asc" },
        },
      },
      orderBy: { code: "asc" },
    });

    return { success: true, data: serviceLines };
  } catch (error) {
    console.error("Failed to get MSS hierarchy:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clear all MSS data (for re-import)
 */
export async function clearMssData(): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  try {
    // Cascade delete from top level will remove all children
    await db.mssServiceLine.deleteMany();

    return { success: true };
  } catch (error) {
    console.error("Failed to clear MSS data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
