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

// ============================================
// CRUD Input Types
// ============================================

/**
 * Input for creating/updating a Service Line (L2)
 */
export interface MssServiceLineInput {
  code: string;
  name: string;
  description?: string;
}

/**
 * Input for creating/updating a Service Area (L3)
 */
export interface MssServiceAreaInput {
  serviceLineId: string;
  code: string;
  name: string;
  description?: string;
}

/**
 * Input for creating/updating an Activity (L4)
 */
export interface MssActivityInput {
  serviceAreaId: string;
  code: string;
  name: string;
  description?: string;
}

// ============================================
// MSS Assignment Types (Work Item Integration)
// ============================================

/**
 * Result of updating MSS assignment on a work item (epic/story)
 */
export interface MssAssignmentResult {
  success: boolean;
  error?: string;
}

// ============================================
// MSS Coverage & Dashboard Types
// ============================================

/**
 * Overall coverage metrics for the MSS dashboard
 */
export interface MssCoverageStats {
  totalEpics: number;
  assignedEpics: number;
  unassignedEpics: number;
  epicCoveragePercent: number;
  totalStories: number;
  assignedStories: number;
  unassignedStories: number;
  storyCoveragePercent: number;
}

/**
 * Coverage stats for a single L3 Service Area
 */
export interface MssServiceAreaCoverage {
  id: string;
  code: string;
  name: string;
  epicCount: number;
  storyCount: number;
  epicTitles: string[];
}

/**
 * Coverage stats for a single L2 Service Line with nested L3 breakdown
 */
export interface MssServiceLineCoverage {
  id: string;
  code: string;
  name: string;
  totalEpics: number;
  totalStories: number;
  serviceAreas: MssServiceAreaCoverage[];
}
