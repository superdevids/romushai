// Klien job PRD (browser): pipeline jalan DI SERVER secara independen; koneksi SSE
// hanya jendela pandang. Putus (tab belakang / ditutup) -> job tetap jalan;
// buka lagi -> replay dari cursor lalu lanjut live.

import { readSse } from "./sse-client.ts";
import type { SseEventMap } from "./sse-client.ts";
import type { SseCompletion } from "./types.ts";

export interface ActiveJob {
  jobId: string;
  kind: "generate" | "regenerate";
  createdAt: number;
  /** Cursor event terakhir yang sudah diproses (bahan replay presisi). */
  cursor: number;
  /** Konteks untuk resume setelah reload: teks ide + jawaban klarifikasi. */
  idea?: string;
  answers?: string[];
  /** Regenerate: dokumen target. */
  doc?: string;
}

const ACTIVE_JOB_KEY = "romushai-active-job:v1";

export function loadActiveJob(): ActiveJob | null {
  try {
    const raw = localStorage.getItem(ACTIVE_JOB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveJob> | null;
    if (!parsed || typeof parsed.jobId !== "string" || parsed.jobId.length === 0) return null;
    return {
      jobId: parsed.jobId,
      kind: parsed.kind === "regenerate" ? "regenerate" : "generate",
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
      cursor: typeof parsed.cursor === "number" && parsed.cursor >= 0 ? parsed.cursor : 0,
      idea: typeof parsed.idea === "string" ? parsed.idea : undefined,
      answers: Array.isArray(parsed.answers) ? parsed.answers.filter((a): a is string => typeof a === "string") : undefined,
      doc: typeof parsed.doc === "string" ? parsed.doc : undefined,
    };
  } catch {
    return null;
  }
}

export function saveActiveJob(job: ActiveJob | null): void {
  try {
    if (job === null) localStorage.removeItem(ACTIVE_JOB_KEY);
    else localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(job));
  } catch {
    // penyimpanan tidak tersedia; abaikan
  }
}

export class JobRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Buat job generate di server; mengembalikan jobId. */
export async function createJob(
  idea: string,
  answers: string[] | undefined,
  signal: AbortSignal,
  seed?: { analysis: string; gaps: string[] },
): Promise<string> {
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, answers, analysis: seed?.analysis, gaps: seed?.gaps }),
    signal,
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new JobRequestError(payload?.error ?? `Gagal memulai generasi (HTTP ${res.status}).`, res.status);
  }
  const data = (await res.json()) as { jobId?: string };
  if (!data.jobId) throw new JobRequestError("Respons server tanpa jobId.", 500);
  return data.jobId;
}

/** Buat job regenerate satu dokumen di server; mengembalikan jobId. */
export async function createRegenerateJob(body: unknown, signal: AbortSignal): Promise<string> {
  const res = await fetch("/api/jobs/regenerate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new JobRequestError(payload?.error ?? `Gagal memulai regenerasi (HTTP ${res.status}).`, res.status);
  }
  const data = (await res.json()) as { jobId?: string };
  if (!data.jobId) throw new JobRequestError("Respons server tanpa jobId.", 500);
  return data.jobId;
}

/** Hentikan job di server (best-effort; kegagalan diabaikan). */
export async function cancelJob(jobId: string): Promise<void> {
  try {
    await fetch(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "DELETE" });
  } catch {
    // abaikan
  }
}

const PROCESSED_KEY = "romushai-processed-jobs:v1";

/**
 * True bila job ini BARU selesai diproses per browser. Replay setelah reconnect
 * mengirim ulang event "done"; guard ini mencegah riwayat/memori tercatat dua kali.
 */
export function markJobProcessed(jobId: string): boolean {
  try {
    const raw = localStorage.getItem(PROCESSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    if (list.includes(jobId)) return false;
    list.push(jobId);
    localStorage.setItem(PROCESSED_KEY, JSON.stringify(list.slice(-100)));
    return true;
  } catch {
    return true;
  }
}

export interface StreamJobOptions {
  jobId: string;
  handlers: { [K in keyof SseEventMap]: (d: SseEventMap[K]) => void };
  signal: AbortSignal;
  /** Cursor awal (replay) dan pembaruan tiap event terbaca. */
  startCursor?: number;
  onCursor?: (cursor: number) => void;
  /** Reconnect maksimum sebelum menyerah (default 20). */
  maxReconnects?: number;
}

export interface StreamJobResult {
  completed: boolean;
  completion: SseCompletion;
  reconnects: number;
  lastCursor: number;
}

const BACKOFF_MS = [500, 1000, 2000, 3000, 5000, 8000];

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/**
 * Baca stream satu job dengan auto-reconnect berbasis cursor.
 * Server menyimpan semua event (chunk di-coalesce), jadi replay dari cursor
 * menghasilkan teks identik tanpa duplikasi. Client diperbolehkan beku/putus
 * berapa lama pun: begitu loop aktif lagi, backoff menautkan ulang stream.
 */
export async function streamJob(opts: StreamJobOptions): Promise<StreamJobResult> {
  const { jobId, handlers, signal, onCursor } = opts;
  const maxReconnects = opts.maxReconnects ?? 20;
  let cursor = opts.startCursor ?? 0;
  let reconnects = 0;
  const fail = (completion: SseCompletion): StreamJobResult => ({
    completed: false,
    completion,
    reconnects,
    lastCursor: cursor,
  });

  for (;;) {
    if (signal.aborted) return fail("error");
    let res: Response;
    try {
      res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/events?cursor=${cursor}`, {
        headers: { Accept: "text/event-stream" },
        cache: "no-store",
        signal,
      });
    } catch {
      if (signal.aborted) return fail("error");
      if (reconnects >= maxReconnects) {
        handlers.error({ stage: 0, kind: "retryable", message: "Gagal menyambung ulang ke server. Progres tersimpan; coba lagi." });
        return fail("error");
      }
      reconnects += 1;
      await sleep(BACKOFF_MS[Math.min(reconnects - 1, BACKOFF_MS.length - 1)], signal);
      continue;
    }

    if (!res.ok) {
      const message = res.status === 404 ? "Job sudah kedaluwarsa di server." : `Server membalas HTTP ${res.status}.`;
      handlers.error({ stage: 0, kind: "fatal", message });
      return fail("error");
    }

    const result = await readSse(res, handlers, {
      onId: (id) => {
        cursor = id;
        onCursor?.(id);
      },
      // Reconnect ditangani di sini: putus di tengah TIDAK boleh memunculkan
      // error palsu di UI; loop di bawah yang memutuskan retry/serah.
      quietDisconnect: true,
    });

    if (result.completed) return { completed: true, completion: "done", reconnects, lastCursor: cursor };
    // Error fatal dari server = terminal; job tidak akan menghasilkan apa pun lagi.
    if (result.sawFatal) return fail("error");
    // Terputus tanpa terminal: job masih hidup di server -> tautkan ulang.
    if (reconnects >= maxReconnects) {
      handlers.error({ stage: 0, kind: "retryable", message: "Koneksi terputus berulang kali. Progres tersimpan; buka ulang untuk melanjutkan." });
      return fail(result.completion);
    }
    reconnects += 1;
    await sleep(BACKOFF_MS[Math.min(reconnects - 1, BACKOFF_MS.length - 1)], signal);
  }
}
