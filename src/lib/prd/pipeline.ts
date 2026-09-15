// Orkestrasi pipeline PRD. Label langkah 1-7 mengikuti urutan eksekusi:
// langkah 1 = stage 0a + 0b + stage 1, langkah 2 = stage 2,
// langkah 3 = stage 4 (TASK-LIST), langkah 4 = stage 5 (verifikasi),
// langkah 5 = stage 6 (audit hacker), langkah 6 = stage 7 (perbaikan),
// langkah 7 = stage 8 (penulisan final). Stage 3 (draf dokumen) tanpa nomor langkah. Server-only.

import { streamChatCompletion, LlmError, type ChatMessage } from "./llm.ts";
import {
  parseDocRecommendation,
  countTasks,
  parseClarify,
  parseStage0b,
  parseAuditFindings,
  validateDocMarkdown,
} from "./parse.ts";
import {
  stage1Messages,
  stage2Messages,
  stage3Messages,
  stage4Messages,
  retryStage2Note,
  clarifyMessages,
  stage0aMessages,
  stage0bMessages,
  verifyDocsMessages,
  hackerAuditMessages,
  repairDocMessages,
} from "./prompts.ts";
import type {
  AuditFinding,
  DocName,
  Emit,
  FailedDoc,
  GeneratedDoc,
  LlmConfig,
  PipelineOutcome,
  ClarifyQuestion,
} from "./types.ts";
import { DOC_NAMES } from "./types.ts";
import { recordOutcome } from "./memory-core.ts";

const MAX_ATTEMPTS = 3; // percobaan awal + 2 retry
const BACKOFF_MS = [0, 1000, 2000];
// Batas jumlah dokumen yang diperbaiki pada stage 7 (kendali biaya/latensi).
const MAX_REPAIR_DOCS = 4;
// Nomor tahap SSE untuk tahap baru (protokol SSE tidak berubah; hanya nomor tahap).
export const STAGE_VERIFY = 5;
export const STAGE_HACKER = 6;
export const STAGE_REPAIR = 7;
export const STAGE_FINAL_WRITE = 8;
export const STAGE_TIMEOUT_MS = parseTimeoutEnv(process.env.LLM_TIMEOUT_MS);

function parseTimeoutEnv(value: string | undefined): number {
  const parsed = value === undefined ? NaN : Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return 300_000;
}

/** Guard SSRF ringan: hanya http/https; di produksi tolak host loopback/link-local. */
function assertSafeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`LLM_BASE_URL tidak valid: "${raw}" bukan URL absolut.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`LLM_BASE_URL harus memakai protokol http/https (ditemukan "${url.protocol}").`);
  }
  if (process.env.NODE_ENV === "production") {
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const isLoopback =
      host === "localhost" || host === "::1" || host === "0.0.0.0" || host === "127.0.0.1" || host.startsWith("127.");
    const isLinkLocal = host.startsWith("169.254.") || host.startsWith("fe80:");
    if (isLoopback || isLinkLocal) {
      throw new Error(`LLM_BASE_URL menunjuk host lokal/link-local "${host}" yang dilarang di produksi.`);
    }
  }
  return raw;
}

export function envConfig(): LlmConfig {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY belum diatur (lihat .env.example).");
  const baseUrl = assertSafeBaseUrl(
    (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, ""),
  );
  return {
    apiKey,
    baseUrl,
    modelSmall: process.env.LLM_MODEL_SMALL ?? "gpt-4o-mini",
    modelStrong: process.env.LLM_MODEL_STRONG ?? "gpt-4o",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type CallResult =
  | { ok: true; text: string; attempts: number }
  | { ok: false; kind: "retryable" | "fatal"; message: string; attempts: number };

export async function callWithRetry(opts: {
  cfg: LlmConfig;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
}): Promise<CallResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt]);
    try {
      const text = await streamChatCompletion({
        cfg: opts.cfg,
        model: opts.model,
        messages: opts.messages,
        signal: opts.signal,
        timeoutMs: STAGE_TIMEOUT_MS,
        onChunk: opts.onChunk ?? (() => undefined),
      });
      return { ok: true, text, attempts: attempt + 1 };
    } catch (e) {
      if (opts.signal?.aborted) return { ok: false, kind: "fatal", message: "aborted", attempts: attempt + 1 };
      if (e instanceof LlmError && e.kind === "fatal") {
        return { ok: false, kind: "fatal", message: e.message, attempts: attempt + 1 };
      }
      lastError = e;
    }
  }
  const raw = lastError instanceof Error ? lastError.message : "Penyedia model gagal setelah beberapa percobaan.";
  const message = raw.length > 200 ? raw.slice(0, 200) + "..." : raw;
  return { ok: false, kind: "retryable", message, attempts: MAX_ATTEMPTS };
}

export interface GenerateOptions {
  cfg: LlmConfig;
  idea: string;
  answers?: string[];
  signal?: AbortSignal;
  emit: Emit;
  /** Digest memori agent (additive, opsional): pelajaran dari eksekusi sebelumnya. */
  memoryDigest?: string;
}

const DOC_LOOKUP = new Map<string, DocName>(DOC_NAMES.map((n) => [n.toUpperCase(), n]));

/** Normalisasi string apa pun ke DocName kanonik (mis. "agents.md" -> "AGENTS.md"); null bila tak dikenal. */
export function normalizeDocName(value: string): DocName | null {
	return DOC_LOOKUP.get(value.trim().toUpperCase()) ?? null;
}

/**
 * Tempelkan temuan perbaikan ke pesan user terakhir. Dipakai jalur TASK-LIST yang
 * memakai prompt stage 4 (bukan repairDocMessages), sehingga temuan tidak bisa
 * disisipkan lewat template repair.
 */
function withRepairNotes(messages: ChatMessage[], notes: string[]): ChatMessage[] {
  if (notes.length === 0) return messages;
  const block = `\n\nTEMUAN VERIFIKASI DAN AUDIT YANG WAJIB DIPERBAIKI:\n${notes.map((n) => `- ${n}`).join("\n")}`;
  return messages.map((m, i) => (i === messages.length - 1 ? { ...m, content: `${m.content}${block}` } : m));
}

export async function runGeneratePipeline(opts: GenerateOptions): Promise<PipelineOutcome> {
  const { cfg, idea, answers, signal, emit, memoryDigest } = opts;
  const outcome: PipelineOutcome = { docs: [], taskCount: 0, failed: [], scope: "", analysis: "", gaps: [] };
  // Akuntansi retry untuk memori agent: total retry + tahap pertama yang mengalami retry.
  const startedAt = Date.now();
  let retries = 0;
  let retryStage = 0;
  let lastStage = 0;
  const account = (stage: number, attempts: number): void => {
    const extra = Math.max(0, attempts - 1);
    if (extra > 0) {
      retries += extra;
      if (retryStage === 0) retryStage = stage;
    }
  };

  // Tahap 0a (langkah 1): penalaran/pemahaman maksud + penalaran mendalam (streaming chunk)
  emit("stage_start", { stage: 0, name: "Langkah 1: Analisis Kebutuhan Secara Mendalam dan Komprehensif" });
  const s0a = await callWithRetry({
    cfg,
    model: cfg.modelSmall,
    messages: stage0aMessages(idea),
    signal,
    onChunk: (text) => emit("chunk", { stage: 0, text }),
  });
  account(0, s0a.attempts);
  if (!s0a.ok || signal?.aborted) {
    if (s0a.ok === false && !signal?.aborted) emit("error", { stage: 0, kind: s0a.kind, message: s0a.message });
    // stage_end tetap di-emit agar pasangan start/end seimbang di jalur gagal/abort.
    emit("stage_end", { stage: 0 });
    return outcome;
  }
  outcome.analysis = s0a.text;
  emit("stage_end", { stage: 0 });

  // Tahap 0b (langkah 1): analisis dan audit kesenjangan, kelemahan, risiko (JSON internal)
  emit("stage_start", { stage: 0, name: "Langkah 1: Analisis Kebutuhan Secara Mendalam dan Komprehensif" });
  const s0b = await callWithRetry({
    cfg,
    model: cfg.modelSmall,
    messages: stage0bMessages(idea, outcome.analysis),
    signal,
  });
  account(0, s0b.attempts);
  emit("stage_end", { stage: 0 });
  if (signal?.aborted) return outcome;
  if (s0b.ok) {
    const stage0b = parseStage0b(s0b.text);
    if (stage0b.analysis.length > 0) outcome.analysis = stage0b.analysis;
    outcome.gaps = stage0b.gaps;
  } else if (s0b.message !== "aborted") {
    // Gagal parse/LLM -> tanpa gaps; lanjut dengan analisis mentah.
    outcome.gaps = [];
  }

  // Tahap 1 (langkah 1): analisis mendalam kebutuhan - tech, bahasa, database, arsitektur, keamanan
  emit("stage_start", { stage: 1, name: "Langkah 1: Analisis Kebutuhan Secara Mendalam dan Komprehensif" });
  const s1 = await callWithRetry({
    cfg,
    model: cfg.modelSmall,
    messages: stage1Messages(idea, answers, outcome.analysis, outcome.gaps),
    signal,
    onChunk: (text) => emit("chunk", { stage: 1, text }),
  });
  account(1, s1.attempts);
  if (!s1.ok || signal?.aborted) {
    if (s1.ok === false && !signal?.aborted) emit("error", { stage: 1, kind: s1.kind, message: s1.message });
    // stage_end tetap di-emit agar pasangan start/end seimbang di jalur gagal/abort.
    emit("stage_end", { stage: 1 });
    return outcome;
  }
  const scope = s1.text;
  outcome.scope = scope;
  emit("stage_end", { stage: 1 });

  // Tahap 2 (langkah 2): pengambilan AI agent, skill, dan kemampuan relevan
  emit("stage_start", { stage: 2, name: "Langkah 2: Pengambilan Skill dan Kapabilitas Agent yang Relevan" });
  let recommendations: DocName[] = [];
  let recOk = false;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !recOk; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt]);
    const s2 = await callWithRetry({
      cfg,
      model: cfg.modelSmall,
      messages: stage2Messages(idea, scope, attempt > 0 ? retryStage2Note(scope) : undefined, answers, outcome.analysis, outcome.gaps),
      signal,
    });
    account(2, s2.attempts);
    if (!s2.ok) {
      if (signal?.aborted) {
        emit("stage_end", { stage: 2 });
        return outcome;
      }
      if (s2.kind === "fatal") {
        emit("error", { stage: 2, kind: "fatal", message: s2.message });
        emit("stage_end", { stage: 2 });
        return outcome;
      }
      continue;
    }
    const parsed = parseDocRecommendation(s2.text);
    if (parsed.length > 0) {
      recommendations = parsed;
      recOk = true;
    }
  }
  if (!recOk) {
    if (signal?.aborted) {
      emit("stage_end", { stage: 2 });
      return outcome;
    }
    emit("error", { stage: 2, kind: "retryable", message: "Model gagal menghasilkan rekomendasi dokumen yang valid." });
    emit("stage_end", { stage: 2 });
    return outcome;
  }
  emit("stage_end", { stage: 2 });

  // Tahap 3: draf per dokumen (sequential, tanpa nomor langkah); TASK-LIST dibuat di tahap 4.
  const stage3Docs = recommendations.filter((d) => d !== "TASK-LIST");
  for (const doc of stage3Docs) {
    if (signal?.aborted) return outcome;
    lastStage = 3;
    emit("stage_start", { stage: 3, name: "Penulisan Draf Dokumen" });
    const s3 = await callWithRetry({
      cfg,
      model: cfg.modelStrong,
      messages: stage3Messages(idea, scope, doc, answers, outcome.analysis, outcome.gaps, memoryDigest),
      signal,
      onChunk: (text) => emit("chunk", { stage: 3, doc, text }),
    });
    account(3, s3.attempts);
    emit("stage_end", { stage: 3 });
    if (signal?.aborted || (s3.ok === false && s3.message === "aborted")) return outcome;
    if (s3.ok) {
      outcome.docs.push({ name: doc, content: s3.text });
    } else {
      outcome.failed.push({ name: doc, reason: s3.message });
    }
  }

  // Tahap 4: Task breakdown (TASK-LIST)
  if (!signal?.aborted) {
    lastStage = 4;
    emit("stage_start", { stage: 4, name: "Langkah 3: Penyusunan Task List" });
    const s4 = await callWithRetry({
      cfg,
      model: cfg.modelStrong,
      // FIX 4: stage 4 menerima ISI dokumen (name + content), bukan hanya nama.
      messages: stage4Messages(idea, scope, outcome.docs, answers, outcome.analysis, outcome.gaps, memoryDigest),
      signal,
      onChunk: (text) => emit("chunk", { stage: 4, doc: "TASK-LIST", text }),
    });
    account(4, s4.attempts);
    emit("stage_end", { stage: 4 });
    if (signal?.aborted || (s4.ok === false && s4.message === "aborted")) return outcome;
    if (s4.ok) {
      outcome.docs.push({ name: "TASK-LIST", content: s4.text });
      outcome.taskCount = countTasks(s4.text);
    } else {
      outcome.failed.push({ name: "TASK-LIST", reason: s4.message });
    }
  }

  // Tahap 5-8 (langkah 4-7): verifikasi, audit red-team, perbaikan, penulisan final.
  // Best-effort: kegagalan di sini TIDAK menggagalkan pipeline; dokumen stage 3+4 tetap
  // dipertahankan. Guard hanya abort: runVerifyDocs/runHackerAudit/runRepairDocs/
  // runFinalWrite emit stage_start + stage_end seimbang bahkan saat docs/findings kosong,
  // agar chip 5-8 selalu hijau.
  if (!signal?.aborted) {
    lastStage = STAGE_VERIFY;
    const verifyRes = await runVerifyDocs({ cfg, idea, scope, docs: outcome.docs, answers, analysis: outcome.analysis, gaps: outcome.gaps, signal, emit });
    account(STAGE_VERIFY, verifyRes.attempts);

    lastStage = STAGE_HACKER;
    const hackerRes = await runHackerAudit({ cfg, idea, docs: outcome.docs, analysis: outcome.analysis, gaps: outcome.gaps, signal, emit });
    account(STAGE_HACKER, hackerRes.attempts);

    const findings = [...verifyRes.findings, ...hackerRes.findings];
    // Isu struktural markdown (best-effort): dokumen yang gagal cek murah
    // validateDocMarkdown ditambahkan sebagai temuan LOW agar ikut diperbaiki
    // pada stage 7; tidak menggagalkan pipeline bila semua cek lolos.
    if (!signal?.aborted) {
      for (const doc of outcome.docs) {
        const docIssues = validateDocMarkdown(doc.name, doc.content);
        for (const issue of docIssues) {
          findings.push({
            doc: doc.name,
            severity: "LOW",
            masalah: `Validasi markdown: ${issue.code}.`,
            saran: issue.message,
          });
        }
      }
    }
    // Stage 7 selalu dipanggil (bahkan tanpa temuan) agar emit stage_start +
    // stage_end seimbang; runRepairDocs menangani findings kosong.
    if (!signal?.aborted) {
      lastStage = STAGE_REPAIR;
      const repaired = await runRepairDocs({
        cfg,
        idea,
        scope,
        docs: outcome.docs,
        findings,
        answers,
        analysis: outcome.analysis,
        gaps: outcome.gaps,
        signal,
        emit,
        memoryDigest,
      });
      account(STAGE_REPAIR, repaired.attempts);
      outcome.docs = repaired.docs;
      const taskList = repaired.docs.find((d: GeneratedDoc) => d.name === "TASK-LIST");
      if (taskList) outcome.taskCount = countTasks(taskList.content);

      // Stage 8 (langkah 7, OPSI C hemat): tulis ulang final HANYA dokumen yang
      // terdampak repair; selalu dipanggil agar emit seimbang dan chip hijau.
      if (!signal?.aborted) {
        lastStage = STAGE_FINAL_WRITE;
        const final = await runFinalWrite({
          cfg,
          idea,
          scope,
          docs: outcome.docs,
          repaired: repaired.repaired,
          findings,
          answers,
          analysis: outcome.analysis,
          gaps: outcome.gaps,
          signal,
          emit,
          memoryDigest,
        });
        account(STAGE_FINAL_WRITE, final.attempts);
        outcome.docs = final.docs;
        const finalTaskList = final.docs.find((d: GeneratedDoc) => d.name === "TASK-LIST");
        if (finalTaskList) outcome.taskCount = countTasks(finalTaskList.content);
      }
    }
  }

  // Memori agent (additive): pelajaran dari eksekusi ini untuk upgrade di masa depan.
  // docType = MASTER-PRD karena record merepresentasikan kapabilitas satu run penuh.
  outcome.memory = recordOutcome({
    idea,
    docType: "MASTER-PRD",
    signals: {
      retries,
      failedDocs: outcome.failed.length,
      durationMs: Date.now() - startedAt,
      stage: retryStage > 0 ? retryStage : lastStage,
    },
  });

  return outcome;
}

export interface VerifyDocsOptions {
  cfg: LlmConfig;
  idea: string;
  scope: string;
  docs: GeneratedDoc[];
  answers?: string[];
  analysis?: string;
  gaps?: string[];
  signal?: AbortSignal;
  emit: Emit;
}

export interface VerifyDocsResult {
  findings: AuditFinding[];
  attempts: number;
}

/** Stage 5 (langkah 4): baca ulang dokumen yang disertakan + cocokkan kebutuhan. Best-effort. */
export async function runVerifyDocs(opts: VerifyDocsOptions): Promise<VerifyDocsResult> {
  const { cfg, idea, scope, docs, answers, analysis, gaps, signal, emit } = opts;
  if (signal?.aborted) return { findings: [], attempts: 0 };
  if (docs.length === 0) {
    emit("stage_start", { stage: STAGE_VERIFY, name: "Langkah 4: Verifikasi Kesesuaian Dokumen dengan Kebutuhan Pengguna" });
    emit("stage_end", { stage: STAGE_VERIFY });
    return { findings: [], attempts: 0 };
  }
  emit("stage_start", { stage: STAGE_VERIFY, name: "Langkah 4: Verifikasi Kesesuaian Dokumen dengan Kebutuhan Pengguna" });
  const res = await callWithRetry({
    cfg,
    model: cfg.modelStrong,
    messages: verifyDocsMessages(idea, scope, docs, answers, analysis, gaps),
    signal,
  });
  emit("stage_end", { stage: STAGE_VERIFY });
  if (signal?.aborted || !res.ok) return { findings: [], attempts: res.attempts };
  return { findings: parseAuditFindings(res.text).findings, attempts: res.attempts };
}

export interface HackerAuditOptions {
  cfg: LlmConfig;
  idea: string;
  docs: GeneratedDoc[];
  analysis?: string;
  gaps?: string[];
  signal?: AbortSignal;
  emit: Emit;
}

/** Stage 6 (langkah 5): audit red-team ala agent hacker. Best-effort. */
export async function runHackerAudit(opts: HackerAuditOptions): Promise<VerifyDocsResult> {
  const { cfg, idea, docs, analysis, gaps, signal, emit } = opts;
  if (signal?.aborted) return { findings: [], attempts: 0 };
  if (docs.length === 0) {
    emit("stage_start", { stage: STAGE_HACKER, name: "Langkah 5: Audit Red-Team oleh Agent Hacker" });
    emit("stage_end", { stage: STAGE_HACKER });
    return { findings: [], attempts: 0 };
  }
  emit("stage_start", { stage: STAGE_HACKER, name: "Langkah 5: Audit Red-Team oleh Agent Hacker" });
  const res = await callWithRetry({
    cfg,
    model: cfg.modelStrong,
    messages: hackerAuditMessages(idea, docs, analysis, gaps),
    signal,
  });
  emit("stage_end", { stage: STAGE_HACKER });
  if (signal?.aborted || !res.ok) return { findings: [], attempts: res.attempts };
  return { findings: parseAuditFindings(res.text).findings, attempts: res.attempts };
}

export interface RepairDocsOptions {
  cfg: LlmConfig;
  idea: string;
  scope: string;
  docs: GeneratedDoc[];
  findings: AuditFinding[];
  answers?: string[];
  analysis?: string;
  gaps?: string[];
  signal?: AbortSignal;
  emit: Emit;
  memoryDigest?: string;
}

export interface RepairDocsResult {
  docs: GeneratedDoc[];
  /** Dokumen yang benar-benar ditulis ulang pada stage 7 (bahan stage 8 OPSI C). */
  repaired: DocName[];
  attempts: number;
}

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Stage 7 (langkah 6): tulis ulang dokumen yang paling bermasalah (maks MAX_REPAIR_DOCS). */
export async function runRepairDocs(opts: RepairDocsOptions): Promise<RepairDocsResult> {
  const { cfg, idea, scope, docs, findings, answers, analysis, gaps, signal, emit, memoryDigest } = opts;
  const updated: GeneratedDoc[] = docs.map((d) => ({ ...d }));
  const repairStageStart = (): void => emit("stage_start", { stage: STAGE_REPAIR, name: "Langkah 6: Perbaikan Kesenjangan dan Kelemahan" });
  const repairStageEnd = (): void => emit("stage_end", { stage: STAGE_REPAIR });
  if (signal?.aborted) return { docs: updated, repaired: [], attempts: 0 };
  // Tanpa temuan: stage 7 tetap di-emit seimbang agar chip hijau saat pipeline tuntas.
  if (findings.length === 0) {
    repairStageStart();
    repairStageEnd();
    return { docs: updated, repaired: [], attempts: 0 };
  }

  // Kelompokkan temuan per dokumen sasaran (cocokkan nama kanonik bila bisa).
  const byDoc = new Map<DocName, AuditFinding[]>();
  for (const f of findings) {
    const canonical = normalizeDocName(f.doc);
    const key: DocName | null = canonical ?? (updated.some((d) => d.name === f.doc) ? (f.doc as DocName) : null);
    if (!key) continue;
    const list = byDoc.get(key) ?? [];
    list.push(f);
    byDoc.set(key, list);
  }
  // Prioritas: severity terburuk dulu, lalu jumlah temuan terbanyak.
  const targets = [...byDoc.entries()]
    .sort((a, b) => {
      const rankA = Math.min(...a[1].map((f) => SEVERITY_RANK[(f.severity ?? "MEDIUM").toUpperCase()] ?? 2));
      const rankB = Math.min(...b[1].map((f) => SEVERITY_RANK[(f.severity ?? "MEDIUM").toUpperCase()] ?? 2));
      return rankA - rankB || b[1].length - a[1].length;
    })
    .slice(0, MAX_REPAIR_DOCS)
    .map(([doc]) => doc);
  if (targets.length === 0 || signal?.aborted) {
    repairStageStart();
    repairStageEnd();
    return { docs: updated, repaired: [], attempts: 0 };
  }

  let attempts = 0;
  const repaired: DocName[] = [];
  for (const doc of targets) {
    if (signal?.aborted) break;
    const notes = (byDoc.get(doc) ?? []).map(
      (f: AuditFinding) => `[${(f.severity ?? "MEDIUM").toUpperCase()}] ${f.doc}: ${f.masalah}${f.saran ? ` -> ${f.saran}` : ""}`,
    );
    emit("stage_start", { stage: STAGE_REPAIR, name: `Langkah 6: Perbaikan ${doc}` });
    // FIX TASK-LIST: jangan pakai repairDocMessages/stage3Messages untuk TASK-LIST.
    // DOC_GUIDES["TASK-LIST"].sections berisi teks "Tidak dipakai pada tahap
    // penulisan dokumen..." yang akan terkirim sebagai section LITERAL (sampah),
    // sehingga model diperintah menulis TASK-LIST dengan struktur salah. TASK-LIST
    // memakai stage4Messages (prompt task breakdown) dengan ISI dokumen terkini,
    // sama seperti runFinalWrite; temuan ditempel lewat withRepairNotes.
    const baseMessages: ChatMessage[] =
      doc === "TASK-LIST"
        ? stage4Messages(idea, scope, updated.filter((d) => d.name !== "TASK-LIST"), answers, analysis, gaps, memoryDigest)
        : repairDocMessages(idea, scope, doc, notes, answers, analysis, gaps, memoryDigest);
    const res = await callWithRetry({
      cfg,
      model: cfg.modelStrong,
      messages: withRepairNotes(baseMessages, doc === "TASK-LIST" ? notes : []),
      signal,
      onChunk: (text) => emit("chunk", { stage: STAGE_REPAIR, doc, text }),
    });
    attempts += res.attempts;
    emit("stage_end", { stage: STAGE_REPAIR });
    if (res.ok) {
      const idx = updated.findIndex((d) => d.name === doc);
      if (idx >= 0) updated[idx] = { name: doc, content: res.text };
      else updated.push({ name: doc, content: res.text });
      repaired.push(doc);
    }
  }
  return { docs: updated, repaired, attempts };
}

export interface FinalWriteOptions {
  cfg: LlmConfig;
  idea: string;
  scope: string;
  docs: GeneratedDoc[];
  /** Dokumen yang ditulis ulang pada stage 7 (sumber target OPSI C). */
  repaired: DocName[];
  findings: AuditFinding[];
  answers?: string[];
  analysis?: string;
  gaps?: string[];
  signal?: AbortSignal;
  emit: Emit;
  memoryDigest?: string;
}

export interface FinalWriteResult {
  docs: GeneratedDoc[];
  attempts: number;
}

/** Stage 8 (langkah 7, OPSI C hemat): tulis ulang final HANYA dokumen yang
 * terdampak repair. Dokumen tanpa temuan TIDAK ditulis ulang (hemat biaya/
 * latensi). Best-effort: kegagalan tidak menghapus dokumen. */
export async function runFinalWrite(opts: FinalWriteOptions): Promise<FinalWriteResult> {
  const { cfg, idea, scope, docs, repaired, findings, answers, analysis, gaps, signal, emit, memoryDigest } = opts;
  const updated: GeneratedDoc[] = docs.map((d) => ({ ...d }));
  const finalStageStart = (name: string): void => emit("stage_start", { stage: STAGE_FINAL_WRITE, name });
  const finalStageEnd = (): void => emit("stage_end", { stage: STAGE_FINAL_WRITE });
  if (signal?.aborted) return { docs: updated, attempts: 0 };
  // Tanpa dokumen / tanpa repair: stage 8 tetap di-emit seimbang agar chip hijau.
  const base = repaired.filter((d) => updated.some((u) => u.name === d));
  // FIX staleness TASK-LIST: TASK-LIST dibuat di stage 4 dari ISI DRAF dokumen
  // (stage4Messages memakai content dokumen lain sebagai rujukan wajib). Bila repair
  // stage 7 lalu final-write stage 8 mengubah dokumen LAIN (mis. DATABASE/API-TECH),
  // rujukan detail di TASK-LIST bisa jadi basi. Karena itu, bila minimal satu dokumen
  // selain TASK-LIST ditulis ulang, TASK-LIST WAJIB ikut ditulis ulang final agar
  // rujukan antar-dokumen tetap konsisten (biaya tambahan maksimal 1 panggilan model).
  const targets: DocName[] =
    base.some((d) => d !== "TASK-LIST") && !base.includes("TASK-LIST") && updated.some((u) => u.name === "TASK-LIST")
      ? [...base, "TASK-LIST"]
      : base;
  if (targets.length === 0) {
    finalStageStart("Langkah 7: Penulisan Dokumen");
    finalStageEnd();
    return { docs: updated, attempts: 0 };
  }

  let attempts = 0;
  for (const doc of targets) {
    if (signal?.aborted) break;
    const notes = findings
      .filter((f) => normalizeDocName(f.doc) === doc)
      .map(
        (f: AuditFinding) => `[${(f.severity ?? "MEDIUM").toUpperCase()}] ${f.doc}: ${f.masalah}${f.saran ? ` -> ${f.saran}` : ""} (sudah diperbaiki pada tahap 6; pastikan tercakup lengkap dan konsisten)`,
      );
    emit("stage_start", { stage: STAGE_FINAL_WRITE, name: `Langkah 7: Penulisan Dokumen ${doc}` });
    // TASK-LIST memakai prompt task breakdown (stage 4) dengan ISI dokumen terkini
    // (tanpa TASK-LIST sendiri), bukan repairDocMessages - DOC_GUIDES TASK-LIST
    // sengaja kosong karena TASK-LIST tak pernah ditulis lewat template dokumen umum.
    const baseMessages: ChatMessage[] =
      doc === "TASK-LIST"
        ? stage4Messages(idea, scope, updated.filter((d) => d.name !== "TASK-LIST"), answers, analysis, gaps, memoryDigest)
        : repairDocMessages(idea, scope, doc, notes, answers, analysis, gaps, memoryDigest);
    const messages: ChatMessage[] = doc === "TASK-LIST" ? withRepairNotes(baseMessages, notes) : baseMessages;
    const res = await callWithRetry({
      cfg,
      model: cfg.modelStrong,
      messages,
      signal,
      onChunk: (text) => emit("chunk", { stage: STAGE_FINAL_WRITE, doc, text }),
    });
    attempts += res.attempts;
    emit("stage_end", { stage: STAGE_FINAL_WRITE });
    if (res.ok) {
      const idx = updated.findIndex((d) => d.name === doc);
      if (idx >= 0) updated[idx] = { name: doc, content: res.text };
      else updated.push({ name: doc, content: res.text });
    }
  }
  return { docs: updated, attempts };
}

export interface RegenerateOptions {
  cfg: LlmConfig;
  idea: string;
  scope: string;
  doc: DocName;
  /** FIX 4: isi dokumen terkait (name + content) untuk stage 4 (TASK-LIST). */
  docs?: GeneratedDoc[];
  answers?: string[];
  analysis?: string;
  gaps?: string[];
  signal?: AbortSignal;
  emit: Emit;
  /** Digest memori agent (additive, opsional): pelajaran dari eksekusi sebelumnya. */
  memoryDigest?: string;
}

/** Regenerate satu dokumen (stateless): body membawa konteks tahap 1 & 2 dari client. */
export async function runRegenerateDoc(opts: RegenerateOptions): Promise<GeneratedDoc | FailedDoc> {
  const { cfg, idea, scope, doc, docs, answers, analysis, gaps, signal, emit, memoryDigest } = opts;
  emit("stage_start", { stage: doc === "TASK-LIST" ? 4 : 3, name: doc === "TASK-LIST" ? "Langkah 3: Penyusunan Task List" : "Penulisan Draf Dokumen" });
  const messages: ChatMessage[] =
    doc === "TASK-LIST"
      ? stage4Messages(
          idea,
          scope,
          docs && docs.length > 0
            ? docs
            : [{ name: "MASTER-PRD", content: "Dokumen belum tersedia; gunakan analisis scope." }],
          answers,
          analysis,
          gaps,
          memoryDigest,
        )
      : stage3Messages(idea, scope, doc, answers, analysis, gaps, memoryDigest);
  const res = await callWithRetry({
    cfg,
    model: cfg.modelStrong,
    messages,
    signal,
    onChunk: (text) => emit("chunk", { stage: doc === "TASK-LIST" ? 4 : 3, doc, text }),
  });
  emit("stage_end", { stage: doc === "TASK-LIST" ? 4 : 3 });
  if (res.ok) return { name: doc, content: res.text };
  return { name: doc, reason: res.message };
}

export interface ClarifyOptions {
  cfg: LlmConfig;
  idea: string;
  signal?: AbortSignal;
}

export interface ClarifyResult {
  questions: ClarifyQuestion[];
  /** Ringkasan analisis dari stage 0b (kosong bila fallback). */
  analysis: string;
  /** Gap dari stage 0b (kosong bila fallback). */
  gaps: string[];
  error?: string;
}

/** Tahap 0 (pre-flight): stage 0a -> 0b -> pertanyaan klarifikasi. Gagal -> fallback generic. */
export async function runClarify(opts: ClarifyOptions): Promise<ClarifyResult> {
  const fallback = async (): Promise<ClarifyResult> => {
    try {
      const res = await callWithRetry({
        cfg: opts.cfg,
        model: opts.cfg.modelSmall,
        messages: clarifyMessages(opts.idea),
        signal: opts.signal,
      });
      if (!res.ok) return { questions: [], analysis: "", gaps: [], error: res.message };
      return { questions: parseClarify(res.text), analysis: "", gaps: [] };
    } catch (e) {
      return {
        questions: [],
        analysis: "",
        gaps: [],
        error: e instanceof Error ? e.message : "Gagal menghasilkan pertanyaan klarifikasi.",
      };
    }
  };

  try {
    const s0a = await callWithRetry({
      cfg: opts.cfg,
      model: opts.cfg.modelSmall,
      messages: stage0aMessages(opts.idea),
      signal: opts.signal,
    });
    if (!s0a.ok) return { questions: [], analysis: "", gaps: [], error: s0a.message };
    const analysis = s0a.text;

    const s0b = await callWithRetry({
      cfg: opts.cfg,
      model: opts.cfg.modelSmall,
      messages: stage0bMessages(opts.idea, analysis),
      signal: opts.signal,
    });
    if (!s0b.ok) return fallback();
    const parsed = parseStage0b(s0b.text);
    if (parsed.questions.length === 0) return fallback();
    return {
      questions: parsed.questions,
      analysis: parsed.analysis.length > 0 ? parsed.analysis : analysis.slice(0, 500),
      gaps: parsed.gaps,
    };
  } catch (e) {
    return {
      questions: [],
      analysis: "",
      gaps: [],
      error: e instanceof Error ? e.message : "Gagal menghasilkan pertanyaan klarifikasi.",
    };
  }
}