"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Markdown from "react-markdown";
import { Sparkles, Loader2 } from "lucide-react";
import type { ClarifyQuestion, FailedDoc, GeneratedDoc } from "@/lib/prd/types";
import { docFileName } from "@/lib/format";
import { ClarifyCards } from "./ClarifyCards";
import { DocBubble, ErrorBubble, FailedDocBubble } from "./DocBubble";

export type StageStatus = "idle" | "active" | "done";

const STAGE_NAMES: Record<number, string> = {
	0: "Langkah 1: Analisis Kebutuhan Secara Mendalam dan Komprehensif",
	1: "Langkah 1: Analisis Kebutuhan Secara Mendalam dan Komprehensif",
	2: "Langkah 2: Pengambilan Skill dan Kapabilitas Agent yang Relevan",
	3: "Langkah 3: Penulisan Draf Dokumen",
	4: "Langkah 3: Penyusunan Task List",
	5: "Langkah 4: Verifikasi Kesesuaian Dokumen dengan Kebutuhan Pengguna",
	6: "Langkah 5: Audit Red-Team oleh Agent Hacker",
	7: "Langkah 6: Perbaikan Kesenjangan dan Kelemahan",
	8: "Langkah 7: Finalisasi Dokumen",
};

export function UserBubble({ text }: { text: string }) {
	return (
		<div
			className="self-end max-w-[75%] whitespace-pre-wrap break-words rounded-xl rounded-br-[5px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] leading-5 text-[var(--fg)]"
			role="group"
			aria-label="Pesan Anda"
		>
			<span className="sr-only">Anda: </span>
			{text}
		</div>
	);
}

function ProcessingLabel() {
	const start = useRef(0);
	const [ms, setMs] = useState(0);
	useEffect(() => {
		start.current = Date.now();
		const id = setInterval(() => setMs(Date.now() - start.current), 1000);
		return () => clearInterval(id);
	}, []);
	const s = Math.floor(ms / 1000);
	return (
		<>
			{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")} - Memproses
		</>
	);
}

export function AssistantMessage({ time, children }: { time?: React.ReactNode; children: React.ReactNode }) {
	return (
		<div className="w-full self-start rounded-xl rounded-tl-[5px] bg-transparent py-3">
			<div className="mb-2 flex items-center gap-2">
				<div
					className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)]"
					aria-hidden="true"
				>
					<Sparkles className="size-3 text-[var(--accent)]" />
				</div>
				<span className="text-[12px] font-semibold">RomushaiPRD</span>
				{time && <time className="ml-auto text-[11px] tabular-nums text-[var(--fg-faint)]">{time}</time>}
			</div>
			{children}
		</div>
	);
}

export function StatusChips({ stageStatus }: { stageStatus: Record<number, StageStatus> }) {
	const stages = [1, 2, 3, 4, 5, 6, 7, 8] as const;
	const any = stages.some((s) => stageStatus[s]);
	if (!any) return null;
	return (
		<div
			className="mt-2 flex flex-col gap-1.5"
			role="status"
			aria-label="Status pipeline"
		>
			{stages.map((s) => {
				const st = stageStatus[s] ?? "idle";
				return (
					<span
						key={s}
						className={`inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-medium transition-colors duration-[var(--dur-fast)] ${st === "active" ? "border-[var(--accent-ring)] bg-[var(--accent-soft)] text-[var(--accent-700)]" : st === "done" ? "border-[var(--border)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-faint)]"}`}
					>
						{st === "active" ? (
							<Loader2
								className="size-3 animate-spin"
								aria-hidden="true"
							/>
						) : (
							<span
								className="size-1.5 rounded-sm bg-current"
								aria-hidden="true"
							/>
						)}
						{STAGE_NAMES[s]}
						{st === "active" && <span className="sr-only"> (memproses)</span>}
						{st === "done" && <span className="sr-only"> (selesai)</span>}
					</span>
				);
			})}
		</div>
	);
}

export function AnswerChips({ questions, answers }: { questions: ClarifyQuestion[]; answers: string[] }) {
	return (
		<div
			className="flex flex-col items-end gap-4 self-end text-xs sm:text-sm"
			role="group"
			aria-label="Jawaban Anda"
		>
			{questions.map((q, i) => (
				<div
					key={i}
					className="flex max-w-[75%] flex-col items-start gap-1 self-end rounded-xl rounded-br-[5px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
				>
					<span className="inline-flex items-center rounded-[var(--radius-md)] text-[var(--fg-muted)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">Pertanyaan {i + 1}</span>
					<p className="text-[12px] text-[var(--fg-muted)] leading-5">{q.q}</p>
					<p className=" text-[12px] leading-5">{answers[i]}</p>
				</div>
			))}
		</div>
	);
}

export function TypingIndicator() {
	return (
		<div
			className="max-w-max self-start rounded-xl border border-[var(--border)] bg-transparent px-3 py-2"
			role="status"
			aria-label="Assistant sedang mengetik"
		>
			<div className="flex gap-1">
				{[0, 1, 2].map((i) => (
					<span
						key={i}
						className="size-1.5 rounded-sm bg-[var(--fg-faint)] animate-bounce"
						style={{ animationDelay: `${i * 0.15}s` }}
						aria-hidden="true"
					/>
				))}
			</div>
		</div>
	);
}

// 48ms (~21 setState/detik): separuh beban render dibanding 24ms, masih terasa halus.
const TYPE_TICK_MS = 48;

/** Hormati preferensi sistem: tampilkan teks langsung tanpa animasi. */
function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const handler = (e: MediaQueryListEvent): void => setReduced(e.matches);
		mq.addEventListener("change", handler);
		const timer = setTimeout(() => setReduced(mq.matches), 0);
		return () => {
			clearTimeout(timer);
			mq.removeEventListener("change", handler);
		};
	}, []);
	return reduced;
}

/**
 * Fallback typewriter: jamin teks terlihat "diketik 1 per 1" walau chunk tiba sekaligus.
 * `full` = target lengkap, `active` = masih streaming (2-24 karakter/tick, dipercepat bila
 * backlog besar), non-aktif = flush cepat (~backlog/8 per tick). setState hanya dipanggil
 * dari rAF (bukan sinkron di effect body) agar lolos react-hooks/set-state-in-effect.
 */
function useTypewriter(full: string, active: boolean, reduced: boolean): { text: string; done: boolean } {
	const [shown, setShown] = useState("");
	const shownRef = useRef("");

	useEffect(() => {
		if (reduced) {
			// Hormati prefers-reduced-motion: tampilkan penuh tanpa animasi (via rAF).
			shownRef.current = full;
			const raf = requestAnimationFrame(() => setShown(full));
			return () => cancelAnimationFrame(raf);
		}
		// Target berganti dokumen/run -> mulai dari kosong; jika lanjutan, pertahankan.
		if (!full.startsWith(shownRef.current)) shownRef.current = "";
		let raf = 0;
		let last = 0;
		const step = (now: number): void => {
			const base = shownRef.current;
			if (base.length >= full.length) return; // sudah penuh; chunk berikutnya me-restart loop
			raf = requestAnimationFrame(step);
			if (now - last < TYPE_TICK_MS) return;
			last = now;
			const backlog = full.length - base.length;
			const n = active ? (backlog > 600 ? 24 : backlog > 200 ? 10 : backlog > 60 ? 4 : 2) : Math.max(48, Math.ceil(backlog / 8));
			const next = full.slice(0, Math.min(full.length, base.length + n));
			shownRef.current = next;
			setShown(next);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [full, active, reduced]);

	if (reduced) return { text: full, done: true };
	const text = full.startsWith(shown) ? shown : "";
	return { text, done: text.length >= full.length };
}

export interface ThreadViewProps {
	sentIdea: string;
	clarify: ClarifyQuestion[] | null;
	answers: string[];
	busy: boolean;
	completedClarify: { questions: ClarifyQuestion[]; answers: string[] } | null;
	streaming: { doc: GeneratedDoc["name"]; text: string } | null;
	stageStatus: Record<number, StageStatus>;
	showAssistant: boolean;
	assistantText: string;
	docs: GeneratedDoc[];
	taskCount: number;
	preview: GeneratedDoc["name"] | null;
	copied: GeneratedDoc["name"] | null;
	failed: FailedDoc[];
	errorMsg: string | null;
	threadEndRef: RefObject<HTMLDivElement | null>;
	onAnswer: (qi: number, val: string) => void;
	onUseAll: () => void;
	onContinue: () => void;
	onPreviewDoc: (name: GeneratedDoc["name"]) => void;
	onCopyDoc: (name: GeneratedDoc["name"], content: string) => void;
	onDownloadDoc: (name: GeneratedDoc["name"], content: string) => void;
	onRegenerateDoc: (name: GeneratedDoc["name"]) => void;
	onRetryError?: () => void;
}

export function ThreadView(props: ThreadViewProps) {
	const { sentIdea, clarify, answers, busy, completedClarify, streaming, stageStatus, showAssistant, assistantText, docs, taskCount, preview, copied, failed, errorMsg, threadEndRef, onAnswer, onUseAll, onContinue, onPreviewDoc, onCopyDoc, onDownloadDoc, onRegenerateDoc, onRetryError } = props;
	const reduced = usePrefersReducedMotion();
	// `streaming` adalah source of truth (tidak di-null-kan saat done oleh page.tsx), jadi
	// teks akhir tetap ada sampai run berikutnya. Typewriter hanya menampilkan progres.
	const streamText = streaming?.text ?? "";
	const shownStream = useTypewriter(streamText, busy, reduced);
	const shownAssistant = useTypewriter(assistantText, busy, reduced);
	// Tampilkan box selama busy, atau selama typewriter belum selesai mengejar teks penuh
	// (flush pasca-done) - sehingga tidak ada lompatan ke kartu dokumen (poin C).
	const showStream = !!streaming && (busy || !shownStream.done);
	// Sembunyikan hanya kartu dokumen yang sedang di-stream (versi lama saat regenerate);
	// kartu lain tetap tampil agar tidak berkedip hilang.
	const visibleDocs = useMemo(() => (showStream && streaming ? docs.filter((d) => d.name !== streaming.doc) : docs), [showStream, streaming, docs]);
	const streamBoxRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = streamBoxRef.current;
		if (!el) return;
		if (el.scrollHeight - el.scrollTop - el.clientHeight <= 48) el.scrollTop = el.scrollHeight;
	}, [shownStream.text]);

	// Daftar kartu dibungkus useMemo + DocBubble memo: saat typewriter tick,
	// props tidak berubah identitas sehingga kartu dokumen tidak re-render.
	const docCards = useMemo(
		() =>
			visibleDocs.map((d) => (
				<DocBubble
					key={d.name}
					doc={d}
					taskCount={taskCount}
					isPreviewOpen={preview === d.name}
					isCopied={copied === d.name}
					onPreview={() => onPreviewDoc(d.name)}
					onCopy={() => onCopyDoc(d.name, d.content)}
					onDownload={() => onDownloadDoc(d.name, d.content)}
					onRegenerate={() => onRegenerateDoc(d.name)}
					canRegenerate={!busy}
				/>
			)),
		[visibleDocs, taskCount, preview, copied, busy, onPreviewDoc, onCopyDoc, onDownloadDoc, onRegenerateDoc],
	);

	return (
		<main className="mx-auto flex min-h-0 w-full max-w-3xl flex-col gap-4 px-3 py-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
			{sentIdea && <UserBubble text={sentIdea} />}

			{clarify && (
				<AssistantMessage time="Baru saja">
					<p className="mb-2 text-[13px] leading-5">Sebelum saya susun scope, beberapa pertanyaan cepat agar hasil lebih tajam:</p>
					<ClarifyCards
						questions={clarify}
						answers={answers}
						onAnswer={onAnswer}
						onUseAll={onUseAll}
						onContinue={onContinue}
						disabled={busy}
					/>
				</AssistantMessage>
			)}

			{completedClarify && (
				<AnswerChips
					questions={completedClarify.questions}
					answers={completedClarify.answers}
				/>
			)}

			{showAssistant && (
				<AssistantMessage time={busy ? <ProcessingLabel /> : "Selesai"}>
					{busy && !streaming && Object.keys(stageStatus).length === 0 && <TypingIndicator />}
					{shownAssistant.text &&
						(shownAssistant.done ? (
							<div className="prose prose-sm max-w-none prose-zinc dark:prose-invert prose-p:leading-5 prose-headings:font-semibold">
								<Markdown>{shownAssistant.text}</Markdown>
							</div>
						) : (
							// Selama typewriter belum selesai, render teks polos tanpa
							// react-markdown agar tidak parse ulang tiap tick. Teks akhir identik.
							<pre className="whitespace-pre-wrap font-sans text-[13px] leading-5">{shownAssistant.text}</pre>
						))}
					{showStream && streaming && (
						<div className="mt-1">
							<p className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--accent-ring)] bg-[var(--accent-soft)] px-2.5 py-1 text-[13px] leading-5">
								{busy ? "Sedang menulis" : "Selesai menulis"} <span className="font-mono text-[12px]">{docFileName(streaming.doc)}</span>
								{busy && (
									<span className="flex gap-1 ml-1">
										{[0, 1, 2].map((i) => (
											<span
												key={i}
												className="size-1.5 rounded-sm bg-[var(--accent)] animate-bounce"
												style={{ animationDelay: `${i * 0.15}s` }}
												aria-hidden="true"
											/>
										))}
									</span>
								)}
							</p>
							<div
								ref={streamBoxRef}
								className="themed-scrollbar mt-2 max-h-[64vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3"
								role="log"
								aria-live="polite"
								aria-label="Isi dokumen yang sedang ditulis"
							>
								<pre className="whitespace-pre-wrap font-mono text-[11px] leading-5">
									{shownStream.text}
									<span
										className="ml-[1px] inline-block h-[1em] w-[2px] animate-pulse bg-[var(--accent)] align-text-bottom"
										aria-hidden="true"
									/>
								</pre>
							</div>
						</div>
					)}
					<StatusChips stageStatus={stageStatus} />
				</AssistantMessage>
			)}

			{docCards}

			{failed.map((f) => (
				<FailedDocBubble
					key={f.name}
					doc={f}
					onRetry={() => onRegenerateDoc(f.name)}
					canRetry={!busy}
				/>
			))}

			{errorMsg && !busy && (
				<ErrorBubble
					message={errorMsg}
					onRetry={sentIdea ? onRetryError : undefined}
					canRetry={!busy}
				/>
			)}

			<div
				ref={threadEndRef}
				aria-hidden="true"
			/>
		</main>
	);
}
