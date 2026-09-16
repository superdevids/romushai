// Store job PRD in-memory (server-only).
// Pipeline berjalan LEPAS dari umur request HTTP: event ditampung di buffer job
// sehingga client boleh putus (tab pindah/ditutup) lalu reconnect dan replay.
//
// ponytail: store per-proses. Di deploy multi-instance (Vercel serverless) job
// hanya bisa dilanjutkan pada instansi yang sama; upgrade path = pindah buffer ke
// Upstash Redis (pola sudah ada di rate-limit-redis.ts) atau Vercel KV.

import type { DocName, Emit, FailedDoc, GeneratedDoc, MemorySummary } from "./types.ts";

export interface JobEventMap {
  stage_start: { stage: number; name: string };
  chunk: { stage: number; doc?: DocName; text: string };
  stage_end: { stage: number };
  plan: { docs: DocName[] };
  error: { stage: number; kind: "retryable" | "fatal"; message: string };
  done: {
    docs: GeneratedDoc[];
    taskCount: number;
    failed: FailedDoc[];
    scope: string;
    analysis?: string;
    gaps?: string[];
    memory?: MemorySummary;
  };
}

export type JobEventName = keyof JobEventMap;

export interface BufferedEvent {
  /** Urutan monotonik per job; dipakai cursor reconnect. */
  id: number;
  event: string;
  data: unknown;
}

export type JobStatus = "running" | "completed" | "failed";

export interface JobState {
  id: string;
  kind: "generate" | "regenerate";
  createdAt: number;
  updatedAt: number;
  status: JobStatus;
  events: BufferedEvent[];
  /** Pendengar event live (stream SSE yang sedang menempel). */
  listeners: Set<(evt: BufferedEvent) => void>;
  nextSeq: number;
  abortController: AbortController;
}

const JOBS = new Map<string, JobState>();
/** Jumlah job maksimum yang disimpan; lebih tua dibuang (LRU by updatedAt). */
const MAX_JOBS = 100;
/** Job selesai dipegang selama ini agar reconnect masih bisa replay hasil. */
const JOB_TTL_MS = 60 * 60_000;
/** Plafon event per job: chunk di-coalesce, tapi tetap butuh pagar. */
const MAX_EVENTS = 4_000;

function sweep(): void {
  const now = Date.now();
  for (const [id, job] of JOBS) {
    if (job.status !== "running" && now - job.updatedAt > JOB_TTL_MS) JOBS.delete(id);
  }
  if (JOBS.size <= MAX_JOBS) return;
  const oldest = [...JOBS.entries()]
    .filter(([, j]) => j.status !== "running")
    .sort((a, b) => a[1].updatedAt - b[1].updatedAt)
    .slice(0, JOBS.size - MAX_JOBS);
  for (const [id] of oldest) JOBS.delete(id);
}

let seq = 0;
export function createJob(kind: JobState["kind"]): JobState {
  sweep();
  seq += 1;
  const id = `j${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const job: JobState = {
    id,
    kind,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "running",
    events: [],
    listeners: new Set(),
    nextSeq: 1,
    abortController: new AbortController(),
  };
  JOBS.set(id, job);
  return job;
}

export function getJob(id: string): JobState | undefined {
  return JOBS.get(id);
}

/**
 * Tampung satu event ke buffer job + kirim ke pendengar live.
 *
 * Chunk dengan (stage, doc) sama di-COALESCE di buffer: satu entri menyimpan
 * TEKS KUMULATIF (snapshot). Snapshot adalah yang di-replay ke client baru,
 * sehingga jumlah entri tetap kecil walau dokumen sangat panjang.
 *
 * Pendengar LIVE menerima DELTA (teks baru saja), bukan snapshot - kalau
 * snapshot dikirim ulang, client akan menggandakan teks. Delta memakai id baru
 * dari nextSeq supaya tidak dibuang oleh penjaga `id <= sent` di sse-job.ts.
 */
export function pushJobEvent(job: JobState, event: string, data: unknown): void {
  job.updatedAt = Date.now();

  if (event === "chunk") {
    const last = job.events[job.events.length - 1];
    const d = data as JobEventMap["chunk"];
    if (last && last.event === "chunk") {
      const ld = last.data as JobEventMap["chunk"];
      if (ld.stage === d.stage && ld.doc === d.doc) {
        ld.text += d.text;
        notify(job, { id: job.nextSeq++, event, data: d });
        return;
      }
    }
  }

  const buffered: BufferedEvent = { id: job.nextSeq++, event, data };
  job.events.push(buffered);
  // Plafon praktis tak tercapai (satu entri per segmen stream), tapi tetap dijaga:
  // teks chunk terlama dikosongkan - id TIDAK pernah dipakai ulang, karena
  // cursor reconnect bergantung pada id monotonik.
  if (job.events.length > MAX_EVENTS) {
    const idx = job.events.findIndex((e, i) => e.event === "chunk" && i < job.events.length - 1);
    if (idx >= 0) (job.events[idx].data as JobEventMap["chunk"]).text = "";
  }

  if (event === "done") job.status = "completed";
  else if (event === "error" && (data as { kind?: unknown } | null)?.kind === "fatal") job.status = "failed";

  notify(job, buffered);
}

function notify(job: JobState, evt: BufferedEvent): void {
  for (const listener of job.listeners) {
    try {
      listener(evt);
    } catch {
      // pendengar sudah putus; jangan ganggu job
    }
  }
}

/** Berhenti menerima event baru (dipanggil saat stream client putus). */
export function subscribeJob(job: JobState, listener: (evt: BufferedEvent) => void): () => void {
  job.listeners.add(listener);
  return () => {
    job.listeners.delete(listener);
  };
}

/** Adapter Emit pipeline -> buffer job. */
export function emitForJob(job: JobState): Emit {
  return ((event: string, data: unknown) => {
    pushJobEvent(job, event, data);
  }) as Emit;
}

/** Hentikan job (dipakai tombol batal / chat baru). */
export function abortJob(id: string): boolean {
  const job = JOBS.get(id);
  if (!job) return false;
  if (job.status === "running") job.abortController.abort();
  return true;
}
