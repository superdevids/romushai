// AUTO-GENERATED - data skill ECC + skills.sh; skrip generator (scripts/extract-knowledge.ts) tidak ada di working tree ini. Jangan edit manual.

import { ECC_SKILL_CATALOG_PART1 } from "./skills.part1.ts";
import { ECC_SKILL_CATALOG_PART2 } from "./skills.part2.ts";
import { ECC_SKILL_CATALOG_PART3 } from "./skills.part3.ts";
import { ECC_SKILL_CATALOG_PART4 } from "./skills.part4.ts";
import { ECC_SKILL_CATALOG_PART5 } from "./skills.part5.ts";
import { OPENCODE_SKILL_CATALOG } from "./opencode/index.ts";

export interface EccSkill {
  name: string;
  description: string;
  content: string;
}

export const ECC_SKILL_CATALOG: EccSkill[] = [
  ...ECC_SKILL_CATALOG_PART1,
  ...ECC_SKILL_CATALOG_PART2,
  ...ECC_SKILL_CATALOG_PART3,
  ...ECC_SKILL_CATALOG_PART4,
  ...ECC_SKILL_CATALOG_PART5,
  // Katalog tambahan dari opencode.bak (skills.oc.part*.ts via opencode/index.ts).
  ...OPENCODE_SKILL_CATALOG,
];

export interface ExternalSkill {
  id: string;
  title: string;
  url: string;
}

export const SKILLS_SH_CATALOG: ExternalSkill[] = [
  {
    id: "agentix-cloud/agentix-ceo",
    title: "agentix-ceo",
    url: "https://www.skills.sh/agentix-cloud/skills/agentix-ceo",
  },
  {
    id: "angular/angular-developer",
    title: "angular-developer",
    url: "https://www.skills.sh/angular/skills/angular-developer",
  },
  {
    id: "angular/angular-new-app",
    title: "angular-new-app",
    url: "https://www.skills.sh/angular/skills/angular-new-app",
  },
  {
    id: "antfu/antfu",
    title: "antfu",
    url: "https://www.skills.sh/antfu/skills/antfu",
  },
  {
    id: "antfu/nuxt",
    title: "nuxt",
    url: "https://www.skills.sh/antfu/skills/nuxt",
  },
  {
    id: "antfu/pinia",
    title: "pinia",
    url: "https://www.skills.sh/antfu/skills/pinia",
  },
  {
    id: "antfu/pnpm",
    title: "pnpm",
    url: "https://www.skills.sh/antfu/skills/pnpm",
  },
  {
    id: "antfu/slidev",
    title: "slidev",
    url: "https://www.skills.sh/antfu/skills/slidev",
  },
  {
    id: "antfu/tsdown",
    title: "tsdown",
    url: "https://www.skills.sh/antfu/skills/tsdown",
  },
  {
    id: "antfu/turborepo",
    title: "turborepo",
    url: "https://www.skills.sh/antfu/skills/turborepo",
  },
  {
    id: "antfu/unocss",
    title: "unocss",
    url: "https://www.skills.sh/antfu/skills/unocss",
  },
  {
    id: "antfu/vite",
    title: "vite",
    url: "https://www.skills.sh/antfu/skills/vite",
  },
  {
    id: "antfu/vitepress",
    title: "vitepress",
    url: "https://www.skills.sh/antfu/skills/vitepress",
  },
  {
    id: "antfu/vitest",
    title: "vitest",
    url: "https://www.skills.sh/antfu/skills/vitest",
  },
  {
    id: "antfu/vue",
    title: "vue",
    url: "https://www.skills.sh/antfu/skills/vue",
  },
  {
    id: "antfu/vue-best-practices",
    title: "vue-best-practices",
    url: "https://www.skills.sh/antfu/skills/vue-best-practices",
  },
  {
    id: "antfu/vue-router-best-practices",
    title: "vue-router-best-practices",
    url: "https://www.skills.sh/antfu/skills/vue-router-best-practices",
  },
  {
    id: "antfu/vue-testing-best-practices",
    title: "vue-testing-best-practices",
    url: "https://www.skills.sh/antfu/skills/vue-testing-best-practices",
  },
  {
    id: "antfu/vueuse-functions",
    title: "vueuse-functions",
    url: "https://www.skills.sh/antfu/skills/vueuse-functions",
  },
  {
    id: "antfu/web-design-guidelines",
    title: "web-design-guidelines",
    url: "https://www.skills.sh/antfu/skills/web-design-guidelines",
  },
  {
    id: "anthropics/algorithmic-art",
    title: "algorithmic-art",
    url: "https://www.skills.sh/anthropics/skills/algorithmic-art",
  },
  {
    id: "anthropics/brand-guidelines",
    title: "brand-guidelines",
    url: "https://www.skills.sh/anthropics/skills/brand-guidelines",
  },
  {
    id: "anthropics/canvas-design",
    title: "canvas-design",
    url: "https://www.skills.sh/anthropics/skills/canvas-design",
  },
  {
    id: "anthropics/claude-api",
    title: "claude-api",
    url: "https://www.skills.sh/anthropics/skills/claude-api",
  },
  {
    id: "anthropics/doc-coauthoring",
    title: "doc-coauthoring",
    url: "https://www.skills.sh/anthropics/skills/doc-coauthoring",
  },
  {
    id: "anthropics/docx",
    title: "docx",
    url: "https://www.skills.sh/anthropics/skills/docx",
  },
  {
    id: "anthropics/frontend-design",
    title: "frontend-design",
    url: "https://www.skills.sh/anthropics/skills/frontend-design",
  },
  {
    id: "anthropics/internal-comms",
    title: "internal-comms",
    url: "https://www.skills.sh/anthropics/skills/internal-comms",
  },
  {
    id: "anthropics/mcp-builder",
    title: "mcp-builder",
    url: "https://www.skills.sh/anthropics/skills/mcp-builder",
  },
  {
    id: "anthropics/pdf",
    title: "pdf",
    url: "https://www.skills.sh/anthropics/skills/pdf",
  },
  {
    id: "anthropics/pptx",
    title: "pptx",
    url: "https://www.skills.sh/anthropics/skills/pptx",
  },
  {
    id: "anthropics/skill-creator",
    title: "skill-creator",
    url: "https://www.skills.sh/anthropics/skills/skill-creator",
  },
  {
    id: "anthropics/slack-gif-creator",
    title: "slack-gif-creator",
    url: "https://www.skills.sh/anthropics/skills/slack-gif-creator",
  },
  {
    id: "anthropics/template-skill",
    title: "template-skill",
    url: "https://www.skills.sh/anthropics/skills/template-skill",
  },
  {
    id: "anthropics/theme-factory",
    title: "theme-factory",
    url: "https://www.skills.sh/anthropics/skills/theme-factory",
  },
  {
    id: "anthropics/web-artifacts-builder",
    title: "web-artifacts-builder",
    url: "https://www.skills.sh/anthropics/skills/web-artifacts-builder",
  },
  {
    id: "anthropics/webapp-testing",
    title: "webapp-testing",
    url: "https://www.skills.sh/anthropics/skills/webapp-testing",
  },
  {
    id: "anthropics/xlsx",
    title: "xlsx",
    url: "https://www.skills.sh/anthropics/skills/xlsx",
  },
  {
    id: "apollographql/rust-best-practices",
    title: "rust-best-practices",
    url: "https://www.skills.sh/apollographql/skills/rust-best-practices",
  },
  {
    id: "better-auth/better-auth-best-practices",
    title: "better-auth-best-practices",
    url: "https://www.skills.sh/better-auth/skills/better-auth-best-practices",
  },
  {
    id: "better-auth/create-auth",
    title: "create-auth",
    url: "https://www.skills.sh/better-auth/skills/create-auth",
  },
  {
    id: "better-auth/create-auth-skill",
    title: "create-auth-skill",
    url: "https://www.skills.sh/better-auth/skills/create-auth-skill",
  },
  {
    id: "better-auth/email-and-password-best-practices",
    title: "email-and-password-best-practices",
    url: "https://www.skills.sh/better-auth/skills/email-and-password-best-practices",
  },
  {
    id: "brightdata/scrape",
    title: "scrape",
    url: "https://www.skills.sh/brightdata/skills/scrape",
  },
  {
    id: "browser-act/browser-act",
    title: "browser-act",
    url: "https://www.skills.sh/browser-act/skills/browser-act",
  },
  {
    id: "browser-act/browser-act-skill-forge",
    title: "browser-act-skill-forge",
    url: "https://www.skills.sh/browser-act/skills/browser-act-skill-forge",
  },
  {
    id: "caffeinelabs/connector-googlecalendar",
    title: "connector-googlecalendar",
    url: "https://www.skills.sh/caffeinelabs/skills/connector-googlecalendar",
  },
  {
    id: "caffeinelabs/connector-googlemail",
    title: "connector-googlemail",
    url: "https://www.skills.sh/caffeinelabs/skills/connector-googlemail",
  },
  {
    id: "caffeinelabs/extension-camera",
    title: "extension-camera",
    url: "https://www.skills.sh/caffeinelabs/skills/extension-camera",
  },
  {
    id: "caffeinelabs/extension-data-viewer",
    title: "extension-data-viewer",
    url: "https://www.skills.sh/caffeinelabs/skills/extension-data-viewer",
  },
  {
    id: "caffeinelabs/extension-email-calendar-events",
    title: "extension-email-calendar-events",
    url: "https://www.skills.sh/caffeinelabs/skills/extension-email-calendar-events",
  },
  {
    id: "caffeinelabs/extension-email-marketing",
    title: "extension-email-marketing",
    url: "https://www.skills.sh/caffeinelabs/skills/extension-email-marketing",
  },
  {
    id: "caffeinelabs/extension-email-verification",
    title: "extension-email-verification",
    url: "https://www.skills.sh/caffeinelabs/skills/extension-email-verification",
  },
  {
    id: "caffeinelabs/extension-oql",
    title: "extension-oql",
    url: "https://www.skills.sh/caffeinelabs/skills/extension-oql",
  },
  {
    id: "caffeinelabs/extension-posting-to-x",
    title: "extension-posting-to-x",
    url: "https://www.skills.sh/caffeinelabs/skills/extension-posting-to-x",
  },
  {
    id: "caffeinelabs/extension-qr-code",
    title: "extension-qr-code",
    url: "https://www.skills.sh/caffeinelabs/skills/extension-qr-code",
  },
  {
    id: "caffeinelabs/extension-querying-oql",
    title: "extension-querying-oql",
    url: "https://www.skills.sh/caffeinelabs/skills/extension-querying-oql",
  },
  {
    id: "caffeinelabs/extension-stripe",
    title: "extension-stripe",
    url: "https://www.skills.sh/caffeinelabs/skills/extension-stripe",
  },
  {
    id: "claude-office-skills/excel-automation",
    title: "excel-automation",
    url: "https://www.skills.sh/claude-office-skills/skills/excel-automation",
  },
  {
    id: "claude-office-skills/html-slides",
    title: "html-slides",
    url: "https://www.skills.sh/claude-office-skills/skills/html-slides",
  },
  {
    id: "claude-office-skills/pdf-extraction",
    title: "pdf-extraction",
    url: "https://www.skills.sh/claude-office-skills/skills/pdf-extraction",
  },
  {
    id: "claude-office-skills/ppt-visual",
    title: "ppt-visual",
    url: "https://www.skills.sh/claude-office-skills/skills/ppt-visual",
  },
  {
    id: "clerk/clerk",
    title: "clerk",
    url: "https://www.skills.sh/clerk/skills/clerk",
  },
  {
    id: "clerk/clerk-android",
    title: "clerk-android",
    url: "https://www.skills.sh/clerk/skills/clerk-android",
  },
  {
    id: "clerk/clerk-astro-patterns",
    title: "clerk-astro-patterns",
    url: "https://www.skills.sh/clerk/skills/clerk-astro-patterns",
  },
  {
    id: "clerk/clerk-billing",
    title: "clerk-billing",
    url: "https://www.skills.sh/clerk/skills/clerk-billing",
  },
  {
    id: "clerk/clerk-chrome-extension-patterns",
    title: "clerk-chrome-extension-patterns",
    url: "https://www.skills.sh/clerk/skills/clerk-chrome-extension-patterns",
  },
  {
    id: "clerk/clerk-cli",
    title: "clerk-cli",
    url: "https://www.skills.sh/clerk/skills/clerk-cli",
  },
  {
    id: "clerk/clerk-custom-ui",
    title: "clerk-custom-ui",
    url: "https://www.skills.sh/clerk/skills/clerk-custom-ui",
  },
  {
    id: "clerk/clerk-expo",
    title: "clerk-expo",
    url: "https://www.skills.sh/clerk/skills/clerk-expo",
  },
  {
    id: "clerk/clerk-nextjs-patterns",
    title: "clerk-nextjs-patterns",
    url: "https://www.skills.sh/clerk/skills/clerk-nextjs-patterns",
  },
  {
    id: "clerk/clerk-nuxt-patterns",
    title: "clerk-nuxt-patterns",
    url: "https://www.skills.sh/clerk/skills/clerk-nuxt-patterns",
  },
  {
    id: "clerk/clerk-react-patterns",
    title: "clerk-react-patterns",
    url: "https://www.skills.sh/clerk/skills/clerk-react-patterns",
  },
  {
    id: "clerk/clerk-react-router-patterns",
    title: "clerk-react-router-patterns",
    url: "https://www.skills.sh/clerk/skills/clerk-react-router-patterns",
  },
  {
    id: "clerk/clerk-setup",
    title: "clerk-setup",
    url: "https://www.skills.sh/clerk/skills/clerk-setup",
  },
  {
    id: "clerk/clerk-swift",
    title: "clerk-swift",
    url: "https://www.skills.sh/clerk/skills/clerk-swift",
  },
  {
    id: "clerk/clerk-tanstack-patterns",
    title: "clerk-tanstack-patterns",
    url: "https://www.skills.sh/clerk/skills/clerk-tanstack-patterns",
  },
  {
    id: "clerk/clerk-vue-patterns",
    title: "clerk-vue-patterns",
    url: "https://www.skills.sh/clerk/skills/clerk-vue-patterns",
  },
  {
    id: "cloudflare/agents-sdk",
    title: "agents-sdk",
    url: "https://www.skills.sh/cloudflare/skills/agents-sdk",
  },
  {
    id: "cloudflare/cloudflare",
    title: "cloudflare",
    url: "https://www.skills.sh/cloudflare/skills/cloudflare",
  },
  {
    id: "cloudflare/cloudflare-email-service",
    title: "cloudflare-email-service",
    url: "https://www.skills.sh/cloudflare/skills/cloudflare-email-service",
  },
  {
    id: "cloudflare/cloudflare-one",
    title: "cloudflare-one",
    url: "https://www.skills.sh/cloudflare/skills/cloudflare-one",
  },
  {
    id: "cloudflare/cloudflare-one-migrations",
    title: "cloudflare-one-migrations",
    url: "https://www.skills.sh/cloudflare/skills/cloudflare-one-migrations",
  },
  {
    id: "cloudflare/durable-objects",
    title: "durable-objects",
    url: "https://www.skills.sh/cloudflare/skills/durable-objects",
  },
  {
    id: "cloudflare/sandbox-sdk",
    title: "sandbox-sdk",
    url: "https://www.skills.sh/cloudflare/skills/sandbox-sdk",
  },
  {
    id: "cloudflare/turnstile-spin",
    title: "turnstile-spin",
    url: "https://www.skills.sh/cloudflare/skills/turnstile-spin",
  },
  {
    id: "cloudflare/web-perf",
    title: "web-perf",
    url: "https://www.skills.sh/cloudflare/skills/web-perf",
  },
  {
    id: "cloudflare/workers-best-practices",
    title: "workers-best-practices",
    url: "https://www.skills.sh/cloudflare/skills/workers-best-practices",
  },
  {
    id: "cloudflare/wrangler",
    title: "wrangler",
    url: "https://www.skills.sh/cloudflare/skills/wrangler",
  },
  {
    id: "coderabbitai/autofix",
    title: "autofix",
    url: "https://www.skills.sh/coderabbitai/skills/autofix",
  },
  {
    id: "coderabbitai/code-review",
    title: "code-review",
    url: "https://www.skills.sh/coderabbitai/skills/code-review",
  },
  {
    id: "dart-lang/dart-add-unit-test",
    title: "dart-add-unit-test",
    url: "https://www.skills.sh/dart-lang/skills/dart-add-unit-test",
  },
  {
    id: "dart-lang/dart-build-cli-app",
    title: "dart-build-cli-app",
    url: "https://www.skills.sh/dart-lang/skills/dart-build-cli-app",
  },
  {
    id: "dart-lang/dart-collect-coverage",
    title: "dart-collect-coverage",
    url: "https://www.skills.sh/dart-lang/skills/dart-collect-coverage",
  },
  {
    id: "dart-lang/dart-fix-runtime-errors",
    title: "dart-fix-runtime-errors",
    url: "https://www.skills.sh/dart-lang/skills/dart-fix-runtime-errors",
  },
  {
    id: "dart-lang/dart-generate-test-mocks",
    title: "dart-generate-test-mocks",
    url: "https://www.skills.sh/dart-lang/skills/dart-generate-test-mocks",
  },
  {
    id: "dart-lang/dart-migrate-to-checks-package",
    title: "dart-migrate-to-checks-package",
    url: "https://www.skills.sh/dart-lang/skills/dart-migrate-to-checks-package",
  },
  {
    id: "dart-lang/dart-resolve-package-conflicts",
    title: "dart-resolve-package-conflicts",
    url: "https://www.skills.sh/dart-lang/skills/dart-resolve-package-conflicts",
  },
  {
    id: "dart-lang/dart-run-static-analysis",
    title: "dart-run-static-analysis",
    url: "https://www.skills.sh/dart-lang/skills/dart-run-static-analysis",
  },
  {
    id: "dart-lang/dart-setup-ffi-assets",
    title: "dart-setup-ffi-assets",
    url: "https://www.skills.sh/dart-lang/skills/dart-setup-ffi-assets",
  },
  {
    id: "dart-lang/dart-use-ffigen",
    title: "dart-use-ffigen",
    url: "https://www.skills.sh/dart-lang/skills/dart-use-ffigen",
  },
  {
    id: "dart-lang/dart-use-pattern-matching",
    title: "dart-use-pattern-matching",
    url: "https://www.skills.sh/dart-lang/skills/dart-use-pattern-matching",
  },
  {
    id: "designed-by-ai/design-mobile-apps",
    title: "design-mobile-apps",
    url: "https://www.skills.sh/designed-by-ai/skills/design-mobile-apps",
  },
  {
    id: "dimillian/swiftui-performance-audit",
    title: "swiftui-performance-audit",
    url: "https://www.skills.sh/dimillian/skills/swiftui-performance-audit",
  },
  {
    id: "elevenlabs/speech-to-text",
    title: "speech-to-text",
    url: "https://www.skills.sh/elevenlabs/skills/speech-to-text",
  },
  {
    id: "elevenlabs/text-to-speech",
    title: "text-to-speech",
    url: "https://www.skills.sh/elevenlabs/skills/text-to-speech",
  },
  {
    id: "elysiajs/elysiajs",
    title: "elysiajs",
    url: "https://www.skills.sh/elysiajs/skills/elysiajs",
  },
  {
    id: "emilkowalski/animate",
    title: "animate",
    url: "https://www.skills.sh/emilkowalski/skills/animate",
  },
  {
    id: "emilkowalski/animate-expo",
    title: "animate-expo",
    url: "https://www.skills.sh/emilkowalski/skills/animate-expo",
  },
  {
    id: "emilkowalski/animation-vocabulary",
    title: "animation-vocabulary",
    url: "https://www.skills.sh/emilkowalski/skills/animation-vocabulary",
  },
  {
    id: "emilkowalski/apple-design",
    title: "apple-design",
    url: "https://www.skills.sh/emilkowalski/skills/apple-design",
  },
  {
    id: "emilkowalski/ask-sonner",
    title: "ask-sonner",
    url: "https://www.skills.sh/emilkowalski/skills/ask-sonner",
  },
  {
    id: "emilkowalski/emil-design-eng",
    title: "emil-design-eng",
    url: "https://www.skills.sh/emilkowalski/skills/emil-design-eng",
  },
  {
    id: "emilkowalski/find-animation-opportunities",
    title: "find-animation-opportunities",
    url: "https://www.skills.sh/emilkowalski/skills/find-animation-opportunities",
  },
  {
    id: "emilkowalski/improve-animations",
    title: "improve-animations",
    url: "https://www.skills.sh/emilkowalski/skills/improve-animations",
  },
  {
    id: "emilkowalski/pick-ui-library",
    title: "pick-ui-library",
    url: "https://www.skills.sh/emilkowalski/skills/pick-ui-library",
  },
  {
    id: "emilkowalski/prototype",
    title: "prototype",
    url: "https://www.skills.sh/emilkowalski/skills/prototype",
  },
  {
    id: "emilkowalski/review-animations",
    title: "review-animations",
    url: "https://www.skills.sh/emilkowalski/skills/review-animations",
  },
  {
    id: "emilkowalski/write-swift",
    title: "write-swift",
    url: "https://www.skills.sh/emilkowalski/skills/write-swift",
  },
  {
    id: "expo/add-app-clip",
    title: "add-app-clip",
    url: "https://www.skills.sh/expo/skills/add-app-clip",
  },
  {
    id: "expo/building-native-ui",
    title: "building-native-ui",
    url: "https://www.skills.sh/expo/skills/building-native-ui",
  },
  {
    id: "expo/eas-app-stores",
    title: "eas-app-stores",
    url: "https://www.skills.sh/expo/skills/eas-app-stores",
  },
  {
    id: "expo/eas-hosting",
    title: "eas-hosting",
    url: "https://www.skills.sh/expo/skills/eas-hosting",
  },
  {
    id: "expo/eas-observe",
    title: "eas-observe",
    url: "https://www.skills.sh/expo/skills/eas-observe",
  },
  {
    id: "expo/eas-simulator",
    title: "eas-simulator",
    url: "https://www.skills.sh/expo/skills/eas-simulator",
  },
  {
    id: "expo/eas-update-insights",
    title: "eas-update-insights",
    url: "https://www.skills.sh/expo/skills/eas-update-insights",
  },
  {
    id: "expo/eas-workflows",
    title: "eas-workflows",
    url: "https://www.skills.sh/expo/skills/eas-workflows",
  },
  {
    id: "expo/expo-app-clip",
    title: "expo-app-clip",
    url: "https://www.skills.sh/expo/skills/expo-app-clip",
  },
  {
    id: "expo/expo-brownfield",
    title: "expo-brownfield",
    url: "https://www.skills.sh/expo/skills/expo-brownfield",
  },
  {
    id: "expo/expo-data-fetching",
    title: "expo-data-fetching",
    url: "https://www.skills.sh/expo/skills/expo-data-fetching",
  },
  {
    id: "expo/expo-dev-client",
    title: "expo-dev-client",
    url: "https://www.skills.sh/expo/skills/expo-dev-client",
  },
  {
    id: "expo/expo-dom",
    title: "expo-dom",
    url: "https://www.skills.sh/expo/skills/expo-dom",
  },
  {
    id: "expo/expo-examples",
    title: "expo-examples",
    url: "https://www.skills.sh/expo/skills/expo-examples",
  },
  {
    id: "expo/expo-migrate-module",
    title: "expo-migrate-module",
    url: "https://www.skills.sh/expo/skills/expo-migrate-module",
  },
  {
    id: "expo/expo-module",
    title: "expo-module",
    url: "https://www.skills.sh/expo/skills/expo-module",
  },
  {
    id: "expo/expo-native-ui",
    title: "expo-native-ui",
    url: "https://www.skills.sh/expo/skills/expo-native-ui",
  },
  {
    id: "expo/expo-project-structure",
    title: "expo-project-structure",
    url: "https://www.skills.sh/expo/skills/expo-project-structure",
  },
  {
    id: "expo/expo-router",
    title: "expo-router",
    url: "https://www.skills.sh/expo/skills/expo-router",
  },
  {
    id: "expo/expo-skill-eval",
    title: "expo-skill-eval",
    url: "https://www.skills.sh/expo/skills/expo-skill-eval",
  },
  {
    id: "expo/expo-skill-feedback",
    title: "expo-skill-feedback",
    url: "https://www.skills.sh/expo/skills/expo-skill-feedback",
  },
  {
    id: "expo/expo-tailwind-setup",
    title: "expo-tailwind-setup",
    url: "https://www.skills.sh/expo/skills/expo-tailwind-setup",
  },
  {
    id: "expo/expo-ui",
    title: "expo-ui",
    url: "https://www.skills.sh/expo/skills/expo-ui",
  },
  {
    id: "expo/expo-ui-jetpack-compose",
    title: "expo-ui-jetpack-compose",
    url: "https://www.skills.sh/expo/skills/expo-ui-jetpack-compose",
  },
  {
    id: "expo/expo-ui-swiftui",
    title: "expo-ui-swiftui",
    url: "https://www.skills.sh/expo/skills/expo-ui-swiftui",
  },
  {
    id: "expo/expo-upgrade",
    title: "expo-upgrade",
    url: "https://www.skills.sh/expo/skills/expo-upgrade",
  },
  {
    id: "expo/expo-web-to-native",
    title: "expo-web-to-native",
    url: "https://www.skills.sh/expo/skills/expo-web-to-native",
  },
  {
    id: "expo/native-data-fetching",
    title: "native-data-fetching",
    url: "https://www.skills.sh/expo/skills/native-data-fetching",
  },
  {
    id: "expo/upgrading-expo",
    title: "upgrading-expo",
    url: "https://www.skills.sh/expo/skills/upgrading-expo",
  },
  {
    id: "feature-sliced/feature-sliced-design",
    title: "feature-sliced-design",
    url: "https://www.skills.sh/feature-sliced/skills/feature-sliced-design",
  },
  {
    id: "firecrawl/firecrawl-build-interact",
    title: "firecrawl-build-interact",
    url: "https://www.skills.sh/firecrawl/skills/firecrawl-build-interact",
  },
  {
    id: "firecrawl/firecrawl-build-onboarding",
    title: "firecrawl-build-onboarding",
    url: "https://www.skills.sh/firecrawl/skills/firecrawl-build-onboarding",
  },
  {
    id: "firecrawl/firecrawl-build-scrape",
    title: "firecrawl-build-scrape",
    url: "https://www.skills.sh/firecrawl/skills/firecrawl-build-scrape",
  },
  {
    id: "firecrawl/firecrawl-build-search",
    title: "firecrawl-build-search",
    url: "https://www.skills.sh/firecrawl/skills/firecrawl-build-search",
  },
  {
    id: "firecrawl/firecrawl-research-index",
    title: "firecrawl-research-index",
    url: "https://www.skills.sh/firecrawl/skills/firecrawl-research-index",
  },
  {
    id: "flowkit-labs/reddit-automation",
    title: "reddit-automation",
    url: "https://www.skills.sh/flowkit-labs/skills/reddit-automation",
  },
  {
    id: "genkit-ai/developing-genkit-js",
    title: "developing-genkit-js",
    url: "https://www.skills.sh/genkit-ai/skills/developing-genkit-js",
  },
  {
    id: "genmedia-labs/seedance-2-5-image-to-video",
    title: "seedance-2-5-image-to-video",
    url: "https://www.skills.sh/genmedia-labs/skills/seedance-2-5-image-to-video",
  },
  {
    id: "genmedia-labs/seedance-2-5-reference-to-video",
    title: "seedance-2-5-reference-to-video",
    url: "https://www.skills.sh/genmedia-labs/skills/seedance-2-5-reference-to-video",
  },
  {
    id: "genmedia-labs/video-edit",
    title: "video-edit",
    url: "https://www.skills.sh/genmedia-labs/skills/video-edit",
  },
  {
    id: "genmedia-labs/wan-3-0-prime-reference-to-video",
    title: "wan-3-0-prime-reference-to-video",
    url: "https://www.skills.sh/genmedia-labs/skills/wan-3-0-prime-reference-to-video",
  },
  {
    id: "getsentry/code-simplifier",
    title: "code-simplifier",
    url: "https://www.skills.sh/getsentry/skills/code-simplifier",
  },
  {
    id: "getsentry/security-review",
    title: "security-review",
    url: "https://www.skills.sh/getsentry/skills/security-review",
  },
  {
    id: "google/alloydb-basics",
    title: "alloydb-basics",
    url: "https://www.skills.sh/google/skills/alloydb-basics",
  },
  {
    id: "google/bigquery-basics",
    title: "bigquery-basics",
    url: "https://www.skills.sh/google/skills/bigquery-basics",
  },
  {
    id: "google/cloud-run-basics",
    title: "cloud-run-basics",
    url: "https://www.skills.sh/google/skills/cloud-run-basics",
  },
  {
    id: "google/cloud-sql-basics",
    title: "cloud-sql-basics",
    url: "https://www.skills.sh/google/skills/cloud-sql-basics",
  },
  {
    id: "google/firebase-basics",
    title: "firebase-basics",
    url: "https://www.skills.sh/google/skills/firebase-basics",
  },
  {
    id: "google/gemini-api",
    title: "gemini-api",
    url: "https://www.skills.sh/google/skills/gemini-api",
  },
  {
    id: "google/gemini-interactions-api",
    title: "gemini-interactions-api",
    url: "https://www.skills.sh/google/skills/gemini-interactions-api",
  },
  {
    id: "google/gke-basics",
    title: "gke-basics",
    url: "https://www.skills.sh/google/skills/gke-basics",
  },
  {
    id: "google/google-cloud-networking-observability",
    title: "google-cloud-networking-observability",
    url: "https://www.skills.sh/google/skills/google-cloud-networking-observability",
  },
  {
    id: "google/google-cloud-recipe-auth",
    title: "google-cloud-recipe-auth",
    url: "https://www.skills.sh/google/skills/google-cloud-recipe-auth",
  },
  {
    id: "google/google-cloud-recipe-onboarding",
    title: "google-cloud-recipe-onboarding",
    url: "https://www.skills.sh/google/skills/google-cloud-recipe-onboarding",
  },
  {
    id: "google/google-cloud-waf-cost-optimization",
    title: "google-cloud-waf-cost-optimization",
    url: "https://www.skills.sh/google/skills/google-cloud-waf-cost-optimization",
  },
  {
    id: "google/google-cloud-waf-reliability",
    title: "google-cloud-waf-reliability",
    url: "https://www.skills.sh/google/skills/google-cloud-waf-reliability",
  },
  {
    id: "google/google-cloud-waf-security",
    title: "google-cloud-waf-security",
    url: "https://www.skills.sh/google/skills/google-cloud-waf-security",
  },
  {
    id: "higgsfield-ai/higgsfield-brandkit",
    title: "higgsfield-brandkit",
    url: "https://www.skills.sh/higgsfield-ai/skills/higgsfield-brandkit",
  },
  {
    id: "higgsfield-ai/higgsfield-game-generation",
    title: "higgsfield-game-generation",
    url: "https://www.skills.sh/higgsfield-ai/skills/higgsfield-game-generation",
  },
  {
    id: "higgsfield-ai/higgsfield-generate",
    title: "higgsfield-generate",
    url: "https://www.skills.sh/higgsfield-ai/skills/higgsfield-generate",
  },
  {
    id: "higgsfield-ai/higgsfield-marketplace-cards",
    title: "higgsfield-marketplace-cards",
    url: "https://www.skills.sh/higgsfield-ai/skills/higgsfield-marketplace-cards",
  },
  {
    id: "higgsfield-ai/higgsfield-product-photoshoot",
    title: "higgsfield-product-photoshoot",
    url: "https://www.skills.sh/higgsfield-ai/skills/higgsfield-product-photoshoot",
  },
  {
    id: "higgsfield-ai/higgsfield-soul-id",
    title: "higgsfield-soul-id",
    url: "https://www.skills.sh/higgsfield-ai/skills/higgsfield-soul-id",
  },
  {
    id: "higgsfield-ai/higgsfield-video-explainer",
    title: "higgsfield-video-explainer",
    url: "https://www.skills.sh/higgsfield-ai/skills/higgsfield-video-explainer",
  },
  {
    id: "higgsfield-ai/higgsfield-websites",
    title: "higgsfield-websites",
    url: "https://www.skills.sh/higgsfield-ai/skills/higgsfield-websites",
  },
  {
    id: "higgsfield-ai/higgsfield-youtube-thumbnail",
    title: "higgsfield-youtube-thumbnail",
    url: "https://www.skills.sh/higgsfield-ai/skills/higgsfield-youtube-thumbnail",
  },
  {
    id: "hugmouse/value",
    title: "value",
    url: "https://www.skills.sh/hugmouse/skills/value",
  },
  {
    id: "humanlayer/show-me",
    title: "show-me",
    url: "https://www.skills.sh/humanlayer/skills/show-me",
  },
  {
    id: "jakubkrehel/better-accessibility",
    title: "better-accessibility",
    url: "https://www.skills.sh/jakubkrehel/skills/better-accessibility",
  },
  {
    id: "jakubkrehel/better-colors",
    title: "better-colors",
    url: "https://www.skills.sh/jakubkrehel/skills/better-colors",
  },
  {
    id: "jakubkrehel/better-interface",
    title: "better-interface",
    url: "https://www.skills.sh/jakubkrehel/skills/better-interface",
  },
  {
    id: "jakubkrehel/better-layout",
    title: "better-layout",
    url: "https://www.skills.sh/jakubkrehel/skills/better-layout",
  },
  {
    id: "jakubkrehel/better-typography",
    title: "better-typography",
    url: "https://www.skills.sh/jakubkrehel/skills/better-typography",
  },
  {
    id: "jakubkrehel/better-ui",
    title: "better-ui",
    url: "https://www.skills.sh/jakubkrehel/skills/better-ui",
  },
  {
    id: "jakubkrehel/better-writing",
    title: "better-writing",
    url: "https://www.skills.sh/jakubkrehel/skills/better-writing",
  },
  {
    id: "jakubkrehel/interface-review",
    title: "interface-review",
    url: "https://www.skills.sh/jakubkrehel/skills/interface-review",
  },
  {
    id: "langfuse/langfuse",
    title: "langfuse",
    url: "https://www.skills.sh/langfuse/skills/langfuse",
  },
  {
    id: "makenotion/notion-cli",
    title: "notion-cli",
    url: "https://www.skills.sh/makenotion/skills/notion-cli",
  },
  {
    id: "mastra-ai/mastra",
    title: "mastra",
    url: "https://www.skills.sh/mastra-ai/skills/mastra",
  },
  {
    id: "mattpocock/ask-matt",
    title: "ask-matt",
    url: "https://www.skills.sh/mattpocock/skills/ask-matt",
  },
  {
    id: "mattpocock/batch-grill-me",
    title: "batch-grill-me",
    url: "https://www.skills.sh/mattpocock/skills/batch-grill-me",
  },
  {
    id: "mattpocock/caveman",
    title: "caveman",
    url: "https://www.skills.sh/mattpocock/skills/caveman",
  },
  {
    id: "mattpocock/claude-handoff",
    title: "claude-handoff",
    url: "https://www.skills.sh/mattpocock/skills/claude-handoff",
  },
  {
    id: "mattpocock/code-review",
    title: "code-review",
    url: "https://www.skills.sh/mattpocock/skills/code-review",
  },
  {
    id: "mattpocock/codebase-design",
    title: "codebase-design",
    url: "https://www.skills.sh/mattpocock/skills/codebase-design",
  },
  {
    id: "mattpocock/decision-mapping",
    title: "decision-mapping",
    url: "https://www.skills.sh/mattpocock/skills/decision-mapping",
  },
  {
    id: "mattpocock/design-an-interface",
    title: "design-an-interface",
    url: "https://www.skills.sh/mattpocock/skills/design-an-interface",
  },
  {
    id: "mattpocock/diagnose",
    title: "diagnose",
    url: "https://www.skills.sh/mattpocock/skills/diagnose",
  },
  {
    id: "mattpocock/diagnosing-bugs",
    title: "diagnosing-bugs",
    url: "https://www.skills.sh/mattpocock/skills/diagnosing-bugs",
  },
  {
    id: "mattpocock/domain-modeling",
    title: "domain-modeling",
    url: "https://www.skills.sh/mattpocock/skills/domain-modeling",
  },
  {
    id: "mattpocock/edit-article",
    title: "edit-article",
    url: "https://www.skills.sh/mattpocock/skills/edit-article",
  },
  {
    id: "mattpocock/git-guardrails-claude-code",
    title: "git-guardrails-claude-code",
    url: "https://www.skills.sh/mattpocock/skills/git-guardrails-claude-code",
  },
  {
    id: "mattpocock/grill-me",
    title: "grill-me",
    url: "https://www.skills.sh/mattpocock/skills/grill-me",
  },
  {
    id: "mattpocock/grilling",
    title: "grilling",
    url: "https://www.skills.sh/mattpocock/skills/grilling",
  },
  {
    id: "mattpocock/implement",
    title: "implement",
    url: "https://www.skills.sh/mattpocock/skills/implement",
  },
  {
    id: "mattpocock/implement-spec",
    title: "implement-spec",
    url: "https://www.skills.sh/mattpocock/skills/implement-spec",
  },
  {
    id: "mattpocock/loop-me",
    title: "loop-me",
    url: "https://www.skills.sh/mattpocock/skills/loop-me",
  },
  {
    id: "mattpocock/obsidian-vault",
    title: "obsidian-vault",
    url: "https://www.skills.sh/mattpocock/skills/obsidian-vault",
  },
  {
    id: "mattpocock/qa",
    title: "qa",
    url: "https://www.skills.sh/mattpocock/skills/qa",
  },
  {
    id: "mattpocock/request-refactor-plan",
    title: "request-refactor-plan",
    url: "https://www.skills.sh/mattpocock/skills/request-refactor-plan",
  },
  {
    id: "mattpocock/research",
    title: "research",
    url: "https://www.skills.sh/mattpocock/skills/research",
  },
  {
    id: "mattpocock/resolving-merge-conflicts",
    title: "resolving-merge-conflicts",
    url: "https://www.skills.sh/mattpocock/skills/resolving-merge-conflicts",
  },
  {
    id: "mattpocock/retro",
    title: "retro",
    url: "https://www.skills.sh/mattpocock/skills/retro",
  },
  {
    id: "mattpocock/review",
    title: "review",
    url: "https://www.skills.sh/mattpocock/skills/review",
  },
  {
    id: "mattpocock/scaffold-exercises",
    title: "scaffold-exercises",
    url: "https://www.skills.sh/mattpocock/skills/scaffold-exercises",
  },
  {
    id: "mattpocock/setup-matt-pocock-skills",
    title: "setup-matt-pocock-skills",
    url: "https://www.skills.sh/mattpocock/skills/setup-matt-pocock-skills",
  },
  {
    id: "mattpocock/setup-pre-commit",
    title: "setup-pre-commit",
    url: "https://www.skills.sh/mattpocock/skills/setup-pre-commit",
  },
  {
    id: "mattpocock/setup-ts-deep-modules",
    title: "setup-ts-deep-modules",
    url: "https://www.skills.sh/mattpocock/skills/setup-ts-deep-modules",
  },
  {
    id: "mattpocock/teach",
    title: "teach",
    url: "https://www.skills.sh/mattpocock/skills/teach",
  },
  {
    id: "mattpocock/to-issues",
    title: "to-issues",
    url: "https://www.skills.sh/mattpocock/skills/to-issues",
  },
  {
    id: "mattpocock/to-prd",
    title: "to-prd",
    url: "https://www.skills.sh/mattpocock/skills/to-prd",
  },
  {
    id: "mattpocock/to-questionnaire",
    title: "to-questionnaire",
    url: "https://www.skills.sh/mattpocock/skills/to-questionnaire",
  },
  {
    id: "mattpocock/to-spec",
    title: "to-spec",
    url: "https://www.skills.sh/mattpocock/skills/to-spec",
  },
  {
    id: "mattpocock/to-tickets",
    title: "to-tickets",
    url: "https://www.skills.sh/mattpocock/skills/to-tickets",
  },
  {
    id: "mattpocock/ubiquitous-language",
    title: "ubiquitous-language",
    url: "https://www.skills.sh/mattpocock/skills/ubiquitous-language",
  },
  {
    id: "mattpocock/wait-what",
    title: "wait-what",
    url: "https://www.skills.sh/mattpocock/skills/wait-what",
  },
  {
    id: "mattpocock/wayfinder",
    title: "wayfinder",
    url: "https://www.skills.sh/mattpocock/skills/wayfinder",
  },
  {
    id: "mattpocock/wizard",
    title: "wizard",
    url: "https://www.skills.sh/mattpocock/skills/wizard",
  },
  {
    id: "mattpocock/write-a-skill",
    title: "write-a-skill",
    url: "https://www.skills.sh/mattpocock/skills/write-a-skill",
  },
  {
    id: "mattpocock/writing-for-agents",
    title: "writing-for-agents",
    url: "https://www.skills.sh/mattpocock/skills/writing-for-agents",
  },
  {
    id: "mattpocock/writing-great-skills",
    title: "writing-great-skills",
    url: "https://www.skills.sh/mattpocock/skills/writing-great-skills",
  },
  {
    id: "mattpocock/zoom-out",
    title: "zoom-out",
    url: "https://www.skills.sh/mattpocock/skills/zoom-out",
  },
  {
    id: "mcollina/fastify-best-practices",
    title: "fastify-best-practices",
    url: "https://www.skills.sh/mcollina/skills/fastify-best-practices",
  },
  {
    id: "mindrally/fastapi-python",
    title: "fastapi-python",
    url: "https://www.skills.sh/mindrally/skills/fastapi-python",
  },
  {
    id: "momentic-ai/momentic-explore-prompt",
    title: "momentic-explore-prompt",
    url: "https://www.skills.sh/momentic-ai/skills/momentic-explore-prompt",
  },
  {
    id: "momentic-ai/momentic-maintain",
    title: "momentic-maintain",
    url: "https://www.skills.sh/momentic-ai/skills/momentic-maintain",
  },
  {
    id: "momentic-ai/momentic-mobile-test",
    title: "momentic-mobile-test",
    url: "https://www.skills.sh/momentic-ai/skills/momentic-mobile-test",
  },
  {
    id: "momentic-ai/momentic-result-classification",
    title: "momentic-result-classification",
    url: "https://www.skills.sh/momentic-ai/skills/momentic-result-classification",
  },
  {
    id: "momentic-ai/momentic-spec",
    title: "momentic-spec",
    url: "https://www.skills.sh/momentic-ai/skills/momentic-spec",
  },
  {
    id: "momentic-ai/momentic-test",
    title: "momentic-test",
    url: "https://www.skills.sh/momentic-ai/skills/momentic-test",
  },
  {
    id: "openai/gh-fix-ci",
    title: "gh-fix-ci",
    url: "https://www.skills.sh/openai/skills/gh-fix-ci",
  },
  {
    id: "openai/linear",
    title: "linear",
    url: "https://www.skills.sh/openai/skills/linear",
  },
  {
    id: "openai/pdf",
    title: "pdf",
    url: "https://www.skills.sh/openai/skills/pdf",
  },
  {
    id: "openai/security-best-practices",
    title: "security-best-practices",
    url: "https://www.skills.sh/openai/skills/security-best-practices",
  },
  {
    id: "patricio0312rev/framer-motion-animator",
    title: "framer-motion-animator",
    url: "https://www.skills.sh/patricio0312rev/skills/framer-motion-animator",
  },
  {
    id: "pilioai/gpt-image-2",
    title: "gpt-image-2",
    url: "https://www.skills.sh/pilioai/skills/gpt-image-2",
  },
  {
    id: "pilioai/nano-banana-2",
    title: "nano-banana-2",
    url: "https://www.skills.sh/pilioai/skills/nano-banana-2",
  },
  {
    id: "prisma/prisma-cli",
    title: "prisma-cli",
    url: "https://www.skills.sh/prisma/skills/prisma-cli",
  },
  {
    id: "prisma/prisma-client-api",
    title: "prisma-client-api",
    url: "https://www.skills.sh/prisma/skills/prisma-client-api",
  },
  {
    id: "prisma/prisma-compute",
    title: "prisma-compute",
    url: "https://www.skills.sh/prisma/skills/prisma-compute",
  },
  {
    id: "prisma/prisma-database-setup",
    title: "prisma-database-setup",
    url: "https://www.skills.sh/prisma/skills/prisma-database-setup",
  },
  {
    id: "prisma/prisma-driver-adapter-implementation",
    title: "prisma-driver-adapter-implementation",
    url: "https://www.skills.sh/prisma/skills/prisma-driver-adapter-implementation",
  },
  {
    id: "prisma/prisma-mongodb-upgrade",
    title: "prisma-mongodb-upgrade",
    url: "https://www.skills.sh/prisma/skills/prisma-mongodb-upgrade",
  },
  {
    id: "prisma/prisma-postgres",
    title: "prisma-postgres",
    url: "https://www.skills.sh/prisma/skills/prisma-postgres",
  },
  {
    id: "prisma/prisma-postgres-setup",
    title: "prisma-postgres-setup",
    url: "https://www.skills.sh/prisma/skills/prisma-postgres-setup",
  },
  {
    id: "prisma/prisma-upgrade-v7",
    title: "prisma-upgrade-v7",
    url: "https://www.skills.sh/prisma/skills/prisma-upgrade-v7",
  },
  {
    id: "remotion-dev/mediabunny",
    title: "mediabunny",
    url: "https://www.skills.sh/remotion-dev/skills/mediabunny",
  },
  {
    id: "remotion-dev/remotion-best-practices",
    title: "remotion-best-practices",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-best-practices",
  },
  {
    id: "remotion-dev/remotion-captions",
    title: "remotion-captions",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-captions",
  },
  {
    id: "remotion-dev/remotion-create",
    title: "remotion-create",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-create",
  },
  {
    id: "remotion-dev/remotion-docs",
    title: "remotion-docs",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-docs",
  },
  {
    id: "remotion-dev/remotion-interactivity",
    title: "remotion-interactivity",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-interactivity",
  },
  {
    id: "remotion-dev/remotion-maps",
    title: "remotion-maps",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-maps",
  },
  {
    id: "remotion-dev/remotion-markup",
    title: "remotion-markup",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-markup",
  },
  {
    id: "remotion-dev/remotion-multimedia",
    title: "remotion-multimedia",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-multimedia",
  },
  {
    id: "remotion-dev/remotion-render",
    title: "remotion-render",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-render",
  },
  {
    id: "remotion-dev/remotion-saas",
    title: "remotion-saas",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-saas",
  },
  {
    id: "remotion-dev/remotion-studio",
    title: "remotion-studio",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-studio",
  },
  {
    id: "remotion-dev/remotion-upgrade",
    title: "remotion-upgrade",
    url: "https://www.skills.sh/remotion-dev/skills/remotion-upgrade",
  },
  {
    id: "rivet-dev/sandbox-agent",
    title: "sandbox-agent",
    url: "https://www.skills.sh/rivet-dev/skills/sandbox-agent",
  },
  {
    id: "skillify-sh/instagram-scraper",
    title: "instagram-scraper",
    url: "https://www.skills.sh/skillify-sh/skills/instagram-scraper",
  },
  {
    id: "squirrelscan/audit-website",
    title: "audit-website",
    url: "https://www.skills.sh/squirrelscan/skills/audit-website",
  },
  {
    id: "tavily-ai/search",
    title: "search",
    url: "https://www.skills.sh/tavily-ai/skills/search",
  },
  {
    id: "tavily-ai/tavily-best-practices",
    title: "tavily-best-practices",
    url: "https://www.skills.sh/tavily-ai/skills/tavily-best-practices",
  },
  {
    id: "tavily-ai/tavily-cli",
    title: "tavily-cli",
    url: "https://www.skills.sh/tavily-ai/skills/tavily-cli",
  },
  {
    id: "tavily-ai/tavily-crawl",
    title: "tavily-crawl",
    url: "https://www.skills.sh/tavily-ai/skills/tavily-crawl",
  },
  {
    id: "tavily-ai/tavily-dynamic-search",
    title: "tavily-dynamic-search",
    url: "https://www.skills.sh/tavily-ai/skills/tavily-dynamic-search",
  },
  {
    id: "tavily-ai/tavily-extract",
    title: "tavily-extract",
    url: "https://www.skills.sh/tavily-ai/skills/tavily-extract",
  },
  {
    id: "tavily-ai/tavily-map",
    title: "tavily-map",
    url: "https://www.skills.sh/tavily-ai/skills/tavily-map",
  },
  {
    id: "tavily-ai/tavily-research",
    title: "tavily-research",
    url: "https://www.skills.sh/tavily-ai/skills/tavily-research",
  },
  {
    id: "trailofbits/semgrep",
    title: "semgrep",
    url: "https://www.skills.sh/trailofbits/skills/semgrep",
  },
  {
    id: "upstash/upstash-ratelimit-js",
    title: "upstash-ratelimit-js",
    url: "https://www.skills.sh/upstash/skills/upstash-ratelimit-js",
  },
  {
    id: "upstash/upstash-redis-js",
    title: "upstash-redis-js",
    url: "https://www.skills.sh/upstash/skills/upstash-redis-js",
  },
  {
    id: "useosint/find-the-original-image",
    title: "find-the-original-image",
    url: "https://www.skills.sh/useosint/skills/find-the-original-image",
  },
  {
    id: "useosint/investigate-without-getting-made",
    title: "investigate-without-getting-made",
    url: "https://www.skills.sh/useosint/skills/investigate-without-getting-made",
  },
  {
    id: "useosint/is-this-photo-real",
    title: "is-this-photo-real",
    url: "https://www.skills.sh/useosint/skills/is-this-photo-real",
  },
  {
    id: "useosint/what-leaked-about-you",
    title: "what-leaked-about-you",
    url: "https://www.skills.sh/useosint/skills/what-leaked-about-you",
  },
  {
    id: "vercel-labs/find-skills",
    title: "find-skills",
    url: "https://www.skills.sh/vercel-labs/skills/find-skills",
  },
  {
    id: "vuejs-ai/create-adaptable-composable",
    title: "create-adaptable-composable",
    url: "https://www.skills.sh/vuejs-ai/skills/create-adaptable-composable",
  },
  {
    id: "vuejs-ai/vue-debug-guides",
    title: "vue-debug-guides",
    url: "https://www.skills.sh/vuejs-ai/skills/vue-debug-guides",
  },
  {
    id: "vuejs-ai/vue-jsx-best-practices",
    title: "vue-jsx-best-practices",
    url: "https://www.skills.sh/vuejs-ai/skills/vue-jsx-best-practices",
  },
  {
    id: "vuejs-ai/vue-options-api-best-practices",
    title: "vue-options-api-best-practices",
    url: "https://www.skills.sh/vuejs-ai/skills/vue-options-api-best-practices",
  },
  {
    id: "vuejs-ai/vue-pinia-best-practices",
    title: "vue-pinia-best-practices",
    url: "https://www.skills.sh/vuejs-ai/skills/vue-pinia-best-practices",
  },
  {
    id: "vuejs-ai/vue-router-best-practices",
    title: "vue-router-best-practices",
    url: "https://www.skills.sh/vuejs-ai/skills/vue-router-best-practices",
  },
  {
    id: "vuejs-ai/vue-testing-best-practices",
    title: "vue-testing-best-practices",
    url: "https://www.skills.sh/vuejs-ai/skills/vue-testing-best-practices",
  },
];
