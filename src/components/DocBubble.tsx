"use client";

import { memo } from "react";
import { Copy, Check, Download, Eye, RefreshCw, AlertTriangle, FileText } from "lucide-react";
import type { FailedDoc, GeneratedDoc } from "@/lib/prd/types";
import { docFileName } from "@/lib/format";

// memo: kartu dokumen hanya re-render bila props-nya benar-benar berubah,
// bukan tiap tick typewriter di Thread.tsx.
export const DocBubble = memo(function DocBubble({ doc, taskCount, isPreviewOpen, isCopied, onPreview, onCopy, onDownload, onRegenerate, canRegenerate }: { doc: GeneratedDoc; taskCount: number; isPreviewOpen: boolean; isCopied: boolean; onPreview: () => void; onCopy: () => void; onDownload: () => void; onRegenerate: () => void; canRegenerate: boolean }) {
	const subtitle = doc.name === "TASK-LIST" ? `${taskCount} tugas` : "Dokumen";
	return (
		<article className="flex flex-col sm:flex-row justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm transition-shadow duration-[var(--dur-med)] hover:shadow-md">
			<div className="flex items-center gap-2">
				<div
					className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)]"
					aria-hidden="true"
				>
					<FileText className="size-4 text-[var(--accent)]" />
				</div>
				<div className="min-w-0">
					<div className="font-mono text-[13px] font-semibold">{docFileName(doc.name)}</div>
					<div className="text-[11px] text-[var(--fg-muted)]">{subtitle}</div>
				</div>
			</div>
			<div className="sm:inline-flex sm:flex-row sm:h-min gap-1 my-auto grid grid-cols-2">
				<button
					type="button"
					onClick={onDownload}
					className="inline-flex min-h-[32px] w-full min-w-0 items-center justify-center gap-1 truncate rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1 text-[10px] font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)]"
					aria-label={`Unduh ${docFileName(doc.name)}`}
				>
					<Download
						className="size-3 shrink-0"
						aria-hidden="true"
					/>
					<span>Unduh</span>
				</button>
				<button
					type="button"
					onClick={onCopy}
					className={`inline-flex min-h-[32px] w-full min-w-0 items-center justify-center gap-1 truncate rounded-[var(--radius-md)] border px-3 py-1 text-[10px] font-medium transition-colors duration-[var(--dur-fast)] ${isCopied ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"}`}
					aria-label={`Salin ${docFileName(doc.name)}`}
				>
					{isCopied ? (
						<>
							<Check
								className="size-3 shrink-0"
								aria-hidden="true"
							/>
							<span
								className="truncate"
								aria-live="polite"
							>
								Tersalin
							</span>
						</>
					) : (
						<>
							<Copy
								className="size-3 shrink-0"
								aria-hidden="true"
							/>
							<span>Salin</span>
						</>
					)}
				</button>
				<button
					type="button"
					onClick={onPreview}
					aria-expanded={isPreviewOpen}
					className={`inline-flex min-h-[32px] w-full min-w-0 items-center justify-center gap-1 truncate rounded-[var(--radius-md)] border px-3 py-1 text-[10px] font-medium transition-colors duration-[var(--dur-fast)] ${isPreviewOpen ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-700)]" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"}`}
					aria-label={`Pratinjau ${docFileName(doc.name)}`}
				>
					<Eye
						className="size-3 shrink-0"
						aria-hidden="true"
					/>
					<span>Pratinjau</span>
				</button>
				<button
					type="button"
					onClick={onRegenerate}
					disabled={!canRegenerate}
					className="inline-flex min-h-[32px] w-full min-w-0 items-center justify-center gap-1 truncate rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1 text-[10px] font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
					aria-label={`Buat ulang ${docFileName(doc.name)}`}
				>
					<RefreshCw
						className="size-3 shrink-0"
						aria-hidden="true"
					/>
					<span>Buat ulang</span>
				</button>
			</div>
		</article>
	);
});

export function FailedDocBubble({ doc, onRetry, canRetry }: { doc: FailedDoc; onRetry: () => void; canRetry: boolean }) {
	return (
		<div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--warn)] bg-[var(--warn-soft)] p-3 text-[13px]">
			<div className="min-w-0">
				<span className="font-mono font-semibold">{docFileName(doc.name)}</span>
				<span className="ml-1 text-[var(--fg-muted)]">- {doc.reason}</span>
			</div>
			<button
				type="button"
				onClick={onRetry}
				disabled={!canRetry}
				className="shrink-0 rounded-[var(--radius-md)] bg-[var(--warn)] px-3 py-1 text-xs font-medium text-[var(--on-accent)] transition-colors duration-[var(--dur-fast)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Coba lagi
			</button>
		</div>
	);
}

export function ErrorBubble({ message, onRetry, canRetry }: { message: string; onRetry?: () => void; canRetry: boolean }) {
	return (
		<div
			className="flex items-start gap-2 self-start rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]"
			role="alert"
		>
			<AlertTriangle
				className="mt-0.5 size-4 shrink-0"
				aria-hidden="true"
			/>
			<div className="flex-1">
				<p>{message}</p>
				{onRetry && (
					<button
						type="button"
						onClick={onRetry}
						disabled={!canRetry}
						className="mt-2 inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-current px-3 py-1 text-xs font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
					>
						<RefreshCw
							className="size-3"
							aria-hidden="true"
						/>
						Coba lagi
					</button>
				)}
			</div>
		</div>
	);
}
