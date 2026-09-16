// POST /api/jobs/regenerate - buat job regenerate satu dokumen di background.

import { after } from "next/server";
import { startRegenerateJob } from "@/lib/prd/job-runner";
import { createRateLimiter } from "@/lib/prd/rate-limit";
import { clientIp } from "@/lib/prd/client-ip";
import { readJsonLimited } from "@/lib/prd/http-body";
import { MAX_CLARIFY_QUESTIONS } from "@/lib/prd/parse";
import { normalizeDocName } from "@/lib/prd/pipeline";
import type { GeneratedDoc } from "@/lib/prd/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_IDEA_LENGTH = 2000;
const MAX_SCOPE_LENGTH = 12_000;
const MAX_DOC_CONTENT_LENGTH = 8000;
const MAX_DOC_ITEMS = 20;
const MAX_ANSWER_LENGTH = 500;
const MAX_GAP_LENGTH = 300;
const MAX_BODY_BYTES = 512 * 1024;
// BETA: rate limit identik /api/regenerate-doc (10/menit).
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
  const parsed = await readJsonLimited(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    return Response.json({ error: parsed.message }, { status: parsed.status });
  }
  const body = parsed.value as RegenerateBody;

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

  const { job, promise } = startRegenerateJob({
    idea,
    scope,
    doc: canonicalDoc,
    docs: relatedDocs,
    answers,
    analysis: reqAnalysis,
    gaps: reqGaps,
  });
  after(() => promise);

  return Response.json({ jobId: job.id }, { headers: { "Cache-Control": "no-store" } });
}
