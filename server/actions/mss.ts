"use server";

import { db } from "@/lib/db";
import { parseMssCSV, importMssToDatabase } from "@/lib/mss/csv-import";
import type {
  MssImportResult,
  MssStats,
  MssServiceLineInput,
  MssServiceAreaInput,
  MssActivityInput,
} from "@/lib/mss/types";
import { Prisma } from "@prisma/client";

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

// ============================================
// Service Line (L2) CRUD Operations
// ============================================

/**
 * Create a new Service Line (L2)
 */
export async function createServiceLine(input: MssServiceLineInput) {
  try {
    const serviceLine = await db.mssServiceLine.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
      },
    });
    return { success: true as const, data: serviceLine };
  } catch (error) {
    console.error("Failed to create service line:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false as const, error: `Service Line code "${input.code}" already exists` };
    }
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Update a Service Line (L2)
 */
export async function updateServiceLine(id: string, input: Partial<MssServiceLineInput>) {
  try {
    const serviceLine = await db.mssServiceLine.update({
      where: { id },
      data: {
        ...(input.code !== undefined && { code: input.code }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
    return { success: true as const, data: serviceLine };
  } catch (error) {
    console.error("Failed to update service line:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { success: false as const, error: `Service Line code "${input.code}" already exists` };
      }
      if (error.code === "P2025") {
        return { success: false as const, error: "Service Line not found" };
      }
    }
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Delete a Service Line (L2) - cascades to L3/L4
 */
export async function deleteServiceLine(id: string) {
  try {
    await db.mssServiceLine.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    console.error("Failed to delete service line:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false as const, error: "Service Line not found" };
    }
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Get a single Service Line (L2) with children
 */
export async function getServiceLine(id: string) {
  try {
    const serviceLine = await db.mssServiceLine.findUnique({
      where: { id },
      include: {
        serviceAreas: {
          include: { activities: true },
          orderBy: { code: "asc" },
        },
      },
    });
    if (!serviceLine) {
      return { success: false as const, error: "Service Line not found" };
    }
    return { success: true as const, data: serviceLine };
  } catch (error) {
    console.error("Failed to get service line:", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================
// Service Area (L3) CRUD Operations
// ============================================

/**
 * Create a new Service Area (L3) under a Service Line
 */
export async function createServiceArea(input: MssServiceAreaInput) {
  try {
    const serviceArea = await db.mssServiceArea.create({
      data: {
        serviceLineId: input.serviceLineId,
        code: input.code,
        name: input.name,
        description: input.description,
      },
    });
    return { success: true as const, data: serviceArea };
  } catch (error) {
    console.error("Failed to create service area:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { success: false as const, error: `Service Area code "${input.code}" already exists in this Service Line` };
      }
      if (error.code === "P2003") {
        return { success: false as const, error: "Parent Service Line not found" };
      }
    }
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Update a Service Area (L3)
 */
export async function updateServiceArea(id: string, input: Partial<MssServiceAreaInput>) {
  try {
    const serviceArea = await db.mssServiceArea.update({
      where: { id },
      data: {
        ...(input.serviceLineId !== undefined && { serviceLineId: input.serviceLineId }),
        ...(input.code !== undefined && { code: input.code }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
    return { success: true as const, data: serviceArea };
  } catch (error) {
    console.error("Failed to update service area:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { success: false as const, error: `Service Area code "${input.code}" already exists in this Service Line` };
      }
      if (error.code === "P2025") {
        return { success: false as const, error: "Service Area not found" };
      }
    }
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Delete a Service Area (L3) - cascades to L4
 */
export async function deleteServiceArea(id: string) {
  try {
    await db.mssServiceArea.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    console.error("Failed to delete service area:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false as const, error: "Service Area not found" };
    }
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Get a single Service Area (L3) with children
 */
export async function getServiceArea(id: string) {
  try {
    const serviceArea = await db.mssServiceArea.findUnique({
      where: { id },
      include: {
        serviceLine: true,
        activities: { orderBy: { code: "asc" } },
      },
    });
    if (!serviceArea) {
      return { success: false as const, error: "Service Area not found" };
    }
    return { success: true as const, data: serviceArea };
  } catch (error) {
    console.error("Failed to get service area:", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================
// Activity (L4) CRUD Operations
// ============================================

/**
 * Create a new Activity (L4) under a Service Area
 */
export async function createActivity(input: MssActivityInput) {
  try {
    const activity = await db.mssActivity.create({
      data: {
        serviceAreaId: input.serviceAreaId,
        code: input.code,
        name: input.name,
        description: input.description,
      },
    });
    return { success: true as const, data: activity };
  } catch (error) {
    console.error("Failed to create activity:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { success: false as const, error: `Activity code "${input.code}" already exists in this Service Area` };
      }
      if (error.code === "P2003") {
        return { success: false as const, error: "Parent Service Area not found" };
      }
    }
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Update an Activity (L4)
 */
export async function updateActivity(id: string, input: Partial<MssActivityInput>) {
  try {
    const activity = await db.mssActivity.update({
      where: { id },
      data: {
        ...(input.serviceAreaId !== undefined && { serviceAreaId: input.serviceAreaId }),
        ...(input.code !== undefined && { code: input.code }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
    return { success: true as const, data: activity };
  } catch (error) {
    console.error("Failed to update activity:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { success: false as const, error: `Activity code "${input.code}" already exists in this Service Area` };
      }
      if (error.code === "P2025") {
        return { success: false as const, error: "Activity not found" };
      }
    }
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Delete an Activity (L4)
 */
export async function deleteActivity(id: string) {
  try {
    await db.mssActivity.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    console.error("Failed to delete activity:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false as const, error: "Activity not found" };
    }
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Get a single Activity (L4)
 */
export async function getActivity(id: string) {
  try {
    const activity = await db.mssActivity.findUnique({
      where: { id },
      include: { serviceArea: { include: { serviceLine: true } } },
    });
    if (!activity) {
      return { success: false as const, error: "Activity not found" };
    }
    return { success: true as const, data: activity };
  } catch (error) {
    console.error("Failed to get activity:", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
