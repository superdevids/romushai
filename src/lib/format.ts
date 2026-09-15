// Helper murni halaman PRD: penamaan project, cuplikan riwayat, dan unduhan markdown (client-only).

import type { DocName, GeneratedDoc } from "./prd/types";

export const MAX_IDEA_LENGTH = 2000;
export const IDEA_PLACEHOLDER = "Tulis ide Brilliantmu dengan jelas...\nContoh: Aplikasi kasir UMKM dengan laporan harian";

/** Nama dokumen siap tampil: tambah `.md` hanya bila belum ada. */
export function docFileName(name: string): string {
	return name.endsWith(".md") ? name : `${name}.md`;
}

export function deriveProjectName(docs: GeneratedDoc[]): string {
	const master = docs.find((d) => d.name === "MASTER-PRD");
	const heading = master ? /^#\s+(.+)$/m.exec(master.content) : null;
	if (heading) return heading[1].trim().slice(0, 60);
	return `PRD ${new Date().toLocaleString("id-ID")}`;
}

/** Cuplikan isi dokumen pertama (tanpa heading markdown) untuk kartu riwayat. */
export function derivePreview(docs: GeneratedDoc[]): string {
	const first = docs[0];
	if (!first) return "";
	const plain = first.content
		.replace(/^#+\s+/gm, "")
		.replace(/\s+/g, " ")
		.trim();
	return plain.slice(0, 80);
}

export function downloadDoc(name: DocName, content: string): void {
	const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = docFileName(name);
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
