"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClarifyQuestion, DocName, FailedDoc, GeneratedDoc } from "@/lib/prd/types";
import { loadHistory as readHistory, deleteHistory as removeStoredHistory, saveHistory as storeHistory, type HistoryRecord } from "@/lib/history";
import { mirrorDoneMemory } from "@/lib/memory-client";
import { derivePreview, deriveProjectName, downloadDoc, MAX_IDEA_LENGTH } from "@/lib/format";
import { readSse, type SseEventMap } from "@/lib/prd/sse-client";
import { ThreadHeaderV2 } from "@/components/ThreadHeader";
import { Hero } from "@/components/Hero";
import { ComposerFixedBottom } from "@/components/Composer";
import { ThreadView, type StageStatus } from "@/components/Thread";
import { PreviewModal } from "@/components/PreviewModal";
import { HistoryDrawer } from "@/components/HistoryDrawer";

export default function PrdPage() {
	const [idea, setIdea] = useState("");
	const [busy, setBusy] = useState(false);
	const [stageStatus, setStageStatus] = useState<Record<number, StageStatus>>({});
	const [streaming, setStreaming] = useState<{ doc: DocName; text: string } | null>(null);
	const [docs, setDocs] = useState<GeneratedDoc[]>([]);
	const [failed, setFailed] = useState<FailedDoc[]>([]);
	const [taskCount, setTaskCount] = useState(0);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [preview, setPreview] = useState<DocName | null>(null);
	const [history, setHistory] = useState<HistoryRecord[]>([]);
	const [clarify, setClarify] = useState<ClarifyQuestion[] | null>(null);
	const [answers, setAnswers] = useState<string[]>([]);
	const [copied, setCopied] = useState<DocName | null>(null);
	const [sentIdea, setSentIdea] = useState("");
	const analysisRef = useRef("");
	const gapsRef = useRef<string[]>([]);
	const [completedClarify, setCompletedClarify] = useState<{ questions: ClarifyQuestion[]; answers: string[] } | null>(null);
	const completedClarifyRef = useRef<{ questions: ClarifyQuestion[]; answers: string[] } | null>(null);
	const [assistantText, setAssistantText] = useState("");
	const [hasRun, setHasRun] = useState(false);
	const [isDark, setIsDark] = useState<boolean | null>(null);
	const scopeRef = useRef("");
	const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const threadEndRef = useRef<HTMLDivElement>(null);
	const prefersReducedMotion = useRef(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const isNearBottomRef = useRef(true);
	// Scroll auto: maksimal satu window.scrollTo per frame (flag rAF), dan
	// behavior terbaru dibaca dari ref agar tidak memakai nilai basi.
	const scrollRafRef = useRef(0);
	const scrollBehaviorRef = useRef<ScrollBehavior>("auto");
	const hasContent = !!(hasRun || sentIdea || docs.length > 0 || busy || clarify || completedClarify);

	useEffect(() => {
		const onScroll = () => {
			isNearBottomRef.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
		};
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [hasContent]);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		prefersReducedMotion.current = mq.matches;
		const handler = (e: MediaQueryListEvent) => {
			prefersReducedMotion.current = e.matches;
		};
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	useEffect(() => {
		const stored = localStorage.getItem("aiprd-theme");
		const dark = stored ? stored === "dark" : true;
		const timer = setTimeout(() => setIsDark(dark), 0);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => {
			setHistory(readHistory());
		}, 0);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		return () => {
			if (copyTimer.current) clearTimeout(copyTimer.current);
			abortRef.current?.abort();
			abortRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (drawerOpen) return;
		if (!isNearBottomRef.current) return;
		// Maksimal satu scroll per frame: chunk beruntun tidak me-restart animasi.
		// Behavior dibaca dari ref agar keputusan terbaru (busy/selesai) tetap dipakai.
		scrollBehaviorRef.current = busy || prefersReducedMotion.current ? "auto" : "smooth";
		if (scrollRafRef.current) return;
		scrollRafRef.current = requestAnimationFrame(() => {
			scrollRafRef.current = 0;
			window.scrollTo({
				top: document.documentElement.scrollHeight,
				behavior: scrollBehaviorRef.current,
			});
		});
	}, [streaming?.text, docs, clarify, busy, failed, errorMsg, drawerOpen]);

	const toggleTheme = useCallback(() => {
		setIsDark((prev) => {
			const next = prev === null ? true : !prev;
			document.documentElement.classList.toggle("dark", next);
			document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
			try {
				localStorage.setItem("aiprd-theme", next ? "dark" : "light");
			} catch {
				// abaikan
			}
			return next;
		});
	}, []);

	const saveHistory = useCallback((entry: HistoryRecord) => {
		setHistory(storeHistory(entry));
	}, []);

	const markStagesDone = useCallback(() => {
		setStageStatus({ 0: "done", 1: "done", 2: "done", 3: "done", 4: "done", 5: "done", 6: "done", 7: "done", 8: "done" });
	}, []);

	const copyDoc = useCallback(async (name: DocName, content: string): Promise<void> => {
		try {
			await navigator.clipboard.writeText(content);
			setCopied(name);
			if (copyTimer.current) clearTimeout(copyTimer.current);
			copyTimer.current = setTimeout(() => setCopied(null), 2000);
		} catch {
			setErrorMsg("Gagal menyalin ke clipboard.");
		}
	}, []);

	const runPipeline = useCallback(
		async (text: string, ans: string[]) => {
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;
			setBusy(true);
			setErrorMsg(null);
			setDocs([]);
			setFailed([]);
			setTaskCount(0);
			setPreview(null);
			setStreaming(null);
			setStageStatus({});
			setAssistantText("");
			scopeRef.current = "";

			const handlers: { [K in keyof SseEventMap]: (d: SseEventMap[K]) => void } = {
				stage_start: ({ stage }) => {
					setStageStatus((prev) => ({ ...prev, [stage]: "active" }));
				},
				chunk: ({ stage, doc, text }) => {
					if (stage === 1) scopeRef.current += text;
					if (doc) {
						setStreaming((prev) => ({ doc, text: (prev?.doc === doc ? prev.text : "") + text }));
					} else {
						setStreaming(null);
						setAssistantText((prev) => prev + text);
					}
				},
				stage_end: ({ stage }) => {
					setStageStatus((prev) => ({ ...prev, [stage]: "done" }));
				},
				error: ({ message }) => {
					setErrorMsg(message);
					markStagesDone();
				},
				done: ({ docs: d, taskCount: tc, failed: f, scope: sc, analysis: an, gaps: g, memory: mem }) => {
					setDocs(d);
					setTaskCount(tc);
					setFailed(f);
					scopeRef.current = sc;
					if (typeof an === "string") analysisRef.current = an;
					if (Array.isArray(g)) gapsRef.current = g;
					setPreview(d.length > 0 ? d[0].name : null);
					// JANGAN null-kan streaming di sini: Thread.tsx memakai teks terakhir sebagai
					// ekor tampilan sampai typewriter selesai flush; reset terjadi saat run baru mulai.
					markStagesDone();
					if (d.length > 0) {
						saveHistory({
							id: String(Date.now()),
							title: deriveProjectName(d),
							timestamp: Date.now(),
							taskCount: tc,
							docs: d,
							failed: f,
							preview: derivePreview(d),
							sentIdea: text,
							completedClarify: completedClarifyRef.current,
							scope: sc,
							answers: ans,
							analysis: typeof an === "string" ? an : "",
							gaps: Array.isArray(g) ? g : [],
						});
					}
					mirrorDoneMemory(mem, d.find((x) => x.name === "MASTER-PRD")?.name ?? d[0]?.name ?? "MASTER-PRD", text);
				},
			};

			try {
				const res = await fetch("/api/generate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ idea: text, answers: ans }),
					signal: controller.signal,
				});
				if (!res.ok) {
					const payload = (await res.json().catch(() => null)) as { error?: string } | null;
					setErrorMsg(payload?.error ?? `Gagal memulai generasi (HTTP ${res.status}).`);
					markStagesDone();
				} else {
					await readSse(res, handlers);
				}
			} catch (e) {
				if (e instanceof Error && e.name === "AbortError") return;
				setErrorMsg(e instanceof Error ? e.message : "Gagal terhubung ke server.");
				markStagesDone();
			} finally {
				if (abortRef.current === controller) abortRef.current = null;
				setBusy(false);
			}
		},
		[markStagesDone, saveHistory],
	);

	const runGenerate = useCallback(
		async (override?: string) => {
			const text = (override ?? idea).trim();
			if (!text || busy) return;
			setErrorMsg(null);
			setHasRun(true);
			setClarify(null);
			setSentIdea(text);
			setIdea("");
			setCompletedClarify(null);
			completedClarifyRef.current = null;
			setAssistantText("");
			setBusy(true);
			analysisRef.current = "";
			gapsRef.current = [];
			try {
				const res = await fetch("/api/clarify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ idea: text }),
				});
				let questions: ClarifyQuestion[] = [];
				if (res.ok) {
					const payload = (await res.json().catch(() => null)) as {
						questions?: ClarifyQuestion[];
						analysis?: string;
						gaps?: string[];
					} | null;
					questions = payload?.questions ?? [];
					analysisRef.current = typeof payload?.analysis === "string" ? payload.analysis : "";
					gapsRef.current = Array.isArray(payload?.gaps) ? payload.gaps : [];
				}
				if (questions.length > 0) {
					setClarify(questions);
					setAnswers(questions.map((q) => q.recommended));
					return;
				}
				await runPipeline(text, []);
			} catch {
				await runPipeline(text, []);
			} finally {
				setBusy(false);
			}
		},
		[idea, busy, runPipeline],
	);

	const useAllRecommendations = useCallback((): void => {
		if (!clarify) return;
		setAnswers(clarify.map((q) => q.recommended));
	}, [clarify]);

	const continueGenerate = useCallback(() => {
		if (!clarify) return;
		const text = sentIdea.trim();
		if (!text) return;
		const done = { questions: clarify, answers: [...answers] };
		setHasRun(true);
		setCompletedClarify(done);
		completedClarifyRef.current = done;
		setClarify(null);
		void runPipeline(text, answers);
	}, [clarify, answers, sentIdea, runPipeline]);

	const retryGenerate = useCallback(() => {
		if (!sentIdea) return;
		void runPipeline(sentIdea, answers);
	}, [sentIdea, answers, runPipeline]);

	const runRegenerate = useCallback(
		async (name: DocName) => {
			if (busy) return;
			const text = sentIdea.trim();
			if (!text || !scopeRef.current) {
				setErrorMsg("Tidak ada konteks. Jalankan Generate dulu.");
				return;
			}
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;
			setBusy(true);
			setErrorMsg(null);
			setStreaming({ doc: name, text: "" });
			setPreview(name);

			const body = {
				idea: text,
				scope: scopeRef.current,
				doc: name,
				docs: docs.filter((d) => d.name !== name),
				answers: answers.length > 0 ? answers : undefined,
				analysis: analysisRef.current.length > 0 ? analysisRef.current : undefined,
				gaps: gapsRef.current.length > 0 ? gapsRef.current : undefined,
			};

			const handlers: { [K in keyof SseEventMap]: (d: SseEventMap[K]) => void } = {
				stage_start: () => undefined,
				chunk: ({ doc: d, text: t }) => {
					if (d) setStreaming((prev) => ({ doc: d, text: (prev?.doc === d ? prev.text : "") + t }));
				},
				stage_end: () => undefined,
				error: ({ message }) => {
					setErrorMsg(message);
					setStreaming(null);
				},
				done: ({ docs: d, taskCount: tc, failed: f, memory: mem }) => {
					// JANGAN null-kan streaming: Thread.tsx memakai teks terakhir sebagai ekor
					// tampilan sampai typewriter selesai flush; reset saat run baru mulai.
					if (d.length > 0) {
						setDocs((prev) => {
							const next = prev.filter((x) => x.name !== d[0].name);
							return [...next, d[0]].sort((a, b) => a.name.localeCompare(b.name));
						});
						if (d[0].name === "TASK-LIST" && tc > 0) setTaskCount(tc);
						setPreview(d[0].name);
					}
					if (f.length > 0) {
						setFailed((prev) => [...prev.filter((x) => x.name !== f[0].name), f[0]]);
					}
					mirrorDoneMemory(mem, d[0]?.name ?? name, text);
				},
			};

			try {
				const res = await fetch("/api/regenerate-doc", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
					signal: controller.signal,
				});
				if (!res.ok) {
					const payload = (await res.json().catch(() => null)) as { error?: string } | null;
					setErrorMsg(payload?.error ?? `Gagal regenerate (HTTP ${res.status}).`);
				} else {
					await readSse(res, handlers);
				}
			} catch (e) {
				if (e instanceof Error && e.name === "AbortError") return;
				setErrorMsg(e instanceof Error ? e.message : "Gagal terhubung ke server.");
				setStreaming(null);
			} finally {
				if (abortRef.current === controller) abortRef.current = null;
				setBusy(false);
			}
		},
		[busy, sentIdea, docs, answers],
	);

	const removeHistory = useCallback((id: string) => {
		setHistory(removeStoredHistory(id));
	}, []);

	const loadHistory = useCallback((entry: HistoryRecord) => {
		abortRef.current?.abort();
		abortRef.current = null;
		setHasRun(true);
		setDocs(entry.docs);
		setTaskCount(entry.taskCount);
		setFailed(entry.failed);
		setPreview(null);
		setStreaming(null);
		setErrorMsg(null);
		setClarify(null);
		setAnswers(entry.answers ?? []);
		setSentIdea((entry.sentIdea ?? "").slice(0, MAX_IDEA_LENGTH));
		const cc = entry.completedClarify ?? null;
		setCompletedClarify(cc);
		completedClarifyRef.current = cc;
		setAssistantText("");
		scopeRef.current = entry.scope ?? "";
		analysisRef.current = entry.analysis ?? "";
		gapsRef.current = entry.gaps ?? [];
		setDrawerOpen(false);
	}, []);

	const handleNewChat = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		setIdea("");
		setHasRun(false);
		setSentIdea("");
		setClarify(null);
		setAnswers([]);
		setCompletedClarify(null);
		completedClarifyRef.current = null;
		setAssistantText("");
		setStageStatus({});
		setStreaming(null);
		setDocs([]);
		setFailed([]);
		setTaskCount(0);
		setPreview(null);
		setErrorMsg(null);
		scopeRef.current = "";
		analysisRef.current = "";
		gapsRef.current = [];
		setDrawerOpen(false);
	}, []);

	const showAssistant = busy || Object.keys(stageStatus).length > 0 || (assistantText.length > 0 && !busy);

	const onComposerChange = useCallback((v: string) => {
		setIdea(v.slice(0, MAX_IDEA_LENGTH));
		setClarify(null);
	}, []);

	// Callback stabil untuk ThreadView: identitas tetap antar tick typewriter
	// sehingga DocBubble memo + docCards useMemo tidak recompute tiap tick.
	const handleAnswer = useCallback((qi: number, val: string) => {
		setAnswers((prev) => prev.map((a, j) => (j === qi ? val : a)));
	}, []);
	const handlePreviewDoc = useCallback((name: DocName) => {
		setPreview((p) => (p === name ? null : name));
	}, []);
	const handleCopyDoc = useCallback(
		(name: DocName, content: string) => {
			void copyDoc(name, content);
		},
		[copyDoc],
	);
	const handleRegenerateDoc = useCallback(
		(name: DocName) => {
			void runRegenerate(name);
		},
		[runRegenerate],
	);
	const handleOpenHistory = useCallback(() => {
		setDrawerOpen(true);
	}, []);
	const handleCloseHistory = useCallback(() => {
		setDrawerOpen(false);
	}, []);
	const handleClosePreview = useCallback(() => {
		setPreview(null);
	}, []);
	const handleGenerateSubmit = useCallback(() => {
		void runGenerate();
	}, [runGenerate]);
	const handlePickExample = useCallback(
		(t: string) => {
			const v = t.slice(0, MAX_IDEA_LENGTH);
			setIdea(v);
			void runGenerate(v);
		},
		[runGenerate],
	);
	// Cari dokumen pratinjau sekali per perubahan docs/preview, bukan tiap tick streaming.
	const previewDoc = preview ? (docs.find((d) => d.name === preview) ?? null) : null;

	return (
		<div className="relative isolate flex min-h-[100dvh] flex-col bg-[var(--bg)]">
			<div
				className="landing-grid absolute inset-0 -z-50 pointer-events-none"
				aria-hidden="true"
			/>
			<ThreadHeaderV2
				subBrand="PRD"
				historyCount={history.length}
				hasContent={hasContent}
				isDark={isDark}
				historyOpen={drawerOpen}
				onOpenHistory={handleOpenHistory}
				onNewChat={handleNewChat}
				onToggleTheme={toggleTheme}
			/>

			<h1 className="sr-only">Generator PRD</h1>
			{!hasContent ? (
				<main className="flex flex-1 flex-col">
					<Hero
						subBrand="PRD"
						idea={idea}
						onChange={onComposerChange}
						onSubmit={handleGenerateSubmit}
						busy={busy}
						onPick={handlePickExample}
					/>
				</main>
			) : (
				<div className="flex flex-1 flex-col">
					<ThreadView
						sentIdea={sentIdea}
						clarify={clarify}
						answers={answers}
						busy={busy}
						completedClarify={completedClarify}
						streaming={streaming}
						stageStatus={stageStatus}
						showAssistant={showAssistant}
						assistantText={assistantText}
						docs={docs}
						taskCount={taskCount}
						preview={preview}
						copied={copied}
						failed={failed}
						errorMsg={errorMsg}
						threadEndRef={threadEndRef}
						onAnswer={handleAnswer}
						onUseAll={useAllRecommendations}
						onContinue={continueGenerate}
						onPreviewDoc={handlePreviewDoc}
						onCopyDoc={handleCopyDoc}
						onDownloadDoc={downloadDoc}
						onRegenerateDoc={handleRegenerateDoc}
						onRetryError={retryGenerate}
					/>

					<ComposerFixedBottom
						idea={idea}
						onChange={onComposerChange}
						onSubmit={handleGenerateSubmit}
						busy={busy}
					/>
				</div>
			)}

			<PreviewModal
				doc={previewDoc}
				onClose={handleClosePreview}
			/>

			<HistoryDrawer
				open={drawerOpen}
				history={history}
				onClose={handleCloseHistory}
				onLoad={loadHistory}
				onDelete={removeHistory}
			/>
		</div>
	);
}
