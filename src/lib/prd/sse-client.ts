// Pembaca SSE sisi client (tanpa node:*). Dipakai halaman PRD untuk stream /api/generate & /api/regenerate-doc.

import { parseSseBlock } from "./parse.ts";
import type { DocName, FailedDoc, GeneratedDoc, MemorySummary } from "./types.ts";

export interface SseEventMap {
	stage_start: { stage: number; name: string };
	chunk: { stage: number; doc?: DocName; text: string };
	stage_end: { stage: number };
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

export async function readSse(response: Response, handlers: { [K in keyof SseEventMap]: (d: SseEventMap[K]) => void }): Promise<void> {
	if (!response.body) throw new Error("Respons tanpa body.");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buf = "";
	let corruptBlocks = 0;
	const processBlock = (block: string): void => {
		try {
			const { event, data } = parseSseBlock(block);
			if (!event || data === undefined) return;
			const handler = handlers[event as keyof SseEventMap];
			if (!handler) return;
			const payload = JSON.parse(data) as unknown;
			const applyHandler = handlers[event as keyof SseEventMap] as (d: unknown) => void;
			applyHandler(payload);
		} catch {
			corruptBlocks += 1;
		}
	};
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
	if (buf.length > 0) processBlock(buf);
	if (corruptBlocks > 0) {
		handlers.error({ stage: 0, kind: "retryable", message: `Sebagian data streaming tidak terbaca (${corruptBlocks} blok). Hasil mungkin tidak lengkap.` });
	}
}
