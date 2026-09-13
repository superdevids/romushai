// Typed knowledge catalogs extracted from the ECC source tree + skills.sh.
// Generated data files; safe to import from client or server (pure data, no fs).

export * from "./agents.ts";
export * from "./skills.ts";

import { ECC_AGENT_CATALOG } from "./agents.ts";
import { ECC_SKILL_CATALOG, SKILLS_SH_CATALOG } from "./skills.ts";

export function catalogStats(): {
  agents: number;
  skills: number;
  externalSkills: number;
} {
  return {
    agents: ECC_AGENT_CATALOG.length,
    skills: ECC_SKILL_CATALOG.length,
    externalSkills: SKILLS_SH_CATALOG.length,
  };
}
