"use client";

import { useState } from "react";
import { CornerDownLeft, Zap } from "lucide-react";
import type { ClarifyQuestion } from "@/lib/prd/types";

export function ClarifyCards({ questions, answers, onAnswer, onUseAll, onContinue, disabled }: { questions: ClarifyQuestion[]; answers: string[]; onAnswer: (idx: number, value: string) => void; onUseAll: () => void; onContinue: () => void; disabled: boolean }) {
	const [customChosen, setCustomChosen] = useState<Record<number, boolean>>({});
	const allAnswered = questions.every((_, qi) => answers[qi] && answers[qi].length > 0);
	const ROW_FOCUS = "focus-within:[outline:2px_solid_var(--accent-focus)] focus-within:[outline-offset:-2px]";
	return (
		<div className="flex flex-col gap-5">
			{questions.map((q, qi) => (
				<fieldset
					key={qi}
					className="flex min-w-0 flex-col gap-1.5"
				>
					<legend className="sr-only">
						Pertanyaan {qi + 1}: {q.q}
					</legend>
					<div className="flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
						<div className="p-3 flex flex-col items-start gap-1">
							<span className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">Pertanyaan {qi + 1}</span>
							<p className="text-[12px] font-medium leading-5">{q.q}</p>
						</div>
						{q.options.map((opt, oi) => {
							const selected = answers[qi] === opt;
							const recommended = opt === q.recommended;
							return (
								<label
									key={opt}
									className={`relative z-10 flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-[var(--dur-fast)] ${ROW_FOCUS} ${selected ? "bg-[var(--accent-soft)] shadow-[inset_0_0_0_1px_var(--accent)]" : "hover:bg-[var(--surface-hover)]"}`}
								>
									<input
										type="radio"
										name={`clarify-${qi}`}
										value={opt}
										checked={selected}
										onChange={() => {
											setCustomChosen((prev) => (prev[qi] ? { ...prev, [qi]: false } : prev));
											onAnswer(qi, opt);
										}}
										disabled={disabled}
										className="sr-only"
									/>
									<span
										className={`flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[12px] font-semibold tabular-nums ${selected ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--bg-subtle)] text-[var(--fg-muted)]"}`}
										aria-hidden="true"
									>
										{oi + 1}
									</span>
									<span className="flex min-w-0 flex-1 flex-col gap-0.5">
										{recommended && <span className="text-[9px] font-semibold tracking-wide text-[var(--accent-700)]">REKOMENDASI</span>}
										<span className={`text-[12px] leading-5 ${selected ? "font-medium" : ""}`}>{opt}</span>
									</span>
									{selected && (
										<CornerDownLeft
											className="size-3.5 shrink-0 text-[var(--accent)]"
											aria-hidden="true"
										/>
									)}
								</label>
							);
						})}
						{(() => {
							const answerIsPreset = q.options.includes(answers[qi] ?? "");
							const customVal = answerIsPreset ? "" : (answers[qi] ?? "");
							const customSelected = !answerIsPreset && customVal.length > 0;
							const customActive = !answerIsPreset && (customSelected || customChosen[qi] === true);
							return (
								<label className={`relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-[var(--dur-fast)] ${ROW_FOCUS} ${customActive ? "z-10 bg-[var(--accent-soft)] shadow-[inset_0_0_0_1px_var(--accent)]" : "hover:bg-[var(--surface-hover)]"}`}>
									<span
										className={`flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[12px] font-semibold tabular-nums ${customActive ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--bg-subtle)] text-[var(--fg-muted)]"}`}
										aria-hidden="true"
									>
										{q.options.length + 1}
									</span>
									<input
										type="text"
										value={customVal}
										onChange={(e) => onAnswer(qi, e.target.value)}
										onFocus={() => {
											setCustomChosen((prev) => (prev[qi] ? prev : { ...prev, [qi]: true }));
											if (q.options.includes(answers[qi] ?? "")) onAnswer(qi, "");
										}}
										disabled={disabled}
										placeholder="Lainnya, ketik disini..."
										aria-label={`Jawaban lain untuk pertanyaan ${qi + 1}`}
										autoComplete="off"
										spellCheck={false}
										style={{ outline: "none", border: "none", boxShadow: "none" }}
										className="w-full min-w-0 flex-1 border-none bg-transparent text-[12px] text-[var(--fg)] outline-none focus:border-none focus:outline-none focus:ring-0 placeholder:text-[var(--fg-faint)]"
									/>
								</label>
							);
						})()}
					</div>
				</fieldset>
			))}
			<div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
				<button
					type="button"
					onClick={onUseAll}
					disabled={disabled}
					className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-semibold text-[var(--on-accent)] shadow-sm transition-all duration-[var(--dur-fast)] hover:bg-[var(--accent-600)] active:scale-[0.98] disabled:opacity-50 sm:w-auto"
				>
					<Zap
						className="size-3.5"
						aria-hidden="true"
					/>
					Sesuai Rekomendasi Terbaik
				</button>
				<p
					id="clarify-continue-hint"
					className="sr-only"
				>
					Jawab semua pertanyaan dulu untuk melanjutkan.
				</p>
				<button
					type="button"
					onClick={onContinue}
					disabled={disabled || !allAnswered}
					aria-describedby={!allAnswered ? "clarify-continue-hint" : undefined}
					title={!allAnswered ? "Jawab semua pertanyaan dulu" : undefined}
					className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
				>
					Lanjutkan
				</button>
			</div>
		</div>
	);
}
