"use client";

import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ isDark, onToggle }: { isDark: boolean | null; onToggle: () => void }) {
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label="Ganti tema terang/gelap"
			className="flex h-8 min-h-[32px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)] sm:h-8 sm:min-h-8 sm:px-2 sm:text-xs"
		>
			{isDark ? (
				<Sun
					className="size-3.5"
					aria-hidden="true"
				/>
			) : (
				<Moon
					className="size-3.5"
					aria-hidden="true"
				/>
			)}
		</button>
	);
}
