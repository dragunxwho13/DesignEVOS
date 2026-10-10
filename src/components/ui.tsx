import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "../lib/router";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "dark" | "onDark";
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-out active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none select-none whitespace-nowrap";
const btnVariants: Record<Variant, string> = {
  primary: "bg-cyan text-deep hover:bg-[#2cc8d9] shadow-[0_1px_0_rgba(255,255,255,.3)_inset]",
  secondary: "border border-line bg-white text-ink hover:border-[#b8c6d6] hover:bg-soft",
  ghost: "text-muted hover:text-ink hover:bg-soft",
  dark: "bg-deep text-white hover:bg-deep2",
  onDark: "border border-white/20 text-white hover:bg-white/10 hover:border-white/35",
};
const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-[15px]" };

export function Button({
  variant = "primary", size = "md", className, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={cx(btnBase, btnVariants[variant], sizes[size], className)} {...p} />;
}
export function ButtonLink({
  to, variant = "primary", size = "md", className, children,
}: { to: string; variant?: Variant; size?: keyof typeof sizes; className?: string; children: ReactNode }) {
  return <Link to={to} className={cx(btnBase, btnVariants[variant], sizes[size], className)}>{children}</Link>;
}

type Tone = "ok" | "warn" | "err" | "info" | "neutral" | "cyan";
const tones: Record<Tone, string> = {
  ok: "bg-[#e3f2ec] text-ok",
  warn: "bg-[#f8eedd] text-[#8a5f1f]",
  err: "bg-[#f6e3e2] text-err",
  info: "bg-[#e2f4f7] text-[#0d7584]",
  neutral: "bg-soft text-muted",
  cyan: "bg-mint text-[#1d6f66]",
};
export function Badge({ tone = "neutral", children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
export function SimBadge({ label = "Illustrative simulation", dark }: { label?: string; dark?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide", dark ? "border-white/15 text-white/70" : "border-line text-muted bg-white")}>
      <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />
      {label}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  Ready: "ok", Charging: "info", Scheduled: "neutral", "At risk": "err", Unavailable: "warn", Idle: "neutral",
  Critical: "err", Warning: "warn", Info: "info",
};
const statusGlyph: Record<string, string> = {
  Ready: "●", Charging: "◐", Scheduled: "○", "At risk": "▲", Unavailable: "■", Idle: "–", Critical: "▲", Warning: "◆", Info: "●",
};
export function Status({ s }: { s: string }) {
  return <Badge tone={statusTone[s] ?? "neutral"} icon={<span aria-hidden className="text-[9px] leading-none">{statusGlyph[s]}</span>}>{s}</Badge>;
}

export function Panel({ title, sub, right, children, className, pad = true }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("rounded-xl border border-line bg-white", className)}>
      {(title || right) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      <div className={cx(pad && "px-5 pb-5", !title && pad && "pt-5")}>{children}</div>
    </section>
  );
}

export function Metric({ label, value, unit, hint, tone, large }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; tone?: "ok" | "warn" | "err"; large?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={cx("tnum mt-1 font-semibold tracking-tight text-ink", large ? "text-4xl" : "text-2xl")}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </div>
      {hint && <div className={cx("mt-1 text-xs", tone === "err" ? "text-err" : tone === "warn" ? "text-[#8a5f1f]" : tone === "ok" ? "text-ok" : "text-muted")}>{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>({ value, onChange, options, label, dark }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[]; label: string; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ l: 0, w: 0 });
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (el) setInd({ l: el.offsetLeft, w: el.offsetWidth });
  }, [value, options.length]);
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={cx("relative inline-flex rounded-lg p-0.5", dark ? "bg-white/8" : "bg-soft border border-line")}>
      <span aria-hidden className={cx("absolute top-0.5 bottom-0.5 rounded-md shadow-sm transition-all duration-200 ease-out", dark ? "bg-white/15" : "bg-white")} style={{ left: ind.l, width: ind.w }} />
      {options.map((o) => (
        <button key={String(o.v)} role="radio" aria-checked={o.v === value} onClick={() => onChange(o.v)}
          className={cx("relative z-10 h-8 rounded-md px-3 text-xs font-medium transition-colors duration-150", o.v === value ? (dark ? "text-white" : "text-ink") : (dark ? "text-white/60 hover:text-white" : "text-muted hover:text-ink"))}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { v: T; label: string }[] }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.v} role="tab" aria-selected={t.v === value} onClick={() => onChange(t.v)}
          className={cx("relative h-10 px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150", t.v === value ? "text-ink" : "text-muted hover:text-ink")}>
          {t.label}
          <span aria-hidden className={cx("absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-cyan transition-transform duration-200 ease-out origin-center", t.v === value ? "scale-x-100" : "scale-x-0")} />
        </button>
      ))}
    </div>
  );
}

export function Field({ label, help, error, children, id }: { label: string; help?: string; error?: string; children: ReactNode; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
      <div className="mt-1.5">{children}</div>
      {error ? <p role="alert" className="mt-1 text-xs text-err">{error}</p> : help && <p className="mt-1 text-xs text-muted">{help}</p>}
    </div>
  );
}
export const inputCls = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink tnum transition-colors duration-150 hover:border-[#b8c6d6] focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/25 aria-[invalid=true]:border-err";

export function Slider({ id, value, min, max, step, onChange, fmt }: { id: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-cyan"
        style={{ background: `linear-gradient(to right, #18B7C9 ${pct}%, #D9E2EC ${pct}%)` }} />
      <span className="tnum w-20 text-right text-sm font-medium">{fmt(value)}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <button id={id} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200", checked ? "bg-cyan" : "bg-line")}>
      <span className={cx("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out", checked && "translate-x-5")} />
    </button>
  );
}

export function Note({ children, title = "Calculation note" }: { children: ReactNode; title?: string }) {
  return (
    <div className="rounded-lg bg-soft px-4 py-3 text-xs leading-relaxed text-muted">
      <span className="font-semibold text-ink">{title}. </span>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Adds the .in class when an element enters the viewport. Content is visible without JS. */
export function useRevealAll(dep?: unknown) {
  useEffect(() => {
    document.documentElement.classList.add("js");
    const els = document.querySelectorAll(".reveal:not(.in)");
    const io = new IntersectionObserver(
      (ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

// ---------- Progressive disclosure, provenance, data states ----------
import { ChevronDown, Info, X as XIcon, AlertTriangle, PlugZap, Loader2 } from "lucide-react";
import { PROVENANCE_LABEL, type Provenance, type LoadState } from "../data/contracts";

/** Accordion section. Open state persists per `id` for the session. */
export function Disclosure({ id, label, children, defaultOpen = false, className }: { id: string; label: string; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  const key = `evos-disc-${id}`;
  const [open, setOpen] = useState(() => { const v = sessionStorage.getItem(key); return v === null ? defaultOpen : v === "1"; });
  const toggle = () => setOpen((o) => { sessionStorage.setItem(key, o ? "0" : "1"); return !o; });
  return (
    <div className={cx("rounded-lg border border-line bg-white", className)}>
      <button type="button" aria-expanded={open} aria-controls={`${key}-p`} onClick={toggle}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-left text-sm font-medium text-ink transition-colors duration-150 hover:bg-soft/70">
        {label}
        <ChevronDown size={16} aria-hidden className={cx("shrink-0 text-muted transition-transform duration-200 ease-out", open && "rotate-180")} />
      </button>
      <div id={`${key}-p`} role="region" aria-label={label} className={cx("grid transition-[grid-template-rows] duration-220 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} hidden={!open && undefined}>
        <div className="overflow-hidden" inert={!open}>
          <div className="border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Click/tap/keyboard info popover — never hover-only. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button type="button" aria-label={`About ${label}`} aria-expanded={open} onClick={() => setOpen(!open)}
        className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-soft hover:text-ink"><Info size={13} /></button>
      {open && (
        <span role="dialog" aria-label={label} className="fade-in absolute top-7 left-1/2 z-30 w-64 -translate-x-1/2 rounded-lg border border-line bg-white p-3 text-left text-xs leading-relaxed font-normal text-muted shadow-lg">
          <span className="mb-1 block font-semibold text-ink">{label}</span>{children}
        </span>
      )}
    </span>
  );
}

const provTone: Record<Provenance, Tone> = { real: "ok", imported: "ok", calculated: "info", calibrated: "cyan", simulated: "warn", forecast: "cyan", demo: "neutral", "not-connected": "neutral" };
const provGlyph: Record<Provenance, string> = { real: "●", imported: "⬇", calculated: "=", calibrated: "≈", simulated: "◇", forecast: "↗", demo: "○", "not-connected": "×" };
export function ProvBadge({ p, className }: { p: Provenance; className?: string }) {
  return <Badge tone={provTone[p]} className={cx("tracking-wide uppercase text-[10.5px]", className)} icon={<span aria-hidden>{provGlyph[p]}</span>}>{PROVENANCE_LABEL[p]}</Badge>;
}

/** Renders the shared loading / error / not-connected / empty / partial / stale states. */
export function DataState<T>({ state, children, emptyTitle = "No records available", emptyAction }: { state: LoadState<T>; children: (d: T) => ReactNode; emptyTitle?: string; emptyAction?: ReactNode }) {
  if (state.status === "loading")
    return (
      <div role="status" aria-live="polite" className="space-y-2 p-5">
        <span className="sr-only">Loading…</span>
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-md bg-soft" style={{ animationDelay: `${i * 80}ms` }} />)}
      </div>
    );
  if (state.status === "error")
    return (
      <div role="alert" className="m-5 flex flex-wrap items-start gap-3 rounded-lg border border-err/30 bg-[#fbf1f0] p-4 text-sm">
        <AlertTriangle size={18} className="mt-0.5 text-err" aria-hidden />
        <div className="flex-1"><p className="font-medium text-ink">Could not load data</p><p className="mt-0.5 text-muted">{state.error}</p></div>
        {state.retry && <Button size="sm" variant="secondary" onClick={state.retry}>Try again</Button>}
      </div>
    );
  if (state.status === "not-connected")
    return (
      <div className="m-5 flex items-start gap-3 rounded-lg border border-dashed border-line p-4 text-sm">
        <PlugZap size={18} className="mt-0.5 text-muted" aria-hidden />
        <div><p className="font-medium text-ink">Not connected</p><p className="mt-0.5 text-muted">{state.message}</p></div>
      </div>
    );
  if (state.status === "empty") return <div className="p-5"><Empty title={emptyTitle}>{emptyAction}</Empty></div>;
  return (
    <>
      {(state.partial || state.stale) && (
        <p role="status" className="mx-5 mt-4 rounded-md bg-[#f8eedd] px-3 py-2 text-xs text-[#8a5f1f]">◆ {state.partial ?? state.stale}</p>
      )}
      {children(state.data)}
    </>
  );
}

/** Loads through a service with explicit states. Re-runs when `deps` change. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], isEmpty?: (d: T) => boolean): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    fn().then(
      (data) => live && setState(isEmpty?.(data) ? { status: "empty" } : { status: "ready", data }),
      (e: Error) => live && setState(e.name === "NotConnectedError" ? { status: "not-connected", message: e.message } : { status: "error", error: e.message, retry: () => setNonce((n) => n + 1) }),
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return state;
}

/** Side drawer with focus management, Escape to close and focus restore. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement;
    ref.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; (prev.current as HTMLElement | null)?.focus?.(); };
  }, [open, onClose]);
  return (
    <div className={cx("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div className={cx("absolute inset-0 bg-deep/40 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={cx("absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl outline-none transition-transform duration-250 ease-out", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close panel" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink"><XIcon size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{open && children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return <span role="status" className="inline-flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />{label}</span>;
}
