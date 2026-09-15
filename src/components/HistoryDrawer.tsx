"use client";

import { useEffect, useRef, useState } from "react";
import { History, X } from "lucide-react";
import type { HistoryRecord } from "@/lib/history";
import { trapTab } from "./focus-trap";

export function HistoryDrawer({ open, history, onClose, onLoad, onDelete }: { open: boolean; history: HistoryRecord[]; onClose: () => void; onLoad: (h: HistoryRecord) => void; onDelete: (id: string) => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	const asideRef = useRef<HTMLElement>(null);
	const [dragY, setDragY] = useState(0);
	const dragStart = useRef<{ y: number } | null>(null);
	const initialY = useRef(0);

	useEffect(() => {
		if (!open) return;
		const trigger = document.activeElement;
		document.documentElement.style.overflow = "hidden";
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
				return;
			}
			trapTab(e, asideRef.current);
		};
		document.addEventListener("keydown", onKey);
		closeRef.current?.focus();
		// Background (semua sibling panel, kecuali backdrop) di-inert agar tidak bisa difokus.
		const parent = asideRef.current?.parentElement;
		const siblings = parent ? (Array.from(parent.children).filter((c) => c !== asideRef.current && c instanceof HTMLElement && c.getAttribute("role") !== "presentation") as HTMLElement[]) : [];
		const prev = siblings.map((el) => ({ inert: el.hasAttribute("inert"), hidden: el.getAttribute("aria-hidden") }));
		for (const el of siblings) {
			el.setAttribute("inert", "");
			el.setAttribute("aria-hidden", "true");
		}
		return () => {
			document.documentElement.style.overflow = "";
			document.removeEventListener("keydown", onKey);
			for (const [i, el] of siblings.entries()) {
				if (prev[i].inert) el.setAttribute("inert", "");
				else el.removeAttribute("inert");
				if (prev[i].hidden !== null) el.setAttribute("aria-hidden", prev[i].hidden);
				else el.removeAttribute("aria-hidden");
			}
			if (trigger instanceof HTMLElement && document.contains(trigger)) trigger.focus();
		};
	}, [open, onClose]);

	if (!open) return null;

	const onPointerDown = (e: React.PointerEvent) => {
		dragStart.current = { y: e.clientY };
		initialY.current = dragY;
	};
	const onPointerMove = (e: React.PointerEvent) => {
		if (!dragStart.current) return;
		const dy = e.clientY - dragStart.current.y;
		setDragY(Math.max(0, initialY.current + dy));
	};
	const onPointerUp = () => {
		if (!dragStart.current) return;
		dragStart.current = null;
		if (dragY > 80) {
			onClose();
		}
		setDragY(0);
	};

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
				role="presentation"
				onClick={onClose}
			/>
			<aside
				ref={asideRef}
				id="history-drawer"
				role="dialog"
				aria-modal="true"
				aria-label="Riwayat"
				className="fixed z-50 flex flex-col bg-[var(--surface)] shadow-[var(--shadow-md)] transition-transform duration-[var(--dur-med)] ease-[var(--ease)] max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[85vh] max-sm:rounded-t-[var(--radius-xl)] max-sm:border-t max-sm:border-[var(--border)] sm:inset-y-0 sm:right-0 sm:w-[400px] sm:max-w-[90vw] sm:border-l sm:border-[var(--border)] lg:w-[380px]"
				style={{ transform: `translateY(${dragY}px)` }}
			>
				<div
					className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-[var(--radius-md)] bg-[var(--border-strong)] sm:hidden"
					aria-hidden="true"
					style={{ touchAction: "none" }}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerLeave={onPointerUp}
				/>
				<div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
					<h2 className="flex items-center gap-2 text-[13px] font-semibold">
						Riwayat
						<span className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--fg-muted)]">{history.length}</span>
					</h2>
					<button
						ref={closeRef}
						type="button"
						onClick={onClose}
						aria-label="Tutup riwayat"
						className="flex size-8 min-h-[36px] items-center justify-center rounded-[var(--radius-md)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)]"
					>
						<X
							className="size-4"
							aria-hidden="true"
						/>
					</button>
				</div>
				<div className="themed-scrollbar flex-1 overflow-y-auto px-2 py-2">
					{history.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
							<History
								className="size-6 text-[var(--fg-faint)]"
								aria-hidden="true"
							/>
							<p className="text-[13px] text-[var(--fg-muted)]">Belum ada riwayat</p>
							<p className="text-[11px] text-[var(--fg-faint)]">Generate pertama akan muncul di sini.</p>
						</div>
					) : (
						<div className="flex flex-col gap-1.5">
							{history.map((h) => (
								<div
									key={h.id}
									className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors duration-[var(--dur-fast)] hover:border-[var(--border-strong)] hover:shadow-sm"
								>
									<p className="truncate text-[13px] font-medium">{h.preview.replace(/^MASTER-PRD\s*/, "")}</p>
									<div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
										<time dateTime={new Date(h.timestamp).toISOString()}>{new Date(h.timestamp).toLocaleString("id-ID")}</time>
										{h.docs.length > 0 && <span className="inline-flex rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-700)]">{h.docs.length} Dokumen</span>}
										<span>{h.taskCount} tugas</span>
									</div>
									<p className="truncate text-[11px] text-[var(--fg-faint)]">{h.preview}</p>
									<div className="flex gap-1.5">
										<button
											type="button"
											onClick={() => onLoad(h)}
											aria-label={`Muat ${h.title}`}
											className="min-h-[30px] rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)]"
										>
											Muat
										</button>
										<button
											type="button"
											onClick={() => onDelete(h.id)}
											aria-label={`Hapus ${h.title}`}
											className="min-h-[30px] rounded-[var(--radius-md)] border border-[var(--danger)] px-2.5 py-1 text-[11px] text-[var(--danger)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--danger-soft)]"
										>
											Hapus
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
				<div className="shrink-0 border-t border-[var(--border)] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] text-[11px] text-[var(--fg-faint)]">Tersimpan di browser ini saja (localStorage).</div>
			</aside>
		</>
	);
}
