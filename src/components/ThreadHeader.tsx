"use client";

import { Plus, History, Home } from "lucide-react";
import { LogoMark, Wordmark } from "./BrandLogo";
import Link from "next/link";

export function ThreadHeaderV2({ subBrand, historyCount, hasContent, isDark, historyOpen, onOpenHistory, onNewChat, onToggleTheme }: { subBrand: string; historyCount: number; hasContent: boolean; isDark: boolean | null; historyOpen: boolean; onOpenHistory: () => void; onNewChat: () => void; onToggleTheme: () => void }) {
	return (
		<header
			role="banner"
			className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]/80 px-3 backdrop-blur"
		>
			<div className="flex min-w-0 items-center gap-2">
				<LogoMark size={26} />
				<Wordmark
					size="header"
					subBrand={subBrand}
					onClick={hasContent ? onNewChat : undefined}
				/>
			</div>
			<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
				{hasContent && (
					<button
						type="button"
						onClick={onNewChat}
						aria-label="Mulai chat baru"
						className="flex h-8 min-h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)] sm:h-8 sm:min-h-8 sm:px-2 sm:text-xs"
					>
						<Plus
							className="size-3.5"
							aria-hidden="true"
						/>
						<span className="hidden sm:inline">Chat Baru</span>
					</button>
				)}
				<button
					type="button"
					onClick={onOpenHistory}
					aria-haspopup="dialog"
					aria-expanded={historyOpen}
					aria-controls="history-drawer"
					aria-label="Buka riwayat"
					className="flex h-8 min-h-[32px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)] sm:h-8 sm:min-h-8 sm:px-2 sm:text-xs"
				>
					<History
						className="size-3.5"
						aria-hidden="true"
					/>
					<span className="hidden sm:inline">Riwayat</span>
					{historyCount > 0 && <span className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--fg-muted)]">{historyCount}</span>}
				</button>
				<Link
					href="/"
					aria-label="Kembali ke beranda"
					className="flex h-8 min-h-[32px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)] sm:h-8 sm:min-h-8 sm:px-2 sm:text-xs"
				>
					<Home
						className="size-3.5"
						aria-hidden="true"
					/>
				</Link>
			</div>
		</header>
	);
}
