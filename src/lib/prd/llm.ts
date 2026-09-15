// Klien streaming penyedia LLM OpenAI-compatible (plain fetch, tanpa SDK).
// Komentar: Ollama butuh mode kompatibilitas berbeda (format response & oauth
// berbeda), tidak diimplementasikan di sini.

import type { LlmConfig } from "./types.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class LlmError extends Error {
  readonly kind: "retryable" | "fatal";
  constructor(message: string, kind: "retryable" | "fatal") {
    super(message);
    this.kind = kind;
  }
}

interface ChatCompletionChunk {
  choices?: { delta?: { content?: string | null } }[];
}

/** Parse satu baris SSE dari respons chat.completion.chunk; null bila bukan konten. */
export function parseChunkLine(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    const chunk = JSON.parse(payload) as unknown as ChatCompletionChunk;
    const content = chunk.choices?.[0]?.delta?.content;
    return content ?? null;
  } catch {
    return null;
  }
}

/** Baca cuplikan body error (maks 300 karakter) untuk log server saja; "" bila tak terbaca. */
async function readErrorExcerpt(res: Response): Promise<string> {
  try {
    const text = (await res.text()).replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > 300 ? `${text.slice(0, 300)}...` : text;
  } catch {
    return "";
  }
}

function parseTotalTimeoutEnv(value: string | undefined): number {
  const parsed = value === undefined ? NaN : Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return 900_000;
}

export interface StreamChatOptions {
  cfg: LlmConfig;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  timeoutMs?: number;
  onChunk: (text: string) => void;
}

export async function streamChatCompletion(opts: StreamChatOptions): Promise<string> {
  const { cfg, model, messages, signal, onChunk } = opts;
  const timeoutMs = opts.timeoutMs ?? 300_000;

  const ctrl = new AbortController();
  const onUserAbort = (): void => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", onUserAbort);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const resetTimer = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
  };

  // Deadline ABSOLUT (terpisah dari inactivity): membatasi total durasi stream.
  const totalTimeoutMs = parseTotalTimeoutEnv(process.env.LLM_TOTAL_TIMEOUT_MS);
  let totalExpired = false;
  const totalTimer = setTimeout(() => {
    totalExpired = true;
    ctrl.abort();
  }, totalTimeoutMs);

  let full = "";
  try {
    resetTimer();
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true, temperature: 0.7 }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      // Detail body penyedia HANYA ke log server; pesan ke client tetap stabil
      // (mencegah bocor isi error provider via SSE).
      const detail = await readErrorExcerpt(res);
      console.error(
        `[llm] HTTP ${res.status} dari ${cfg.baseUrl}/chat/completions: ${detail || "(body tidak terbaca)"}`,
      );
      if (res.status === 401) {
        throw new LlmError(
          "Kredensial ditolak (401). Periksa LLM_API_KEY dan restart dev server setelah mengubah .env.",
          "fatal",
        );
      }
      if (res.status === 403) {
        throw new LlmError("Akses ditolak (403). Key dikenali tapi tidak punya izin untuk model/endpoint ini.", "fatal");
      }
      if (res.status === 404) {
        throw new LlmError(
          "Endpoint tidak ditemukan (404). Periksa LLM_BASE_URL (harus berakhir pada /v1 untuk [OI]-compatible).",
          "fatal",
        );
      }
      if (res.status === 429) {
        throw new LlmError("Penyedia model memberlakukan rate limit (429).", "fatal");
      }
      if (res.status === 400) {
        throw new LlmError(
          "Permintaan ditolak (400). Beberapa gateway menolak stream untuk model tertentu; coba model lain atau cek nama model di LLM_MODEL_SMALL/LLM_MODEL_STRONG.",
          "fatal",
        );
      }
      throw new LlmError(`Penyedia model mengembalikan HTTP ${res.status}.`, "retryable");
    }
    if (!res.body) throw new LlmError("Respons penyedia model tanpa body.", "retryable");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      resetTimer();
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const text = parseChunkLine(line);
        if (text) {
          full += text;
          onChunk(text);
        }
      }
    }
    return full;
  } catch (e) {
    if (signal?.aborted) throw new LlmError("Client membatalkan permintaan.", "fatal");
    if (totalExpired) {
      throw new LlmError("Waktu pemrosesan total penyedia model habis.", "retryable");
    }
    if (ctrl.signal.aborted && !signal?.aborted) {
      throw new LlmError("Waktu tunggu penyedia model habis.", "retryable");
    }
    if (e instanceof LlmError) throw e;
    throw new LlmError("Gagal terhubung ke penyedia model.", "retryable");
  } finally {
    if (timer) clearTimeout(timer);
    clearTimeout(totalTimer);
    signal?.removeEventListener("abort", onUserAbort);
  }
}