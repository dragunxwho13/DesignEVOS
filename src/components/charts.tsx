import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

export const C = { cyan: "#18B7C9", teal: "#2D9D90", grid: "#7B8A9E", storage: "#6C7BD9", warn: "#C58B35", err: "#B94A48", ink: "#111827", mint: "#9FDCD3" };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    setW(Math.max(240, ref.current.clientWidth));
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | undefined)[];
  kind: "area" | "line" | "dashed";
  stack?: boolean;
}
export interface Band { lo: (number | undefined)[]; hi: (number | undefined)[]; color: string; label: string }

export function TimeChart({
  series, band, xLabels, unit, height = 240, refLines = [], marker, title, summary, dark, yMax, fmtX,
}: {
  series: Series[]; band?: Band; xLabels: string[]; unit: string; height?: number;
  refLines?: { y: number; label: string; color: string }[]; marker?: { x: number; label: string };
  title: string; summary: string; dark?: boolean; yMax?: number; fmtX?: (i: number) => string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = xLabels.length;
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const stacked = useMemo(() => {
    const acc = new Array(n).fill(0);
    return series.map((s) => {
      if (!s.stack) return { s, top: s.values, bot: undefined as number[] | undefined };
      const bot = acc.slice();
      const top = s.values.map((v, i) => (acc[i] += v ?? 0));
      return { s, top, bot };
    });
  }, [series, n]);

  const maxV = yMax ?? niceMax(Math.max(1, ...stacked.flatMap((x) => x.top.map((v) => v ?? 0)), ...(band?.hi.map((v) => v ?? 0) ?? []), ...refLines.map((r) => r.y)));
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * iw;
  const y = (v: number) => pad.t + ih - (v / maxV) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxV);
  const every = Math.ceil(n / Math.max(3, Math.floor(iw / 70)));

  const pathOf = (vals: (number | undefined)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === undefined) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const areaOf = (top: (number | undefined)[], bot?: number[]) => {
    const idx = top.map((v, i) => (v === undefined ? -1 : i)).filter((i) => i >= 0);
    if (!idx.length) return "";
    const up = idx.map((i) => `${x(i).toFixed(1)},${y(top[i]!).toFixed(1)}`).join("L");
    const down = idx.slice().reverse().map((i) => `${x(i).toFixed(1)},${y(bot ? bot[i] : 0).toFixed(1)}`).join("L");
    return `M${up}L${down}Z`;
  };
  const bandPath = band ? areaOf(band.hi, band.lo.map((v) => v ?? 0)) : "";
  const axis = dark ? "rgba(255,255,255,.45)" : "#7B8A9E";
  const gridC = dark ? "rgba(255,255,255,.08)" : "#EDF1F5";

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - pad.l) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
  };

  return (
    <figure className="relative">
      <figcaption className="sr-only">{title}. {summary}</figcaption>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden>
        {series.map((s) => (
          <span key={s.key} className={cx("inline-flex items-center gap-1.5 text-xs", dark ? "text-white/70" : "text-muted")}>
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.kind === "dashed" ? `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)` : s.color, height: s.kind === "area" ? 8 : 2, opacity: s.kind === "area" ? 0.85 : 1 }} />
            {s.label}
          </span>
        ))}
        {band && <span className={cx("inline-flex items-center gap-1.5 text-xs", dark ? "text-white/70" : "text-muted")}><span className="inline-block h-2 w-4 rounded-sm" style={{ background: band.color, opacity: 0.25 }} />{band.label}</span>}
      </div>
      <div ref={ref} className="relative w-full min-w-0">
        <svg width={w} height={height} role="img" aria-label={`${title}. ${summary}`} tabIndex={0} onKeyDown={onKey}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)} className="chart-morph chart-reveal block touch-pan-y">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={gridC} />
              <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill={axis} className="tnum">{Math.round(t)}</text>
            </g>
          ))}
          <text x={pad.l - 8} y={pad.t - 2} textAnchor="end" fontSize={10} fill={axis}>{unit}</text>
          {xLabels.map((l, i) => i % every === 0 && (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={10.5} fill={axis} className="tnum">{l}</text>
          ))}
          {marker && (
            <g>
              <rect x={x(marker.x)} y={pad.t} width={Math.max(0, w - pad.r - x(marker.x))} height={ih} fill={dark ? "rgba(255,255,255,.025)" : "#F7FAFC"} />
              <line x1={x(marker.x)} x2={x(marker.x)} y1={pad.t} y2={pad.t + ih} stroke={axis} strokeDasharray="2 3" />
              <text x={x(marker.x) + 6} y={pad.t + 11} fontSize={10.5} fill={axis}>{marker.label}</text>
            </g>
          )}
          {band && <path d={bandPath} fill={band.color} opacity={0.16} className="fade-in" />}
          {stacked.map(({ s, top, bot }) => s.kind === "area" && (
            <path key={s.key} d={areaOf(top, bot)} fill={s.color} opacity={0.8} className="fade-in" style={{ transition: "d 300ms ease" }} />
          ))}
          {stacked.map(({ s, top }) => s.kind !== "area" && (
            <path key={s.key} d={pathOf(top)} fill="none" stroke={s.color} strokeWidth={s.kind === "dashed" ? 1.8 : 2} strokeDasharray={s.kind === "dashed" ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" style={{ transition: "d 300ms ease" }} />
          ))}
          {refLines.map((r) => (
            <g key={r.label}>
              <line x1={pad.l} x2={w - pad.r} y1={y(r.y)} y2={y(r.y)} stroke={r.color} strokeDasharray="6 4" strokeWidth={1.25} />
              <text x={w - pad.r} y={y(r.y) - 5} textAnchor="end" fontSize={10.5} fill={r.color} fontWeight={600}>{r.label}</text>
            </g>
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={dark ? "rgba(255,255,255,.4)" : "#9AA8B8"} />
              {stacked.map(({ s, top }) => top[hover] !== undefined && <circle key={s.key} cx={x(hover)} cy={y(top[hover]!)} r={3.5} fill={dark ? "#111C2E" : "#fff"} stroke={s.color} strokeWidth={2} />)}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className={cx("pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border px-3 py-2 text-xs shadow-lg transition-[left] duration-100 ease-out", dark ? "border-white/10 bg-deep2 text-white" : "border-line bg-white")}
            style={{ left: Math.min(Math.max(x(hover) + 12, 0), w - 180) }}>
            <div className="mb-1 font-semibold">{fmtX ? fmtX(hover) : xLabels[hover]}</div>
            {series.map((s) => s.values[hover] !== undefined && (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                <span className="tnum font-medium">{s.values[hover]!.toFixed(1)} {unit}</span>
              </div>
            ))}
            {band && band.lo[hover] !== undefined && <div className={cx("mt-1", dark ? "text-white/60" : "text-muted")}>Range {band.lo[hover]!.toFixed(1)}–{band.hi[hover]!.toFixed(1)} {unit}</div>}
          </div>
        )}
      </div>
    </figure>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

export function Donut({ parts, size = 148, center, label }: { parts: { label: string; value: number; color: string }[]; size?: number; center: ReactNode; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDF1F5" strokeWidth={12} />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = (
            <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={12}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: "stroke-dasharray 400ms ease, stroke-dashoffset 400ms ease" }} />
          );
          off += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
    </div>
  );
}

export function Legend({ items, dark }: { items: { label: string; color: string; value?: string }[]; dark?: boolean }) {
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center justify-between gap-6 text-sm">
          <span className={cx("inline-flex items-center gap-2", dark ? "text-white/75" : "text-muted")}><span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</span>
          {i.value && <span className={cx("tnum font-medium", dark ? "text-white" : "text-ink")}>{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export function Bars({ data, unit, height = 200, title, summary, highlight }: { data: { label: string; a: number; b?: number }[]; unit: string; height?: number; title: string; summary: string; highlight?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.a, d.b ?? 0])));
  const pad = { l: 40, b: 24, t: 10 };
  const ih = height - pad.b - pad.t;
  const bw = (w - pad.l) / data.length;
  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg width={w} height={height} role="img" aria-label={`${title}. ${summary}`} onPointerLeave={() => setHover(null)} className="chart-reveal">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={w} y1={pad.t + ih * (1 - f)} y2={pad.t + ih * (1 - f)} stroke="#EDF1F5" />
            <text x={pad.l - 8} y={pad.t + ih * (1 - f) + 3.5} fontSize={10.5} textAnchor="end" fill="#7B8A9E" className="tnum">{Math.round(max * f)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = pad.l + i * bw + bw * 0.18;
          const inner = bw * 0.64;
          const one = d.b !== undefined ? inner / 2 - 2 : inner;
          return (
            <g key={d.label} onPointerEnter={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.55} style={{ transition: "opacity 150ms" }}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={ih} fill="transparent" />
              {d.b !== undefined && <rect x={x0} y={pad.t + ih - (d.b / max) * ih} width={one} height={(d.b / max) * ih} rx={3} fill="#C9D3DF" style={{ transition: "all 300ms ease" }} />}
              <rect x={d.b !== undefined ? x0 + one + 4 : x0} y={pad.t + ih - (d.a / max) * ih} width={one} height={(d.a / max) * ih} rx={3} fill={highlight === i ? C.cyan : C.teal} style={{ transition: "all 300ms ease" }} />
              <text x={pad.l + i * bw + bw / 2} y={height - 7} fontSize={10.5} textAnchor="middle" fill={highlight === i ? "#111827" : "#7B8A9E"} fontWeight={highlight === i ? 600 : 400}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg fade-in" style={{ left: Math.min(pad.l + hover * bw + bw, w - 160) }}>
          <div className="font-semibold">{data[hover].label}</div>
          {data[hover].b !== undefined && <div className="tnum text-muted">Baseline {data[hover].b!.toFixed(0)} {unit}</div>}
          <div className="tnum">EVOS scenario {data[hover].a.toFixed(0)} {unit}</div>
        </div>
      )}
    </div>
  );
}
