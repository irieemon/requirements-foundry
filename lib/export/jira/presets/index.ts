// ═══════════════════════════════════════════════════════════════
// JIRA PRESETS INDEX
// Central export for all preset configurations
// ═══════════════════════════════════════════════════════════════

import type { JiraPreset, PresetConfig } from "../types";
import { cloudCompanyPreset } from "./cloud-company";
import { cloudTeamPreset } from "./cloud-team";
import { serverDcPreset } from "./server-dc";

export const presets: Record<JiraPreset, PresetConfig> = {
  "cloud-company": cloudCompanyPreset,
  "cloud-team": cloudTeamPreset,
  "server-dc": serverDcPreset,
};

export function getPreset(preset: JiraPreset): PresetConfig {
  return presets[preset];
}

export function getAllPresets(): PresetConfig[] {
  return Object.values(presets);
}

export { cloudCompanyPreset, cloudTeamPreset, serverDcPreset };
