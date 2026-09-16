// Jenis data bersama untuk pipeline PRD dan protokol SSE.

export const DOC_NAMES = [
  "MASTER-PRD",
  "ARCHITECTURE",
  "API-TECH",
  "WEB-REFERENCE",
  "UIUX-SPEC",
  "DATABASE",
  "TEST-PLAN",
  "ENV-SECURITY",
  "DEPLOYMENT",
  "TASK-LIST",
  "AGENTS",
  "SKILLS",
  "RULES",
] as const;

export type DocName = (typeof DOC_NAMES)[number];

/**
 * Label resmi per stage SSE (satu sumber kebenaran: server emit + chip UI).
 * Penomoran "Langkah" adalah kontrak produk: stage 0a/0b/1 = Langkah 1;
 * draf dokumen & task list berbagi Langkah 3; finalisasi = Langkah 7.
 */
export const STAGE_LABELS: Record<number, string> = {
  0: "Langkah 1: Analisis Kebutuhan Secara Mendalam dan Komprehensif",
  1: "Langkah 1: Analisis Kebutuhan Secara Mendalam dan Komprehensif",
  2: "Langkah 2: Pengambilan Skill dan Kapabilitas Agent yang Relevan",
  3: "Langkah 3: Penulisan Draf Dokumen",
  4: "Langkah 3: Penyusunan Task List",
  5: "Langkah 4: Verifikasi Kesesuaian Dokumen dengan Kebutuhan Pengguna",
  6: "Langkah 5: Audit Red-Team oleh Agent Hacker",
  7: "Langkah 6: Perbaikan Kesenjangan dan Kelemahan",
  8: "Langkah 7: Finalisasi Dokumen",
};

/** Kategori baku pertanyaan klarifikasi (dipakai parser + prompt + UI). */
export const QUESTION_CATEGORIES = [
  "Cakupan",
  "Pengguna",
  "Fitur",
  "Teknis",
  "Bisnis",
  "Data",
  "Lainnya",
] as const;

export interface ClarifyQuestion {
  q: string;
  options: string[];
  recommended: string;
  /** Judul singkat (additive; absen pada record lama -> fallback dari q). */
  title?: string;
  /** Kategori baku (additive; absen/tidak valid -> "Lainnya"). */
  category?: string;
}

export interface GeneratedDoc {
  name: DocName;
  content: string;
}

export interface FailedDoc {
  name: DocName;
  reason: string;
}

/** Satu temuan dari tahap verifikasi/audit red-team (stage 5-7). */
export interface AuditFinding {
  /** Nama dokumen sasaran (boleh nama dokumen final apa pun). */
  doc: string;
  /** Tingkat keparahan (CRITICAL/HIGH/MEDIUM/LOW); absen = MEDIUM. */
  severity?: string;
  masalah: string;
  saran: string;
}

// --- Memori kemampuan jangka panjang agent (lihat memory-core.ts) ---

/** Sinyal eksekusi yang menjadi bahan pembelajaran agent. */
export interface MemorySignals {
  retries: number;
  failedDocs: number;
  durationMs: number;
  stage: number;
}

/** Satu kebiasaan agent yang dipelajari dari eksekusi nyata (schema v1). */
export interface AgentMemory {
  v: 1;
  id: string;
  timestamp: number;
  domain: string;
  docType: DocName;
  agentName: string;
  techniques: string[];
  pitfalls: string[];
  signals: MemorySignals;
  quality: number;
  occurrences: number;
  avgQuality: number;
  promoted: boolean;
  lastSeen: number;
}

/** Ringkasan memori yang dikirim pada event SSE "done" (additive, opsional). */
export interface MemorySummary {
  techniques: string[];
  pitfalls: string[];
  quality: number;
  promotedCount: number;
}

/** Status akhir pembacaan stream SSE sisi client (additive). */
export type SseCompletion = "done" | "truncated" | "error";

// Fungsi emit dengan overload: payload harus cocok dengan nama event.
export interface Emit {
  (event: "stage_start", data: { stage: number; name: string }): void;
  (event: "chunk", data: { stage: number; doc?: DocName; text: string }): void;
  (event: "stage_end", data: { stage: number }): void;
  (event: "plan", data: { docs: DocName[] }): void;
  (event: "error", data: { stage: number; kind: "retryable" | "fatal"; message: string }): void;
  (event: "done", data: { docs: GeneratedDoc[]; taskCount: number; failed: FailedDoc[]; scope: string; analysis?: string; gaps?: string[]; memory?: MemorySummary }): void;
}

export interface PipelineOutcome {
  docs: GeneratedDoc[];
  taskCount: number;
  failed: FailedDoc[];
  scope: string;
  /** Hasil stage 0a (analisis mendalam) - dipakai sebagai konteks stage 1-4. */
  analysis: string;
  /** Gap dari stage 0b - dipakai sebagai konteks stage 1-4. */
  gaps: string[];
  /** Kebiasaan yang dipelajari dari eksekusi ini (additive; absen bila tidak dihitung). */
  memory?: AgentMemory;
}

// Konfigurasi penyedia LLM OpenAI-compatible (server-only).
export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  modelSmall: string;
  modelStrong: string;
}