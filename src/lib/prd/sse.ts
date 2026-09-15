// Utilitas respons SSE untuk route handler. Server-only.

import { envConfig } from "./pipeline.ts";
import type { Emit, LlmConfig } from "./types.ts";

export interface SseRunContext {
  cfg: LlmConfig;
  signal: AbortSignal;
  emit: Emit;
}

/** Jeda heartbeat: komentar SSE ": ping" menjaga koneksi tetap hidup di balik proxy (Vercel). */
const HEARTBEAT_MS = 15_000;

/** Bungkus runner pipeline dalam ReadableStream SSE (text/event-stream). */
export function sseResponse(request: Request, run: (ctx: SseRunContext) => Promise<void>): Response {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stopHeartbeat = (): void => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = undefined;
    }
  };
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      // "ended" sticky: true setelah event "done" atau error "fatal" terkirim.
      // Error retryable di tengah stream (pipeline tetap lanjut) TIDAK mengeset ini,
      // sehingga kegagalan tak terduga setelahnya tetap bisa dijelaskan ke client.
      let ended = false;
      const rawWrite = (text: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // client sudah putus; hentikan penulisan berikutnya
          closed = true;
          stopHeartbeat();
        }
      };
      const write = (event: string, data: unknown): void => {
        rawWrite(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      const emit: Emit = ((event: string, data: unknown) => {
        if (event === "done" || (event === "error" && (data as { kind?: unknown } | null)?.kind === "fatal")) {
          ended = true;
        }
        write(event, data);
      }) as Emit;
      // Heartbeat selalu di-flush walau tidak ada event (anti-buffer proxy).
      heartbeat = setInterval(() => rawWrite(": ping\n\n"), HEARTBEAT_MS);
      const finish = (): void => {
        stopHeartbeat();
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // abaikan bila sudah tertutup
        }
      };
      try {
        let cfg: LlmConfig;
        try {
          cfg = envConfig();
        } catch (e) {
          emit("error", {
            stage: 1,
            kind: "fatal",
            message: e instanceof Error ? e.message : "Konfigurasi server salah.",
          });
          return;
        }
        try {
          await run({ cfg, signal: request.signal, emit });
        } catch (e) {
          console.error("[sse] run gagal:", e);
          if (!ended) {
            write("error", {
              stage: 0,
              kind: "fatal",
              message: "Terjadi kesalahan internal pada server.",
            });
          }
        }
        // Runner selesai tanpa event penutup (mis. bug): jelaskan ke client
        // agar tidak melihat stream putus tanpa penjelasan.
        if (!ended && !request.signal.aborted) {
          write("error", {
            stage: 0,
            kind: "fatal",
            message: "Stream berakhir tanpa hasil final.",
          });
        }
      } finally {
        finish();
      }
    },
    cancel() {
      // stream dibatalkan client; hentikan heartbeat agar tidak menulis ke stream mati
      stopHeartbeat();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
