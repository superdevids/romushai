// Extract knowledge catalogs from the ECC source tree + the skills.sh list.
// Run: node --experimental-strip-types scripts/extract-knowledge.ts
// Output (AUTO-GENERATED, ASCII-only, deterministic sort by name):
//   src/lib/prd/knowledge/agents.ts
//   src/lib/prd/knowledge/skills.ts
// Source of truth stays the ECC tree; regenerate after pulling new source.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ECC_ROOT = "C:/Users/HP/Downloads/ECC-main/ECC-main";
const SKILLS_DIR = join(ECC_ROOT, "skills");
const AGENTS_DIR = join(ECC_ROOT, "agents");

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src", "lib", "prd", "knowledge");

// --- ASCII normalization -----------------------------------------------------

const PUNCT: Array<[RegExp, string]> = [
  [/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-"],
  [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  [/\u2026/g, "..."],
  [/[\u00A0\u2007\u202F]/g, " "],
  [/[\u2022\u25CF\u25AA\u00B7]/g, "-"],
];

function toAscii(value: string): string {
  let out = value;
  for (const [re, sub] of PUNCT) out = out.replace(re, sub);
  out = out.replace(/[^\x20-\x7E]/g, "");
  return out.replace(/\s+/g, " ").trim();
}

// --- Frontmatter parsing -----------------------------------------------------

function unquote(value: string): string {
  const s = value.trim();
  if (s.length >= 2 && s[0] === '"' && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (s.length >= 2 && s[0] === "'" && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function parseFrontmatter(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return {};
  const end = lines.indexOf("---", 1);
  if (end === -1) return {};
  const out: Record<string, string> = {};
  let key: string | null = null;
  let block: string[] = [];
  const flush = (): void => {
    if (key !== null) out[key] = block.join(" ").trim();
    key = null;
    block = [];
  };
  for (const raw of lines.slice(1, end)) {
    if (key !== null && /^\s+\S/.test(raw)) {
      block.push(raw.trim());
      continue;
    }
    flush();
    const m = /^([A-Za-z0-9_-]+):(.*)$/.exec(raw);
    if (!m) continue;
    const value = m[2].trim();
    if (value === "" || value === "|" || value === "|-" || value === ">" || value === ">-") {
      key = m[1];
      continue;
    }
    out[m[1]] = unquote(value);
  }
  flush();
  return out;
}

// --- Extraction --------------------------------------------------------------

interface EccAgent {
  name: string;
  description: string;
  model?: string;
  source: "ecc";
}

interface EccSkill {
  name: string;
  description: string;
}

interface ExternalSkill {
  id: string;
  title: string;
  url: string;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function readFrontmatter(path: string): Record<string, string> {
  return parseFrontmatter(readFileSync(path, "utf8"));
}

function extractAgents(): EccAgent[] {
  const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));
  const out: EccAgent[] = [];
  for (const file of files) {
    const fm = readFrontmatter(join(AGENTS_DIR, file));
    const name = toAscii(fm.name ?? "");
    const description = toAscii(fm.description ?? "");
    if (name === "" || description === "") continue;
    const model = toAscii(fm.model ?? "");
    out.push(model === "" ? { name, description, source: "ecc" } : { name, description, model, source: "ecc" });
  }
  return out.sort((a, b) => cmp(a.name, b.name));
}

function extractSkills(): EccSkill[] {
  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  const out: EccSkill[] = [];
  for (const dir of dirs) {
    const fm = readFrontmatter(join(SKILLS_DIR, dir.name, "SKILL.md"));
    const name = toAscii(fm.name ?? "");
    const description = toAscii(fm.description ?? "");
    if (name === "" || description === "") continue;
    out.push({ name, description });
  }
  return out.sort((a, b) => cmp(a.name, b.name));
}

// skills.sh catalog: "<org>/<skill>" entries, one per line.
const SKILLS_SH_RAW = `
vercel-labs/find-skills
mattpocock/grill-me
anthropics/frontend-design
mattpocock/setup-matt-pocock-skills
mattpocock/grilling
mattpocock/teach
mattpocock/domain-modeling
mattpocock/codebase-design
mattpocock/diagnosing-bugs
mattpocock/ask-matt
mattpocock/implement
mattpocock/code-review
remotion-dev/remotion-best-practices
mattpocock/wayfinder
mattpocock/research
mattpocock/to-spec
mattpocock/to-tickets
mattpocock/resolving-merge-conflicts
genmedia-labs/video-edit
flowkit-labs/reddit-automation
anthropics/skill-creator
mattpocock/to-prd
mattpocock/to-issues
mattpocock/wizard
mattpocock/git-guardrails-claude-code
mattpocock/setup-pre-commit
mattpocock/scaffold-exercises
mattpocock/writing-great-skills
mattpocock/to-questionnaire
mattpocock/loop-me
prisma/prisma-database-setup
prisma/prisma-client-api
prisma/prisma-cli
prisma/prisma-postgres
prisma/prisma-driver-adapter-implementation
prisma/prisma-upgrade-v7
prisma/prisma-postgres-setup
mattpocock/claude-handoff
emilkowalski/emil-design-eng
prisma/prisma-compute
prisma/prisma-mongodb-upgrade
mattpocock/writing-for-agents
mattpocock/wait-what
mattpocock/diagnose
mattpocock/write-a-skill
mattpocock/zoom-out
mattpocock/setup-ts-deep-modules
mattpocock/caveman
anthropics/pptx
mattpocock/design-an-interface
mattpocock/request-refactor-plan
mattpocock/qa
mattpocock/ubiquitous-language
mattpocock/obsidian-vault
mattpocock/edit-article
anthropics/pdf
anthropics/docx
designed-by-ai/design-mobile-apps
anthropics/xlsx
higgsfield-ai/higgsfield-generate
anthropics/webapp-testing
emilkowalski/review-animations
higgsfield-ai/higgsfield-product-photoshoot
higgsfield-ai/higgsfield-soul-id
higgsfield-ai/higgsfield-marketplace-cards
emilkowalski/animation-vocabulary
emilkowalski/apple-design
genmedia-labs/wan-3-0-prime-reference-to-video
genmedia-labs/seedance-2-5-image-to-video
genmedia-labs/seedance-2-5-reference-to-video
emilkowalski/improve-animations
anthropics/mcp-builder
emilkowalski/find-animation-opportunities
better-auth/better-auth-best-practices
browser-act/browser-act
anthropics/canvas-design
anthropics/web-artifacts-builder
mattpocock/implement-spec
emilkowalski/pick-ui-library
mattpocock/review
anthropics/brand-guidelines
cloudflare/cloudflare
mattpocock/retro
emilkowalski/prototype
browser-act/browser-act-skill-forge
cloudflare/wrangler
anthropics/theme-factory
higgsfield-ai/higgsfield-websites
anthropics/doc-coauthoring
remotion-dev/remotion-render
remotion-dev/remotion-create
anthropics/algorithmic-art
remotion-dev/remotion-interactivity
emilkowalski/animate
remotion-dev/remotion-saas
higgsfield-ai/higgsfield-video-explainer
anthropics/internal-comms
cloudflare/durable-objects
squirrelscan/audit-website
cloudflare/web-perf
remotion-dev/remotion-docs
cloudflare/agents-sdk
anthropics/slack-gif-creator
anthropics/template-skill
mattpocock/batch-grill-me
anthropics/claude-api
cloudflare/cloudflare-email-service
remotion-dev/remotion-upgrade
remotion-dev/remotion-multimedia
cloudflare/turnstile-spin
emilkowalski/ask-sonner
expo/expo-tailwind-setup
cloudflare/cloudflare-one
cloudflare/cloudflare-one-migrations
momentic-ai/momentic-test
momentic-ai/momentic-result-classification
higgsfield-ai/higgsfield-brandkit
higgsfield-ai/higgsfield-youtube-thumbnail
mcollina/fastify-best-practices
mastra-ai/mastra
expo/native-data-fetching
remotion-dev/remotion-studio
mattpocock/decision-mapping
clerk/clerk-setup
emilkowalski/animate-expo
clerk/clerk-custom-ui
expo/upgrading-expo
clerk/clerk-nextjs-patterns
useosint/find-the-original-image
remotion-dev/remotion-maps
firecrawl/firecrawl-build-scrape
firecrawl/firecrawl-build-search
firecrawl/firecrawl-build-interact
firecrawl/firecrawl-build-onboarding
expo/building-native-ui
agentix-cloud/agentix-ceo
useosint/is-this-photo-real
expo/expo-dev-client
useosint/investigate-without-getting-made
useosint/what-leaked-about-you
genkit-ai/developing-genkit-js
remotion-dev/remotion-captions
cloudflare/workers-best-practices
remotion-dev/remotion-markup
momentic-ai/momentic-mobile-test
emilkowalski/write-swift
antfu/vitest
hugmouse/value
angular/angular-developer
antfu/vite
expo/expo-module
better-auth/email-and-password-best-practices
antfu/vue
cloudflare/sandbox-sdk
better-auth/create-auth-skill
expo/eas-update-insights
higgsfield-ai/higgsfield-game-generation
clerk/clerk
clerk/clerk-cli
vuejs-ai/vue-debug-guides
antfu/vue-best-practices
antfu/nuxt
antfu/vueuse-functions
firecrawl/firecrawl-research-index
remotion-dev/mediabunny
expo/expo-ui
antfu/pnpm
pilioai/gpt-image-2
caffeinelabs/extension-email-calendar-events
caffeinelabs/extension-stripe
caffeinelabs/extension-qr-code
caffeinelabs/extension-email-marketing
caffeinelabs/extension-camera
expo/expo-brownfield
caffeinelabs/extension-email-verification
caffeinelabs/extension-posting-to-x
jakubkrehel/better-ui
caffeinelabs/extension-oql
jakubkrehel/better-typography
antfu/web-design-guidelines
feature-sliced/feature-sliced-design
antfu/vue-router-best-practices
tavily-ai/tavily-research
jakubkrehel/better-colors
antfu/pinia
expo/expo-native-ui
apollographql/rust-best-practices
tavily-ai/tavily-best-practices
antfu/vue-testing-best-practices
humanlayer/show-me
caffeinelabs/connector-googlemail
expo/expo-examples
caffeinelabs/extension-querying-oql
clerk/clerk-react-patterns
jakubkrehel/better-layout
expo/expo-router
jakubkrehel/better-interface
expo/expo-upgrade
antfu/antfu
getsentry/security-review
jakubkrehel/better-accessibility
expo/expo-data-fetching
langfuse/langfuse
jakubkrehel/better-writing
antfu/unocss
dart-lang/dart-add-unit-test
dart-lang/dart-run-static-analysis
dart-lang/dart-fix-runtime-errors
dart-lang/dart-resolve-package-conflicts
dart-lang/dart-use-pattern-matching
vuejs-ai/vue-pinia-best-practices
claude-office-skills/excel-automation
dart-lang/dart-collect-coverage
momentic-ai/momentic-explore-prompt
dart-lang/dart-generate-test-mocks
google/cloud-run-basics
angular/angular-new-app
dart-lang/dart-migrate-to-checks-package
tavily-ai/tavily-extract
dart-lang/dart-build-cli-app
tavily-ai/tavily-cli
google/gemini-api
clerk/clerk-billing
google/bigquery-basics
antfu/tsdown
expo/expo-skill-eval
tavily-ai/tavily-crawl
antfu/slidev
caffeinelabs/connector-googlecalendar
tavily-ai/tavily-map
pilioai/nano-banana-2
antfu/turborepo
clerk/clerk-react-router-patterns
expo/expo-ui-swiftui
expo/expo-ui-jetpack-compose
expo/eas-app-stores
google/google-cloud-recipe-onboarding
clerk/clerk-tanstack-patterns
vuejs-ai/vue-router-best-practices
google/google-cloud-recipe-auth
mindrally/fastapi-python
expo/expo-project-structure
expo/eas-workflows
openai/pdf
clerk/clerk-swift
expo/eas-simulator
clerk/clerk-chrome-extension-patterns
clerk/clerk-android
expo/expo-dom
google/cloud-sql-basics
vuejs-ai/create-adaptable-composable
tavily-ai/search
clerk/clerk-astro-patterns
google/google-cloud-waf-security
coderabbitai/code-review
clerk/clerk-vue-patterns
clerk/clerk-nuxt-patterns
google/firebase-basics
vuejs-ai/vue-testing-best-practices
expo/expo-app-clip
google/google-cloud-waf-cost-optimization
expo/expo-web-to-native
google/gke-basics
google/google-cloud-waf-reliability
elevenlabs/text-to-speech
claude-office-skills/html-slides
antfu/vitepress
expo/eas-hosting
expo/expo-skill-feedback
clerk/clerk-expo
expo/eas-observe
brightdata/scrape
claude-office-skills/ppt-visual
upstash/upstash-redis-js
momentic-ai/momentic-spec
google/alloydb-basics
vuejs-ai/vue-options-api-best-practices
upstash/upstash-ratelimit-js
expo/expo-migrate-module
openai/gh-fix-ci
rivet-dev/sandbox-agent
patricio0312rev/framer-motion-animator
caffeinelabs/extension-data-viewer
tavily-ai/tavily-dynamic-search
vuejs-ai/vue-jsx-best-practices
momentic-ai/momentic-maintain
google/google-cloud-networking-observability
elysiajs/elysiajs
openai/linear
dimillian/swiftui-performance-audit
better-auth/create-auth
dart-lang/dart-use-ffigen
claude-office-skills/pdf-extraction
openai/security-best-practices
dart-lang/dart-setup-ffi-assets
jakubkrehel/interface-review
expo/add-app-clip
trailofbits/semgrep
makenotion/notion-cli
google/gemini-interactions-api
skillify-sh/instagram-scraper
elevenlabs/speech-to-text
coderabbitai/autofix
getsentry/code-simplifier
`;

function extractExternal(): ExternalSkill[] {
  const out: ExternalSkill[] = [];
  for (const line of SKILLS_SH_RAW.split("\n")) {
    const entry = line.trim();
    if (entry === "") continue;
    const slash = entry.indexOf("/");
    if (slash === -1) continue;
    const org = entry.slice(0, slash);
    const title = entry.slice(slash + 1);
    out.push({
      id: `${org}/${title}`,
      title,
      url: `https://www.skills.sh/${org}/skills/${title}`,
    });
  }
  return out.sort((a, b) => cmp(a.id, b.id));
}

// --- Rendering ---------------------------------------------------------------

const HEADER = (src: string): string =>
  `// AUTO-GENERATED by scripts/extract-knowledge.ts from ${src}. DO NOT EDIT.\n` +
  `// Regenerate: node --experimental-strip-types scripts/extract-knowledge.ts\n`;

function renderAgents(agents: EccAgent[]): string {
  const rows = agents.map((a) => {
    const lines = [`    name: ${JSON.stringify(a.name)},`, `    description: ${JSON.stringify(a.description)},`];
    if (a.model !== undefined) lines.push(`    model: ${JSON.stringify(a.model)},`);
    lines.push(`    source: "ecc",`);
    return `  {\n${lines.join("\n")}\n  },`;
  });
  return (
    HEADER("the ECC agents tree") +
    `\nexport interface EccAgent {\n  name: string;\n  description: string;\n  model?: string;\n  source: "ecc";\n}\n` +
    `\nexport const ECC_AGENT_CATALOG: EccAgent[] = [\n${rows.join("\n")}\n];\n`
  );
}

function renderSkills(skills: EccSkill[], external: ExternalSkill[]): string {
  const skillRows = skills.map(
    (s) => `  {\n    name: ${JSON.stringify(s.name)},\n    description: ${JSON.stringify(s.description)},\n  },`,
  );
  const extRows = external.map(
    (e) =>
      `  {\n    id: ${JSON.stringify(e.id)},\n    title: ${JSON.stringify(e.title)},\n    url: ${JSON.stringify(e.url)},\n  },`,
  );
  return (
    HEADER("the ECC skills tree + the skills.sh catalog") +
    `\nexport interface EccSkill {\n  name: string;\n  description: string;\n}\n` +
    `\nexport const ECC_SKILL_CATALOG: EccSkill[] = [\n${skillRows.join("\n")}\n];\n` +
    `\nexport interface ExternalSkill {\n  id: string;\n  title: string;\n  url: string;\n}\n` +
    `\nexport const SKILLS_SH_CATALOG: ExternalSkill[] = [\n${extRows.join("\n")}\n];\n`
  );
}

// --- Guard + main ------------------------------------------------------------

const isAscii = (s: string): boolean => [...s].every((c) => c.charCodeAt(0) <= 0x7e);

function assertAscii(label: string, values: string[]): void {
  for (const value of values) {
    if (!isAscii(value)) throw new Error(`${label} contains non-ASCII: ${JSON.stringify(value)}`);
  }
}

function main(): void {
  const agents = extractAgents();
  const skills = extractSkills();
  const external = extractExternal();

  assertAscii("agents", agents.flatMap((a) => [a.name, a.description, a.model ?? ""]));
  assertAscii("skills", skills.flatMap((s) => [s.name, s.description]));
  assertAscii("external", external.flatMap((e) => [e.id, e.title, e.url]));
  if (agents.length === 0 || skills.length === 0 || external.length === 0) {
    throw new Error("extraction produced an empty catalog");
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "agents.ts"), renderAgents(agents), "utf8");
  writeFileSync(join(OUT_DIR, "skills.ts"), renderSkills(skills, external), "utf8");

  process.stdout.write(`agents=${agents.length} skills=${skills.length} external=${external.length}\n`);
}

main();
