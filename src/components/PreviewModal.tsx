"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { ArrowUp, Check, Copy, Download, FileText, X } from "lucide-react";
import type { GeneratedDoc } from "@/lib/prd/types";
import { docFileName, downloadDoc } from "@/lib/format";
import { trapTab } from "./focus-trap";

/** Salinan cadangan bila Clipboard API tak tersedia/gagal (mis. konteks non-HTTPS). */
function fallbackCopy(text: string): void {
	const ta = document.createElement("textarea");
	ta.value = text;
	ta.style.position = "fixed";
	ta.style.opacity = "0";
	document.body.appendChild(ta);
	ta.select();
	try {
		document.execCommand("copy");
	} catch {
		/* abaikan - umpan balik tetap diberikan oleh pemanggil */
	}
	document.body.removeChild(ta);
}

/**
 * Sembunyikan background dari keyboard/SR: tandai inert (bila didukung) + aria-hidden
 * pada sibling dialog, lalu pulihkan nilai semula saat unmount.
 */
function useInertSiblings(containerRef: React.RefObject<HTMLDivElement | null>): void {
	useEffect(() => {
		const parent = containerRef.current?.parentElement;
		const container = containerRef.current;
		if (!parent || !container) return;
		const siblings = Array.from(parent.children).filter((c) => c !== container && c instanceof HTMLElement) as HTMLElement[];
		const prev = siblings.map((el) => ({ inert: el.hasAttribute("inert"), hidden: el.getAttribute("aria-hidden") }));
		for (const el of siblings) {
			el.setAttribute("inert", "");
			el.setAttribute("aria-hidden", "true");
		}
		return () => {
			for (const [i, el] of siblings.entries()) {
				if (prev[i].inert) el.setAttribute("inert", "");
				else el.removeAttribute("inert");
				if (prev[i].hidden !== null) el.setAttribute("aria-hidden", prev[i].hidden);
				else el.removeAttribute("aria-hidden");
			}
		};
	}, [containerRef]);
}

export function PreviewModal({ doc, onClose }: { doc: GeneratedDoc | null; onClose: () => void }) {
	if (!doc) return null;
	return (
		<PreviewPanel
			key={doc.name}
			doc={doc}
			onClose={onClose}
		/>
	);
}

function PreviewPanel({ doc, onClose }: { doc: GeneratedDoc; onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	const bodyRef = useRef<HTMLDivElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<Element | null>(null);
	const copyTimer = useRef<number | undefined>(undefined);
	const [copied, setCopied] = useState(false);
	const [showTop, setShowTop] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [reduceMotion, setReduceMotion] = useState(false);

	useEffect(() => {
		triggerRef.current = document.activeElement;
		document.documentElement.style.overflow = "hidden";
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
				return;
			}
			trapTab(e, panelRef.current);
		};
		document.addEventListener("keydown", onKey);
		closeRef.current?.focus();
		return () => {
			document.documentElement.style.overflow = "";
			document.removeEventListener("keydown", onKey);
			const trigger = triggerRef.current;
			if (trigger instanceof HTMLElement && document.contains(trigger)) trigger.focus();
		};
	}, [onClose]);

	useInertSiblings(rootRef);

	useEffect(() => {
		// setState dijadwalkan asinkron (rAF) agar tidak memicu cascading render di body effect.
		const raf = window.requestAnimationFrame(() => {
			setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
			setMounted(true);
		});
		return () => window.cancelAnimationFrame(raf);
	}, []);

	useEffect(() => {
		const el = bodyRef.current;
		if (!el) return;
		const onScroll = () => setShowTop(el.scrollTop > 300);
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => () => window.clearTimeout(copyTimer.current), []);

	const fileName = docFileName(doc.name);
	// Hitung kata sekali per isi dokumen, bukan tiap render (mis. saat scroll/showTop berubah).
	const wordCount = useMemo(() => (doc.content.trim() === "" ? 0 : doc.content.trim().split(/\s+/).length), [doc.content]);

	const handleCopy = () => {
		const done = () => {
			setCopied(true);
			window.clearTimeout(copyTimer.current);
			copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
		};
		try {
			const p = navigator.clipboard?.writeText(doc.content);
			if (p) {
				p.then(done).catch(() => {
					fallbackCopy(doc.content);
					done();
				});
			} else {
				fallbackCopy(doc.content);
				done();
			}
		} catch {
			fallbackCopy(doc.content);
			done();
		}
	};

	const scrollToTop = () => {
		bodyRef.current?.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
	};

	return (
		<div
			ref={rootRef}
			className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 sm:items-center sm:p-6 ${mounted ? "opacity-100" : "opacity-0"}`}
			role="presentation"
			onClick={onClose}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label={`Pratinjau ${fileName}`}
				className={`relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] transition-transform duration-200 ease-out sm:rounded-[var(--radius-xl)] ${mounted ? "scale-100 opacity-100" : "scale-[0.98] opacity-95"}`}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-3">
					<div className="flex min-w-0 items-center gap-2">
						<div
							className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)]"
							aria-hidden="true"
						>
							<FileText className="size-4 text-[var(--accent)]" />
						</div>
						<div className="min-w-0">
							<h2 className="truncate font-mono text-[13px] font-semibold">{fileName}</h2>
							<p className="text-[11px] text-[var(--fg-muted)]">{wordCount} kata</p>
						</div>
					</div>
					<button
						ref={closeRef}
						type="button"
						onClick={onClose}
						aria-label={`Tutup pratinjau ${fileName}`}
						className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)]"
					>
						<X
							className="size-4"
							aria-hidden="true"
						/>
					</button>
				</div>
				<div
					ref={bodyRef}
					className="themed-scrollbar prose prose-sm max-w-none flex-1 overflow-y-auto px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] prose-zinc dark:prose-invert prose-p:leading-5 prose-headings:font-semibold prose-headings:scroll-mt-4 prose-pre:rounded-[var(--radius-md)] prose-pre:text-[12px] prose-table:text-[12px] prose-img:rounded-[var(--radius-md)]"
				>
					<Markdown>{doc.content}</Markdown>
				</div>
				{showTop ? (
					<button
						type="button"
						onClick={scrollToTop}
						aria-label="Kembali ke atas"
						className="absolute bottom-16 right-3 flex size-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)]"
					>
						<ArrowUp
							className="size-4"
							aria-hidden="true"
						/>
					</button>
				) : null}
				<div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-[var(--border)] px-3 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
					<button
						type="button"
						onClick={handleCopy}
						aria-label={`Salin ${fileName}`}
						className={`inline-flex min-h-[32px] items-center gap-1 rounded-[var(--radius-md)] border px-2.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] ${copied ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"}`}
					>
						{copied ? (
							<Check
								className="size-3.5"
								aria-hidden="true"
							/>
						) : (
							<Copy
								className="size-3.5"
								aria-hidden="true"
							/>
						)}
						<span>{copied ? "Tersalin" : "Salin"}</span>
					</button>
					<button
						type="button"
						onClick={() => downloadDoc(doc.name, doc.content)}
						aria-label={`Unduh ${fileName}`}
						className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)]"
					>
						<Download
							className="size-3.5"
							aria-hidden="true"
						/>
						<span>Unduh</span>
					</button>
				</div>
			</div>
		</div>
	);
}
