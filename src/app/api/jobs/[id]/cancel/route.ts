// DELETE /api/jobs/[id] - batalkan job yang sedang berjalan (tombol batal / chat baru).

import { abortJob, getJob } from "@/lib/prd/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!getJob(id)) {
    return Response.json({ error: "Job tidak ditemukan atau sudah kedaluwarsa." }, { status: 404 });
  }
  abortJob(id);
  return Response.json({ ok: true });
}
