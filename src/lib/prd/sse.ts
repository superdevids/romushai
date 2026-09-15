// Utilitas respons SSE untuk route handler. Server-only.

import { envConfig } from "./pipeline.ts";
import type { Emit, LlmConfig } from "./types.ts";

export interface SseRunContext {
  cfg: LlmConfig;
  signal: AbortSignal;
  emit: Emit;
}

/** Bungkus runner pipeline dalam ReadableStream SSE (text/event-stream). */
export function sseResponse(request: Request, run: (ctx: SseRunContext) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: string, data: unknown): void => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client sudah putus; abaikan
        }
      };
      const emit: Emit = ((event: string, data: unknown) => write(event, data)) as Emit;
      let cfg: LlmConfig;
      try {
        cfg = envConfig();
      } catch (e) {
        write("error", {
          stage: 1,
          kind: "fatal",
          message: e instanceof Error ? e.message : "Konfigurasi server salah.",
        });
        try {
          controller.close();
        } catch {
          // abaikan
        }
        return;
      }
      try {
        await run({ cfg, signal: request.signal, emit });
      } catch (e) {
        console.error("[sse] run gagal:", e);
        write("error", {
          stage: 0,
          kind: "fatal",
          message: "Terjadi kesalahan internal pada server.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // abaikan bila sudah tertutup
        }
      }
    },
    cancel() {
      // stream dibatalkan client
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}