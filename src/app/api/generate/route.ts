// POST /api/generate - pipeline PRD 9 tahap (stage 0-8), streaming SSE.
// Body tidak valid -> JSON 400/413/415; rate limit -> JSON 429 + Retry-After (bukan SSE).

import { sseResponse } from "@/lib/prd/sse";
import { runGeneratePipeline } from "@/lib/prd/pipeline";
import { MAX_CLARIFY_QUESTIONS } from "@/lib/prd/parse";
import { createRateLimiter } from "@/lib/prd/rate-limit";
import { clientIp } from "@/lib/prd/client-ip";
import { readJsonLimited } from "@/lib/prd/http-body";
import { deriveDomain, digestFor, learnFromOutcome } from "@/lib/prd/memory";
import type { MemorySummary } from "@/lib/prd/types";

export const runtime = "nodejs";
// Batas eksekusi platform dalam detik. Plan Hobby Vercel maksimum 300;
// turunkan nilai ini (dan GENERATE_BUDGET_MS) bila plan/kuota lebih rendah.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_IDEA_LENGTH = 2000;
const MAX_ANSWER_LENGTH = 500;
const MAX_BODY_BYTES = 64 * 1024;
// Plafon waktu TOTAL pipeline (milidetik). Harus lebih kecil dari maxDuration
// (300 detik) supaya SSE masih sempat mengirim event error/done sebelum
// function dimatikan platform - penyebab stream terputus di tengah jalan.
const GENERATE_BUDGET_MS = parseBudgetEnv(process.env.GENERATE_BUDGET_MS);

function parseBudgetEnv(value: string | undefined): number {
  const parsed = value === undefined ? NaN : Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return 280_000;
}

// BETA: rate limit in-memory per IP (token bucket; burst 5, isi 3/menit).
const generateLimiter = createRateLimiter({ capacity: 5, refillPerSec: 3 / 60 });

interface GenerateBody {
  idea?: unknown;
  answers?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await readJsonLimited(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    return Response.json({ error: parsed.message }, { status: parsed.status });
  }
  const body = parsed.value as GenerateBody;

  const idea = body.idea;
  if (typeof idea !== "string" || idea.trim().length === 0) {
    return Response.json({ error: "Ide tidak boleh kosong." }, { status: 400 });
  }
  if (idea.length > MAX_IDEA_LENGTH) {
    return Response.json(
      { error: `Ide terlalu panjang (maksimal ${MAX_IDEA_LENGTH} karakter).` },
      { status: 400 },
    );
  }
  const answers = Array.isArray(body.answers)
    ? body.answers
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .slice(0, MAX_CLARIFY_QUESTIONS)
        .map((a) => a.slice(0, MAX_ANSWER_LENGTH))
    : undefined;

  const limit = generateLimiter.check(clientIp(request));
  if (!limit.ok) {
    return Response.json(
      { error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfterSeconds} detik.` },
      {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  return sseResponse(request, async ({ cfg, signal, emit }) => {
    // Budget waktu: batalkan pipeline SEBELUM maxDuration platform, supaya client
    // menerima event error/done (bukan koneksi putus mendadak di tengah stream).
    const budget = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      budget.abort();
    }, GENERATE_BUDGET_MS);
    const onClientAbort = (): void => budget.abort();
    if (signal.aborted) budget.abort();
    else signal.addEventListener("abort", onClientAbort);

    try {
      // Memori agent TIDAK boleh mengganggu generasi: setiap IO dibungkus try/catch.
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
        signal: budget.signal,
        emit,
        memoryDigest,
      });

      if (timedOut && !signal.aborted) {
        emit("error", {
          stage: 0,
          kind: "fatal",
          message: `Batas waktu generasi tercapai (${GENERATE_BUDGET_MS} ms). Dokumen yang sudah selesai tetap dikirim.`,
        });
      }

      let memory: MemorySummary | undefined;
      if (outcome.memory) {
        try {
          memory = (await learnFromOutcome(outcome.memory)).summary;
        } catch {
          memory = undefined;
        }
      }

      // Jangan emit "done" bila TIDAK ada hasil sama sekali (docs & failed kosong):
      // error fatal yang sudah di-emit pipeline (mis. stage 0/1 gagal, budget habis
      // sebelum ada dokumen) harus menjadi event terminal; done kosong justru
      // menghapus pesan error di client (handler done memanggil setErrorMsg(null)).
      if (!signal.aborted && (outcome.docs.length > 0 || outcome.failed.length > 0)) {
        emit("done", {
          docs: outcome.docs,
          taskCount: outcome.taskCount,
          failed: outcome.failed,
          scope: outcome.scope,
          analysis: outcome.analysis,
          gaps: outcome.gaps,
          memory,
        });
      }
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onClientAbort);
    }
  });
}