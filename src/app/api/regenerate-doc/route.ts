// POST /api/regenerate-doc - regenerate SATU dokumen (stateless, SSE).
// Body membawa konteks tahap 1 (scope) + minimal tahap 2 (docs) dari client.

import { sseResponse } from "@/lib/prd/sse";
import { runRegenerateDoc, normalizeDocName } from "@/lib/prd/pipeline";
import { createRateLimiter } from "@/lib/prd/rate-limit";
import { clientIp } from "@/lib/prd/client-ip";
import { countTasks, MAX_CLARIFY_QUESTIONS } from "@/lib/prd/parse";
import { deriveDomain, digestFor, learnFromOutcome, recordOutcome } from "@/lib/prd/memory";
import type { GeneratedDoc, MemorySummary } from "@/lib/prd/types";

export const runtime = "nodejs";

const MAX_IDEA_LENGTH = 2000;
const MAX_SCOPE_LENGTH = 12_000;
const MAX_DOC_CONTENT_LENGTH = 8000;
const MAX_DOC_ITEMS = 20;
const MAX_ANSWER_LENGTH = 500;
const MAX_GAP_LENGTH = 300;
// BETA: rate limit in-memory per IP (10/menit).
const regenerateLimiter = createRateLimiter({ capacity: 10, refillPerSec: 10 / 60 });

interface RegenerateBody {
  idea?: unknown;
  scope?: unknown;
  doc?: unknown;
  docs?: unknown;
  answers?: unknown;
  analysis?: unknown;
  gaps?: unknown;
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  let body: RegenerateBody;
  try {
    body = (await request.json()) as RegenerateBody;
  } catch {
    return badRequest("Body JSON tidak valid.");
  }

  const { idea, scope, doc, docs } = body;
  if (typeof idea !== "string" || idea.trim().length === 0 || idea.length > MAX_IDEA_LENGTH) {
    return badRequest(`Ide wajib diisi (1-${MAX_IDEA_LENGTH} karakter).`);
  }
  if (typeof scope !== "string" || scope.trim().length === 0 || scope.length > MAX_SCOPE_LENGTH) {
    return badRequest("Konteks scope wajib dikirim (hasil tahap 1).");
  }
  const reqAnalysis = typeof body.analysis === "string" ? body.analysis.slice(0, 6000) : undefined;
  const reqGaps = Array.isArray(body.gaps)
    ? body.gaps
        .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
        .slice(0, 10)
        .map((g) => g.slice(0, MAX_GAP_LENGTH))
    : undefined;
  const canonicalDoc = typeof doc === "string" ? normalizeDocName(doc) : null;
  if (!canonicalDoc) {
    return badRequest("Nama dokumen tidak valid.");
  }

  let relatedDocs: GeneratedDoc[] | undefined;
  if (Array.isArray(docs)) {
    const valid: GeneratedDoc[] = [];
    for (const d of docs) {
      if (valid.length >= MAX_DOC_ITEMS) break;
      if (typeof d !== "object" || d === null) continue;
      const { name, content } = d as { name?: unknown; content?: unknown };
      const canonical = typeof name === "string" ? normalizeDocName(name) : null;
      if (canonical && typeof content === "string") {
        valid.push({ name: canonical, content: content.slice(0, MAX_DOC_CONTENT_LENGTH) });
      }
    }
    if (valid.length > 0) relatedDocs = valid;
  }

  const answers = Array.isArray(body.answers)
    ? body.answers
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .slice(0, MAX_CLARIFY_QUESTIONS)
        .map((a) => a.slice(0, MAX_ANSWER_LENGTH))
    : undefined;

  const limit = regenerateLimiter.check(clientIp(request));
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
    // Memori agent TIDAK boleh mengganggu regenerasi: setiap IO dibungkus try/catch.
    let memoryDigest = "";
    try {
      memoryDigest = await digestFor(canonicalDoc, deriveDomain(idea));
    } catch {
      memoryDigest = "";
    }

    const startedAt = Date.now();
    const result = await runRegenerateDoc({
      cfg,
      idea,
      scope,
      doc: canonicalDoc,
      docs: relatedDocs,
      answers,
      analysis: reqAnalysis,
      gaps: reqGaps,
      signal,
      emit,
      memoryDigest,
    });

    const ok = "content" in result;
    let memory: MemorySummary | undefined;
    if (!signal.aborted) {
      try {
        const record = recordOutcome({
          idea,
          docType: canonicalDoc,
          signals: {
            retries: 0,
            failedDocs: ok ? 0 : 1,
            durationMs: Date.now() - startedAt,
            stage: canonicalDoc === "TASK-LIST" ? 4 : 3,
          },
        });
        memory = (await learnFromOutcome(record)).summary;
      } catch {
        memory = undefined;
      }
    }

    if (!signal.aborted) {
      if (ok) {
        emit("done", {
          docs: [{ name: result.name, content: result.content }],
          taskCount: result.name === "TASK-LIST" ? countTasks(result.content) : 0,
          failed: [],
          scope,
          memory,
        });
      } else {
        emit("done", {
          docs: [],
          taskCount: 0,
          failed: [{ name: result.name, reason: result.reason }],
          scope,
          memory,
        });
      }
    }
  });
}