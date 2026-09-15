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

// Pesan error jaringan dalam Bahasa Indonesia: jangan teruskan e.message mentah
// browser ("Failed to fetch"/"Network error"/"NetworkError") ke UI.
const NETWORK_ERROR_MESSAGE = "Koneksi ke server terputus. Periksa jaringan Anda lalu coba lagi.";

function toUserError(e: unknown): string {
	const raw = e instanceof Error ? e.message : "";
	if (!raw || /failed to fetch|network ?error|networkerror|load failed|fetch failed|connection/i.test(raw)) {
		return NETWORK_ERROR_MESSAGE;
	}
	return raw;
}

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
	// Daftar dokumen plan yang belum selesai (stream putus / tanpa "done") untuk UI resume.
	const [resume, setResume] = useState<DocName[] | null>(null);
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
	// Controller terpisah untuk /api/clarify: klik "Chat Baru" saat clarify in-flight
	// harus membatalkan request dan mengabaikan respons basi.
	const clarifyAbortRef = useRef<AbortController | null>(null);
	// Guard double-submit sinkron: state `busy` hanya terbaca pada render berikutnya.
	const busyRef = useRef(false);
	// Daftar dokumen dari event "plan" + isi docs terkini (akses sinkron untuk resume).
	const planRef = useRef<DocName[]>([]);
	const docsRef = useRef<GeneratedDoc[]>([]);
	const resumeRef = useRef<DocName[] | null>(null);
	// Ref ke runRegenerate terbaru: loop resume memanggil versi terkini, bukan closure basi.
	const runRegenerateRef = useRef<(name: DocName) => Promise<void>>(async () => undefined);
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
		const stored = localStorage.getItem("romushai-theme");
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

	// Sinkronkan docsRef agar loop resume/regenerate beruntun memakai data terbaru.
	useEffect(() => {
		docsRef.current = docs;
	}, [docs]);

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
				localStorage.setItem("romushai-theme", next ? "dark" : "light");
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
			// Tandai sibuk secara sinkron: continueGenerate/retryGenerate memanggil langsung
			// tanpa lewat runGenerate; guard double-submit dibaca dari ref ini.
			busyRef.current = true;
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
			// Reset rencana + status resume run sebelumnya (akses sinkron untuk handler).
			planRef.current = [];
			docsRef.current = [];
			resumeRef.current = null;
			setResume(null);

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
				plan: ({ docs: planned }) => {
					// Rencana dokumen dari server: dipakai mendeteksi sisa bila stream terputus.
					planRef.current = planned;
				},
				error: ({ stage, message }) => {
					setErrorMsg(message);
					// Tandai HANYA stage yang gagal (kembali netral), jangan semua stage hijau.
					setStageStatus((prev) => ({ ...prev, [stage]: "idle" }));
					setStreaming(null);
				},
				done: ({ docs: d, taskCount: tc, failed: f, scope: sc, analysis: an, gaps: g, memory: mem }) => {
					setDocs(d);
					docsRef.current = d;
					setTaskCount(tc);
					setFailed(f);
					scopeRef.current = sc;
					// done = terminal: error basi (mis. retryable sebelum done) tidak boleh menimpa hasil.
					// Jaring pengaman: done kosong (0 docs & 0 failed) -> jangan hapus error fatal
					// yang sudah di-emit server; error harus tetap tampil sebagai akhir run.
					if (d.length > 0 || f.length > 0) setErrorMsg(null);
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
					setStreaming(null);
				} else {
					const result = await readSse(res, handlers);
					if (abortRef.current !== controller) return; // run sudah digantikan; jangan sentuh state
					const received = new Set(docsRef.current.map((d) => d.name));
					const missing = planRef.current.filter((p) => !received.has(p));
					if (result.completed && missing.length === 0) {
						// Selesai normal: bersihkan resume + error basi.
						resumeRef.current = null;
						setResume(null);
					} else if (missing.length > 0) {
						// Stream terputus / budget habis sebelum semua dokumen: tawarkan resume.
						resumeRef.current = missing;
						setResume(missing);
					}
				}
			} catch (e) {
				if (e instanceof Error && e.name === "AbortError") {
					// Abort oleh run baru: jangan sentuh streaming (milik run baru).
					if (abortRef.current === controller) setStreaming(null);
					return;
				}
				setErrorMsg(toUserError(e));
				setStreaming(null);
			} finally {
				// Guard: run lama yang sudah digantikan tidak boleh mematikan busy milik run baru.
				if (abortRef.current === controller) {
					abortRef.current = null;
					busyRef.current = false;
					setBusy(false);
				}
			}
		},
		[markStagesDone, saveHistory],
	);

	const runGenerate = useCallback(
		async (override?: string) => {
			const text = (override ?? idea).trim();
			// Guard sinkron: dua submit dalam tick yang sama hanya menjalankan satu run.
			if (!text || busyRef.current) return;
			busyRef.current = true;
			// Batalkan clarify in-flight sebelumnya agar respons basi tidak menulis state.
			clarifyAbortRef.current?.abort();
			const clarifyController = new AbortController();
			clarifyAbortRef.current = clarifyController;
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
					signal: clarifyController.signal,
				});
				if (clarifyAbortRef.current !== clarifyController) return; // sudah digantikan / chat baru
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
					if (clarifyAbortRef.current !== clarifyController) return; // respons basi; jangan tulis state
					setClarify(questions);
					setAnswers(questions.map((q) => q.recommended));
					return;
				}
				await runPipeline(text, []);
			} catch (e) {
				if (e instanceof Error && e.name === "AbortError") return;
				await runPipeline(text, []);
			} finally {
				if (clarifyAbortRef.current === clarifyController) clarifyAbortRef.current = null;
				// runPipeline mengatur busyRef sendiri; hanya bersihkan bila tidak ada run aktif
				// (mis. jalur klarifikasi atau run baru yang mengambil alih tidak boleh dimatikan).
				if (abortRef.current === null) {
					busyRef.current = false;
					setBusy(false);
				}
			}
		},
		[idea, runPipeline],
	);

	const useAllRecommendations = useCallback((): void => {
		if (!clarify) return;
		setAnswers(clarify.map((q) => q.recommended));
	}, [clarify]);

	const continueGenerate = useCallback(() => {
		if (!clarify) return;
		// Jangan timpa run aktif: state `busy` basi bila dua aksi dalam tick yang sama.
		if (busyRef.current) return;
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
		if (!sentIdea || busyRef.current) return;
		void runPipeline(sentIdea, answers);
	}, [sentIdea, answers, runPipeline]);

	const runRegenerate = useCallback(
		async (name: DocName) => {
			// Guard sinkron: double-submit / loop resume tidak boleh tumpang tindih.
			if (busyRef.current) return;
			const text = sentIdea.trim();
			if (!text || !scopeRef.current) {
				setErrorMsg("Tidak ada konteks. Jalankan Generate dulu.");
				return;
			}
			busyRef.current = true;
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
				// docsRef (bukan state `docs`) agar loop resume beruntun memakai isi terbaru.
				docs: docsRef.current.filter((d) => d.name !== name),
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
				plan: () => undefined,
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
						docsRef.current = docsRef.current.filter((x) => x.name !== d[0].name).concat(d[0]);
						if (d[0].name === "TASK-LIST" && tc > 0) setTaskCount(tc);
						setPreview(d[0].name);
						// Dokumen ini selesai: keluarkan dari daftar sisa resume.
						setResume((prev) => {
							if (!prev) return prev;
							const next = prev.filter((n) => n !== d[0].name);
							resumeRef.current = next.length > 0 ? next : null;
							return next.length > 0 ? next : null;
						});
					}
					if (f.length > 0) {
						setFailed((prev) => [...prev.filter((x) => x.name !== f[0].name), f[0]]);
					}
					// done = terminal; jangan tampilkan error basi. Done kosong (0 docs & 0 failed)
					// -> biarkan error fatal yang sudah di-emit server tetap tampil.
					if (d.length > 0 || f.length > 0) setErrorMsg(null);
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
					setStreaming(null);
				} else {
					const result = await readSse(res, handlers);
					if (abortRef.current !== controller) return; // run sudah digantikan
					if (result.completed) setErrorMsg(null);
					else setStreaming(null);
				}
			} catch (e) {
				if (e instanceof Error && e.name === "AbortError") {
					// Abort oleh run baru: jangan sentuh streaming (milik run baru).
					if (abortRef.current === controller) setStreaming(null);
					return;
				}
				setErrorMsg(toUserError(e));
				setStreaming(null);
			} finally {
				// Guard: run lama yang sudah digantikan tidak boleh mematikan busy milik run baru.
				if (abortRef.current === controller) {
					abortRef.current = null;
					busyRef.current = false;
					setBusy(false);
				}
			}
		},
		[sentIdea, answers],
	);

	// Ref sinkron untuk resume: dipakai loop di bawah tanpa menunggu render.
	useEffect(() => {
		resumeRef.current = resume;
	}, [resume]);
	useEffect(() => {
		runRegenerateRef.current = runRegenerate;
	}, [runRegenerate]);

	// "Lanjutkan dokumen tersisa": regenerate dokumen sisa satu per satu memakai
	// endpoint stateless yang sudah ada. Daftar sisa diperbarui di done handler
	// runRegenerate; tombol hilang saat daftar kosong.
	const resumeRemaining = useCallback(async (): Promise<void> => {
		const remaining = resumeRef.current;
		if (!remaining || remaining.length === 0) return;
		for (const doc of [...remaining]) {
			await runRegenerateRef.current(doc);
		}
	}, []);

	const removeHistory = useCallback((id: string) => {
		setHistory(removeStoredHistory(id));
	}, []);
	const loadHistory = useCallback((entry: HistoryRecord) => {
		abortRef.current?.abort();
		abortRef.current = null;
		clarifyAbortRef.current?.abort();
		clarifyAbortRef.current = null;
		// Run dibatalkan paksa: guard finally run lama tidak jalan, reset manual di sini.
		busyRef.current = false;
		setBusy(false);
		setHasRun(true);
		setDocs(entry.docs);
		docsRef.current = entry.docs;
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
		planRef.current = [];
		resumeRef.current = null;
		setResume(null);
		setDrawerOpen(false);
	}, []);

	const handleNewChat = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		clarifyAbortRef.current?.abort();
		clarifyAbortRef.current = null;
		// Run dibatalkan paksa: guard finally run lama tidak jalan, reset manual di sini.
		busyRef.current = false;
		setBusy(false);
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
		docsRef.current = [];
		setFailed([]);
		setTaskCount(0);
		setPreview(null);
		setErrorMsg(null);
		scopeRef.current = "";
		analysisRef.current = "";
		gapsRef.current = [];
		planRef.current = [];
		resumeRef.current = null;
		setResume(null);
		setDrawerOpen(false);
	}, []);

	const showAssistant = busy || Object.keys(stageStatus).length > 0 || (assistantText.length > 0 && !busy);

	const onComposerChange = useCallback((v: string) => {
		// Mengetik tidak boleh menghapus kartu klarifikasi: kartu hanya dibersihkan
		// saat submit/reset eksplisit (runGenerate/continueGenerate/handleNewChat).
		setIdea(v.slice(0, MAX_IDEA_LENGTH));
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
	const handleResumeRemaining = useCallback(() => {
		void resumeRemaining();
	}, [resumeRemaining]);
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
						resume={resume}
						threadEndRef={threadEndRef}
						onAnswer={handleAnswer}
						onUseAll={useAllRecommendations}
						onContinue={continueGenerate}
						onPreviewDoc={handlePreviewDoc}
						onCopyDoc={handleCopyDoc}
						onDownloadDoc={downloadDoc}
						onRegenerateDoc={handleRegenerateDoc}
						onRetryError={retryGenerate}
						onResumeRemaining={handleResumeRemaining}
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
