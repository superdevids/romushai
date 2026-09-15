// POST /api/generate - pipeline PRD 9 tahap (stage 0-8), streaming SSE.
// Validasi 400 bila idea kosong/terlalu panjang; 429 + Retry-After kena rate limit.

import { sseResponse } from "@/lib/prd/sse";
import { runGeneratePipeline } from "@/lib/prd/pipeline";
import { MAX_CLARIFY_QUESTIONS } from "@/lib/prd/parse";
import { createRateLimiter } from "@/lib/prd/rate-limit";
import { clientIp } from "@/lib/prd/client-ip";
import { deriveDomain, digestFor, learnFromOutcome } from "@/lib/prd/memory";
import type { MemorySummary } from "@/lib/prd/types";

export const runtime = "nodejs";

const MAX_IDEA_LENGTH = 2000;
const MAX_ANSWER_LENGTH = 500;
const MAX_BODY_BYTES = 64 * 1024;
// BETA: rate limit in-memory per IP (token bucket; burst 5, isi 3/menit).
const generateLimiter = createRateLimiter({ capacity: 5, refillPerSec: 3 / 60 });

interface GenerateBody {
  idea?: unknown;
  answers?: unknown;
}

function bodyTooLarge(request: Request, raw: unknown): boolean {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) return true;
  }
  try {
    return JSON.stringify(raw).length > MAX_BODY_BYTES;
  } catch {
    return true;
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  if (bodyTooLarge(request, body)) {
    return Response.json({ error: "Body terlalu besar (maksimal 64 KB)." }, { status: 400 });
  }

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
    // Memori agent TIDAK boleh mengganggu generasi: setiap IO dibungkus try/catch.
    let memoryDigest = "";
    try {
      memoryDigest = await digestFor(undefined, deriveDomain(idea));
    } catch {
      memoryDigest = "";
    }

    const outcome = await runGeneratePipeline({ cfg, idea, answers, signal, emit, memoryDigest });

    let memory: MemorySummary | undefined;
    if (outcome.memory) {
      try {
        memory = (await learnFromOutcome(outcome.memory)).summary;
      } catch {
        memory = undefined;
      }
    }

    if (!signal.aborted) {
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
  });
}