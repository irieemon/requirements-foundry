import Papa from "papaparse";
import { db } from "@/lib/db";
import type {
  MssImportRow,
  MssColumnMapping,
  MssImportResult,
  MssParsedCSV,
} from "./types";

/**
 * Auto-detect column mappings based on header names for MSS CSV files
 */
export function autoDetectMssColumns(headers: string[]): MssColumnMapping | null {
  const mapping: Partial<MssColumnMapping> = {};

  const patterns: Record<keyof MssColumnMapping, RegExp[]> = {
    // L2 Service Line patterns
    l2Code: [/l2.*code/i, /service.*line.*code/i, /sl.*code/i],
    l2Name: [/l2.*name/i, /service.*line.*name/i, /sl.*name/i, /service.*line$/i],
    l2Description: [/l2.*desc/i, /service.*line.*desc/i, /sl.*desc/i],

    // L3 Service Area patterns
    l3Code: [/l3.*code/i, /service.*area.*code/i, /sa.*code/i],
    l3Name: [/l3.*name/i, /service.*area.*name/i, /sa.*name/i, /service.*area$/i],
    l3Description: [/l3.*desc/i, /service.*area.*desc/i, /sa.*desc/i],

    // L4 Activity patterns
    l4Code: [/l4.*code/i, /activity.*code/i, /act.*code/i],
    l4Name: [/l4.*name/i, /activity.*name/i, /act.*name/i, /activity$/i],
    l4Description: [/l4.*desc/i, /activity.*desc/i, /act.*desc/i],
  };

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    for (const [field, fieldPatterns] of Object.entries(patterns)) {
      if (mapping[field as keyof MssColumnMapping]) continue;
      for (const pattern of fieldPatterns) {
        if (pattern.test(normalized)) {
          mapping[field as keyof MssColumnMapping] = header;
          break;
        }
      }
    }
  }

  // Must have all required columns (codes and names for all three levels)
  const requiredFields: (keyof MssColumnMapping)[] = [
    "l2Code",
    "l2Name",
    "l3Code",
    "l3Name",
    "l4Code",
    "l4Name",
  ];

  for (const field of requiredFields) {
    if (!mapping[field]) {
      return null;
    }
  }

  return mapping as MssColumnMapping;
}

/**
 * Parse MSS CSV content into structured rows
 */
export function parseMssCSV(
  csvContent: string,
  mapping?: MssColumnMapping
): MssParsedCSV {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    console.warn("MSS CSV parsing warnings:", result.errors);
  }

  const headers = result.meta.fields || [];
  const autoMapping = mapping || autoDetectMssColumns(headers);

  if (!autoMapping) {
    return { rows: [], headers, autoMapping: null };
  }

  const rows: MssImportRow[] = [];

  for (const row of result.data) {
    // All level codes must be present for a valid row
    const l2Code = row[autoMapping.l2Code]?.trim();
    const l3Code = row[autoMapping.l3Code]?.trim();
    const l4Code = row[autoMapping.l4Code]?.trim();

    if (!l2Code || !l3Code || !l4Code) {
      continue; // Skip rows with missing codes
    }

    const importRow: MssImportRow = {
      l2Code,
      l2Name: row[autoMapping.l2Name]?.trim() || l2Code,
      l3Code,
      l3Name: row[autoMapping.l3Name]?.trim() || l3Code,
      l4Code,
      l4Name: row[autoMapping.l4Name]?.trim() || l4Code,
    };

    // Add optional descriptions
    if (autoMapping.l2Description && row[autoMapping.l2Description]) {
      importRow.l2Description = row[autoMapping.l2Description].trim();
    }
    if (autoMapping.l3Description && row[autoMapping.l3Description]) {
      importRow.l3Description = row[autoMapping.l3Description].trim();
    }
    if (autoMapping.l4Description && row[autoMapping.l4Description]) {
      importRow.l4Description = row[autoMapping.l4Description].trim();
    }

    rows.push(importRow);
  }

  return { rows, headers, autoMapping };
}

/**
 * Import MSS data into the database using upsert pattern
 * Processes L2 -> L3 -> L4 in order to maintain parent relationships
 */
export async function importMssToDatabase(
  rows: MssImportRow[]
): Promise<MssImportResult> {
  const errors: string[] = [];

  // Track created/found IDs for parent lookups
  const serviceLineIds = new Map<string, string>(); // l2Code -> id
  const serviceAreaIds = new Map<string, string>(); // `${l2Code}:${l3Code}` -> id

  // Deduplicate by collecting unique entries
  const uniqueServiceLines = new Map<string, MssImportRow>();
  const uniqueServiceAreas = new Map<string, MssImportRow>();
  const uniqueActivities = new Map<string, MssImportRow>();

  for (const row of rows) {
    // L2: keyed by l2Code (globally unique)
    if (!uniqueServiceLines.has(row.l2Code)) {
      uniqueServiceLines.set(row.l2Code, row);
    }

    // L3: keyed by l2Code:l3Code (unique within service line)
    const l3Key = `${row.l2Code}:${row.l3Code}`;
    if (!uniqueServiceAreas.has(l3Key)) {
      uniqueServiceAreas.set(l3Key, row);
    }

    // L4: keyed by l2Code:l3Code:l4Code (unique within service area)
    const l4Key = `${row.l2Code}:${row.l3Code}:${row.l4Code}`;
    if (!uniqueActivities.has(l4Key)) {
      uniqueActivities.set(l4Key, row);
    }
  }

  // Step 1: Upsert Service Lines (L2)
  let serviceLinesCreated = 0;
  for (const [code, row] of uniqueServiceLines) {
    try {
      const serviceLine = await db.mssServiceLine.upsert({
        where: { code },
        update: {
          name: row.l2Name,
          description: row.l2Description || null,
        },
        create: {
          code,
          name: row.l2Name,
          description: row.l2Description || null,
        },
      });
      serviceLineIds.set(code, serviceLine.id);
      serviceLinesCreated++;
    } catch (error) {
      errors.push(
        `Failed to upsert service line ${code}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Step 2: Upsert Service Areas (L3)
  let serviceAreasCreated = 0;
  for (const [key, row] of uniqueServiceAreas) {
    const serviceLineId = serviceLineIds.get(row.l2Code);
    if (!serviceLineId) {
      errors.push(`Missing service line for area ${row.l3Code} (parent: ${row.l2Code})`);
      continue;
    }

    try {
      const serviceArea = await db.mssServiceArea.upsert({
        where: {
          serviceLineId_code: {
            serviceLineId,
            code: row.l3Code,
          },
        },
        update: {
          name: row.l3Name,
          description: row.l3Description || null,
        },
        create: {
          serviceLineId,
          code: row.l3Code,
          name: row.l3Name,
          description: row.l3Description || null,
        },
      });
      serviceAreaIds.set(key, serviceArea.id);
      serviceAreasCreated++;
    } catch (error) {
      errors.push(
        `Failed to upsert service area ${row.l3Code}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Step 3: Upsert Activities (L4)
  let activitiesCreated = 0;
  for (const [key, row] of uniqueActivities) {
    const l3Key = `${row.l2Code}:${row.l3Code}`;
    const serviceAreaId = serviceAreaIds.get(l3Key);
    if (!serviceAreaId) {
      errors.push(`Missing service area for activity ${row.l4Code} (parent: ${l3Key})`);
      continue;
    }

    try {
      await db.mssActivity.upsert({
        where: {
          serviceAreaId_code: {
            serviceAreaId,
            code: row.l4Code,
          },
        },
        update: {
          name: row.l4Name,
          description: row.l4Description || null,
        },
        create: {
          serviceAreaId,
          code: row.l4Code,
          name: row.l4Name,
          description: row.l4Description || null,
        },
      });
      activitiesCreated++;
    } catch (error) {
      errors.push(
        `Failed to upsert activity ${row.l4Code}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  return {
    serviceLines: serviceLinesCreated,
    serviceAreas: serviceAreasCreated,
    activities: activitiesCreated,
    errors,
  };
}
