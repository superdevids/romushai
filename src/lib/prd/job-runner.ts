// Runner job PRD di background: pipeline dijalankan TANPA terikat umur request HTTP.
// Event masuk buffer job (job-store.ts) sehingga client boleh putus lalu reconnect
// dan replay dari cursor. Server-only.

import { runGeneratePipeline, runRegenerateDoc, envConfig } from "./pipeline.ts";
import { createJob, emitForJob, pushJobEvent, type JobState } from "./job-store.ts";
import { digestFor, deriveDomain, learnFromOutcome, recordOutcome } from "./memory.ts";
import { countTasks } from "./parse.ts";
import type { DocName, FailedDoc, GeneratedDoc, LlmConfig, MemorySummary } from "./types.ts";

/**
 * Plafon waktu TOTAL satu job (ms). Sama seperti GENERATE_BUDGET_MS pada route
 * /api/generate: harus lebih kecil dari maxDuration (300 dtk) supaya job sempat
 * menandai status terminal sebelum platform mematikan fungsi.
 */
export const JOB_BUDGET_MS = parseBudget(process.env.GENERATE_BUDGET_MS, 280_000);
export const REGENERATE_JOB_BUDGET_MS = parseBudget(process.env.REGENERATE_BUDGET_MS, 280_000);

function parseBudget(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function cfgOrUndefined(): LlmConfig | undefined {
  try {
    return envConfig();
  } catch {
    return undefined;
  }
}

/**
 * Mulai job generate: kembalikan job SEGERA (panggilan model jalan di background).
 * `after()` pada route yang membuat fungsi tetap hidup sampai promise selesai.
 */
export function startGenerateJob(idea: string, answers?: string[], seeded?: { analysis: string; gaps: string[] }): { job: JobState; promise: Promise<void> } {
  const job = createJob("generate");
  const promise = runGenerateJob(job, idea, answers, seeded);
  return { job, promise };
}

export interface RegenerateParams {
  idea: string;
  scope: string;
  doc: DocName;
  docs?: GeneratedDoc[];
  answers?: string[];
  analysis?: string;
  gaps?: string[];
}

/** Mulai job regenerate satu dokumen (stateless, konteks dikirim client). */
export function startRegenerateJob(params: RegenerateParams): { job: JobState; promise: Promise<void> } {
  const job = createJob("regenerate");
  const promise = runRegenerateJob(job, params);
  return { job, promise };
}

/** Jalankan pipeline generate penuh untuk satu job. Tidak pernah melempar. */
export async function runGenerateJob(job: JobState, idea: string, answers?: string[], seeded?: { analysis: string; gaps: string[] }): Promise<void> {
  const cfg = cfgOrUndefined();
  if (!cfg) {
    pushJobEvent(job, "error", {
      stage: 1,
      kind: "fatal",
      message: "Konfigurasi penyedia model tidak lengkap (LLM_API_KEY belum diatur).",
    });
    return;
  }

  const emit = emitForJob(job);
  const timer = setTimeout(() => {
    pushJobEvent(job, "error", {
      stage: 0,
      kind: "fatal",
      message: `Batas waktu generasi tercapai (${JOB_BUDGET_MS} ms). Dokumen yang sudah selesai tetap dikirim.`,
    });
    job.abortController.abort();
  }, JOB_BUDGET_MS);

  try {
    let memoryDigest = "";
    try {
      memoryDigest = await digestFor(undefined, deriveDomain(idea));
    } catch {
      memoryDigest = "";
    }

    const outcome = await runGeneratePipeline({
      cfg,
      idea,
      answers,
      signal: job.abortController.signal,
      emit,
      memoryDigest,
      seededAnalysis: seeded?.analysis,
      seededGaps: seeded?.gaps,
    });

    let memory: MemorySummary | undefined;
    if (outcome.memory) {
      try {
        memory = (await learnFromOutcome(outcome.memory)).summary;
      } catch {
        memory = undefined;
      }
    }

    // JANGAN emit done kosong (docs & failed nol): error fatal yang sudah
    // di-emit pipeline harus tetap menjadi event terminal.
    if (outcome.docs.length > 0 || outcome.failed.length > 0) {
      pushJobEvent(job, "done", {
        docs: outcome.docs,
        taskCount: outcome.taskCount,
        failed: outcome.failed,
        scope: outcome.scope,
        analysis: outcome.analysis,
        gaps: outcome.gaps,
        memory,
      });
    }
  } catch (e) {
    if (job.status === "running") {
      pushJobEvent(job, "error", {
        stage: 0,
        kind: "fatal",
        message: e instanceof Error ? e.message : "Terjadi kesalahan internal pada server.",
      });
    }
  } finally {
    clearTimeout(timer);
    if (job.status === "running") {
      pushJobEvent(job, "error", { stage: 0, kind: "fatal", message: "Job berakhir tanpa hasil final." });
    }
  }
}

/** Jalankan regenerate satu dokumen untuk satu job. Tidak pernah melempar. */
export async function runRegenerateJob(job: JobState, params: RegenerateParams): Promise<void> {
  const cfg = cfgOrUndefined();
  if (!cfg) {
    pushJobEvent(job, "error", {
      stage: 1,
      kind: "fatal",
      message: "Konfigurasi penyedia model tidak lengkap (LLM_API_KEY belum diatur).",
    });
    return;
  }

  const { idea, scope, doc, docs, answers, analysis, gaps } = params;
  const emit = emitForJob(job);
  const timer = setTimeout(() => job.abortController.abort(), REGENERATE_JOB_BUDGET_MS);

  try {
    let memoryDigest = "";
    try {
      memoryDigest = await digestFor(doc, deriveDomain(idea));
    } catch {
      memoryDigest = "";
    }

    const startedAt = Date.now();
    const result = await runRegenerateDoc({
      cfg,
      idea,
      scope,
      doc,
      docs,
      answers,
      analysis,
      gaps,
      signal: job.abortController.signal,
      emit,
      memoryDigest,
    });

    let memory: MemorySummary | undefined;
    try {
      const ok = !("reason" in result);
      const record = recordOutcome({
        idea,
        docType: result.name,
        signals: {
          retries: 0,
          failedDocs: ok ? 0 : 1,
          durationMs: Date.now() - startedAt,
          stage: doc === "TASK-LIST" ? 4 : 3,
        },
      });
      memory = (await learnFromOutcome(record)).summary;
    } catch {
      memory = undefined;
    }

    if (job.status !== "running") return; // budget habis -> error fatal sudah di-emit

    if ("content" in result) {
      const generated = result as GeneratedDoc;
      pushJobEvent(job, "done", {
        docs: [{ name: generated.name, content: generated.content }],
        taskCount: generated.name === "TASK-LIST" ? countTasks(generated.content) : 0,
        failed: [],
        scope,
        memory,
      });
    } else {
      const failed = result as FailedDoc;
      pushJobEvent(job, "done", {
        docs: [],
        taskCount: 0,
        failed: [{ name: failed.name, reason: failed.reason }],
        scope,
        memory,
      });
    }
  } catch (e) {
    if (job.status === "running") {
      pushJobEvent(job, "error", {
        stage: 0,
        kind: "fatal",
        message: e instanceof Error ? e.message : "Terjadi kesalahan internal pada server.",
      });
    }
  } finally {
    clearTimeout(timer);
    if (job.status === "running") {
      pushJobEvent(job, "error", { stage: 0, kind: "fatal", message: "Job berakhir tanpa hasil final." });
    }
  }
}
