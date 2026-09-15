// Pembaca SSE sisi client (tanpa node:*). Dipakai halaman PRD untuk stream /api/generate & /api/regenerate-doc.

import { parseSseBlock } from "./parse.ts";
import type { DocName, FailedDoc, GeneratedDoc, MemorySummary, SseCompletion } from "./types.ts";

export interface SseEventMap {
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

/** Ringkasan hasil readSse: pemanggil bisa bedakan selesai normal vs terputus vs error. */
export interface SseReadResult {
	/** True HANYA bila event "done" benar-benar diterima. */
	completed: boolean;
	/** "done" = selesai normal; "truncated" = stream putus tanpa done; "error" = gagal baca/error fatal. */
	completion: SseCompletion;
	/** Jumlah blok yang tidak bisa diparse (komentar heartbeat tidak dihitung). */
	corruptBlocks: number;
}

/** Blok komentar murni (mis. heartbeat ": ping") atau blok kosong -> bukan data. */
function isHeartbeatBlock(block: string): boolean {
	const trimmed = block.trim();
	if (trimmed.length === 0) return true;
	return trimmed.split(/\r?\n/).every((line) => {
		const t = line.trim();
		return t.length === 0 || t.startsWith(":");
	});
}

export async function readSse(
	response: Response,
	handlers: { [K in keyof SseEventMap]: (d: SseEventMap[K]) => void },
): Promise<SseReadResult> {
	if (!response.body) throw new Error("Respons tanpa body.");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buf = "";
	let corruptBlocks = 0;
	let completed = false;
	let sawFatalError = false;
	const processBlock = (block: string): void => {
		// Heartbeat server (": ping") diabaikan, bukan data korup.
		if (isHeartbeatBlock(block)) return;
		try {
			const { event, data } = parseSseBlock(block);
			if (!event || data === undefined) return;
			const handler = handlers[event as keyof SseEventMap];
			if (!handler) return;
			const payload = JSON.parse(data) as unknown;
			const applyHandler = handlers[event as keyof SseEventMap] as (d: unknown) => void;
			applyHandler(payload);
			if (event === "done") completed = true;
			if (event === "error" && (payload as { kind?: unknown } | null)?.kind === "fatal") sawFatalError = true;
		} catch {
			corruptBlocks += 1;
		}
	};
	let readFailed = false;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buf += decoder.decode(value, { stream: true });
			// Pencarian pakai offset pointer: tidak menyalin ulang sisa buffer per blok
			// (menghindari O(B^2) ala buf.slice berulang). Kompaksi sekali per chunk.
			let start = 0;
			let sep = buf.indexOf("\n\n");
			while (sep !== -1) {
				processBlock(buf.slice(start, sep));
				start = sep + 2;
				sep = buf.indexOf("\n\n", start);
			}
			if (start > 0) {
				buf = buf.slice(start);
			}
		}
		buf += decoder.decode();
		if (buf.length > 0) processBlock(buf);
	} catch {
		// Putus di tengah (network/proxy) TIDAK dilempar mentah ke UI; dilaporkan
		// lewat kanal error SSE + status hasil.
		readFailed = true;
	}
	// Blok korup / putus hanya dilaporkan bila stream belum selesai normal: setelah
	// "done" diterima, sisa sampah tidak boleh memicu error "Sebagian data tidak terbaca".
	if (!completed) {
		if (corruptBlocks > 0) {
			handlers.error({ stage: 0, kind: "retryable", message: `Sebagian data streaming tidak terbaca (${corruptBlocks} blok). Hasil mungkin tidak lengkap.` });
		} else if (!sawFatalError) {
			// Putus di tengah tanpa penjelasan server -> pesan yang bisa dibaca manusia,
			// bukan error mentah dari fetch/reader.
			handlers.error({ stage: 0, kind: "retryable", message: "Koneksi streaming terputus sebelum selesai. Hasil mungkin tidak lengkap." });
		}
	}
	const completion: SseCompletion = completed ? "done" : readFailed || corruptBlocks > 0 || sawFatalError ? "error" : "truncated";
	return { completed, completion, corruptBlocks };
}
