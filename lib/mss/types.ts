/**
 * MSS (Master Service Schedule) Type Definitions
 *
 * L2 Service Line (top) -> L3 Service Area (mid) -> L4 Activity (leaf)
 */

/**
 * Represents a single row from the MSS CSV import
 */
export interface MssImportRow {
  l2Code: string;
  l2Name: string;
  l2Description?: string;
  l3Code: string;
  l3Name: string;
  l3Description?: string;
  l4Code: string;
  l4Name: string;
  l4Description?: string;
}

/**
 * Column mapping configuration for MSS CSV parsing
 */
export interface MssColumnMapping {
  l2Code: string;
  l2Name: string;
  l2Description?: string;
  l3Code: string;
  l3Name: string;
  l3Description?: string;
  l4Code: string;
  l4Name: string;
  l4Description?: string;
}

/**
 * Result of an MSS import operation
 */
export interface MssImportResult {
  serviceLines: number;
  serviceAreas: number;
  activities: number;
  errors: string[];
}

/**
 * Result of MSS CSV parsing
 */
export interface MssParsedCSV {
  rows: MssImportRow[];
  headers: string[];
  autoMapping: MssColumnMapping | null;
}

/**
 * Statistics about the current MSS data
 */
export interface MssStats {
  serviceLines: number;
  serviceAreas: number;
  activities: number;
}
