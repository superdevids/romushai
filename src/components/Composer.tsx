"use client";

import { useCallback, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { IDEA_PLACEHOLDER, MAX_IDEA_LENGTH } from "@/lib/format";

function ComposerInner({ idea, onChange, onSubmit, busy, maxHeightClass, minHeightClass = "min-h-10 sm:min-h-12" }: { idea: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; maxHeightClass: string; minHeightClass?: string }) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	// Cache batas tinggi dari CSS. Diisi saat mount dan saat resize saja,
	// sehingga ketikan tidak lagi memanggil getComputedStyle per karakter.
	const maxPxRef = useRef<number>(Infinity);

	/** Hitung ulang batas tinggi dari CSS lalu terapkan ke textarea. */
	const measure = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		const maxPx = parseFloat(window.getComputedStyle(el).maxHeight);
		maxPxRef.current = Number.isFinite(maxPx) ? maxPx : Infinity;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, maxPxRef.current)}px`;
		el.scrollTop = el.scrollHeight;
	}, []);

	/** Autosize memakai batas tinggi yang sudah di-cache. */
	const resize = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, maxPxRef.current)}px`;
		el.scrollTop = el.scrollHeight;
	}, []);

	useEffect(() => {
		// Ukur batas tinggi sekali saat mount.
		measure();
	}, [measure]);

	useEffect(() => {
		resize();
	}, [idea, resize]);

	useEffect(() => {
		// Ukur ulang hanya saat viewport berubah (breakpoint min/max height responsif).
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [measure]);

	const handleInput = useCallback(
		(e: FormEvent<HTMLTextAreaElement>) => {
			onChange(e.currentTarget.value.slice(0, MAX_IDEA_LENGTH));
			resize();
		},
		[onChange, resize],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.nativeEvent.isComposing || e.key !== "Enter") return;
			if (e.shiftKey) {
				requestAnimationFrame(resize);
				return;
			}
			e.preventDefault();
			if (!busy) onSubmit();
		},
		[busy, onSubmit, resize],
	);

	const canSend = !busy && idea.trim().length > 0 && idea.length <= MAX_IDEA_LENGTH;
	const remaining = MAX_IDEA_LENGTH - idea.length;

	return (
		<div
			onClick={() => textareaRef.current?.focus()}
			className={`flex flex-col rounded-2xl border border-[var(--border-input)] bg-[var(--surface)] px-2 pt-3 pb-1.5 transition-shadow duration-[var(--dur-fast)] focus-within:border-[var(--accent-focus)] focus-within:shadow-[inset_0_0_0_1px_var(--accent-focus)] ${busy ? "cursor-not-allowed opacity-55" : ""}`}
		>
			<textarea
				ref={textareaRef}
				rows={1}
				value={idea}
				onChange={handleInput}
				onKeyDown={handleKeyDown}
				disabled={busy}
				aria-label="Tulis ide project"
				aria-disabled={busy || undefined}
				aria-busy={busy || undefined}
				placeholder={busy ? "Sedang memproses, mohon tunggu..." : IDEA_PLACEHOLDER}
				style={{ outline: "none", border: "none", boxShadow: "none" }}
				className={`idea-scrollbar w-full resize-none overflow-y-auto border-none bg-transparent text-[13px] leading-[1.4] text-[var(--fg)] outline-none focus:border-none focus:outline-none focus:ring-0 placeholder:text-[var(--fg-faint)] ${minHeightClass} ${maxHeightClass}`}
			/>
			<div className="mt-1.5 flex items-center justify-between gap-1.5">
				<div className="flex items-center gap-1.5 pl-1">
					{busy ? (
						<span
							role="status"
							className="text-[10.5px] font-semibold text-[var(--accent-700)]"
						>
							Sedang memproses...
						</span>
					) : (
						<span
							role="status"
							className={`text-[10.5px] font-medium text-[var(--fg-muted)] sm:block ${remaining < 0 || remaining === 0 ? "font-semibold text-[var(--danger)]" : remaining < 200 ? "font-semibold text-[var(--warn)]" : "text-[var(--fg-faint)]"}`}
						>
							{remaining < 0 ? `${Math.abs(remaining)} karakter harus dihapus` : `${remaining} karakter tersisa`}
						</span>
					)}
				</div>
				<button
					type="button"
					aria-label="Kirim ide"
					onClick={onSubmit}
					disabled={!canSend}
					className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-600)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{busy ? (
						<Loader2
							className="size-3.5 animate-spin"
							aria-hidden="true"
						/>
					) : (
						<Send
							className="size-3.5"
							aria-hidden="true"
						/>
					)}
				</button>
			</div>
		</div>
	);
}

export function ComposerCard({ idea, onChange, onSubmit, busy }: { idea: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean }) {
	return (
		<div className="w-full max-w-3xl">
			<ComposerInner
				idea={idea}
				onChange={onChange}
				onSubmit={onSubmit}
				busy={busy}
				maxHeightClass="max-h-[160px] sm:max-h-[196px] lg:max-h-[200px]"
			/>
		</div>
	);
}

export function ComposerFixedBottom({ idea, onChange, onSubmit, busy }: { idea: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean }) {
	return (
		<div className="fixed inset-x-0 bottom-0 z-40 bg-[var(--bg)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/80">
			<div className="mx-auto w-full max-w-3xl px-3 pb-2 pt-2">
				<ComposerInner
					idea={idea}
					onChange={onChange}
					onSubmit={onSubmit}
					busy={busy}
					maxHeightClass="max-h-[104px] sm:max-h-[144px] lg:max-h-[160px]"
				/>
			</div>
		</div>
	);
}
