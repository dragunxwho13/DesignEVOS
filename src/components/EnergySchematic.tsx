import type { StepFlow, Session } from "../lib/sim";
import { CHARGERS, fmtT } from "../lib/sim";
import { C, } from "./charts";

interface Props {
  f: StepFlow;
  assets?: { pvKWp: number; storageKWh: number; storageKW: number };
  sessions?: Session[];
  faultAC4?: boolean;
  dark?: boolean;
  compact?: boolean;
  onSelect?: (id: string) => void;
  selected?: string | null;
}

/** Technical 2D schematic: PV, grid, storage → site bus → chargers. Values come straight from the dispatch step. */
export default function EnergySchematic({ assets = { pvKWp: 100, storageKWh: 100, storageKW: 50 }, f, sessions = [], faultAC4, dark, compact, onSelect, selected }: Props) {
  const W = 760, H = compact ? 340 : 400;
  const bus = { x: 380, y: H / 2 };
  const fg = dark ? "#fff" : "#111827";
  const mut = dark ? "rgba(255,255,255,.55)" : "#526174";
  const nodeBg = dark ? "#111C2E" : "#fff";
  const stroke = dark ? "rgba(255,255,255,.14)" : "#D9E2EC";
  const active = sessions.filter((s) => s.start <= f.t && s.end > f.t);
  const byCharger = Object.fromEntries(active.map((s) => [s.chargerId, s]));

  const sources = [
    { id: "pv", label: "Rooftop PV", sub: `${assets.pvKWp} kWp`, x: 90, y: compact ? 70 : 80, kw: f.pvToLoad + f.pvToStorage, color: C.teal, val: `${f.pv.toFixed(1)} kW` },
    { id: "grid", label: "Grid import", sub: "limit applies", x: 90, y: H / 2, kw: f.grid, color: C.grid, val: `${f.grid.toFixed(1)} kW` },
    { id: "sto", label: "Stationary battery", sub: `${assets.storageKWh} kWh · ${assets.storageKW} kW`, x: 90, y: H - (compact ? 70 : 80), kw: f.storageToLoad, color: C.storage, val: `${f.storageSoC.toFixed(0)}% SoC` },
  ];
  const w = (kw: number) => Math.max(1.5, Math.min(9, 1.5 + kw / 9));
  const cy = (i: number) => 40 + i * ((H - 80) / 5);

  const node = (id: string, x: number, y: number, label: string, sub: string, val: string, color: string, wNode = 150) => (
    <g key={id} transform={`translate(${x - wNode / 2},${y - 28})`}
      onClick={onSelect ? () => onSelect(id) : undefined} onKeyDown={onSelect ? (e) => (e.key === "Enter" || e.key === " ") && onSelect(id) : undefined}
      role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? `${label}, ${val}` : undefined}
      style={{ cursor: onSelect ? "pointer" : undefined }}>
      <rect width={wNode} height={56} rx={10} fill={nodeBg} stroke={selected === id ? C.cyan : stroke} strokeWidth={selected === id ? 2 : 1} style={{ transition: "stroke 150ms" }} />
      <rect x={0} y={14} width={3} height={28} rx={1.5} fill={color} />
      <text x={14} y={22} fontSize={12} fontWeight={600} fill={fg}>{label}</text>
      <text x={14} y={38} fontSize={10.5} fill={mut}>{sub}</text>
      <text x={wNode - 10} y={22} fontSize={12} fontWeight={600} fill={fg} textAnchor="end" className="tnum">{val}</text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={`Schematic at ${fmtT(f.t)}: PV ${f.pv.toFixed(1)} kW, grid ${f.grid.toFixed(1)} kW, storage discharge ${f.storageToLoad.toFixed(1)} kW, storage charge ${f.pvToStorage.toFixed(1)} kW, charging ${f.charging.toFixed(1)} kW.`}>
      {/* source → bus */}
      {sources.map((s) => {
        const d = `M${s.x + 75},${s.y} C${s.x + 170},${s.y} ${bus.x - 120},${bus.y} ${bus.x - 46},${bus.y}`;
        return (
          <g key={s.id}>
            <path d={d} fill="none" stroke={stroke} strokeWidth={w(s.kw) + 2} strokeLinecap="round" />
            {s.kw > 0.3 && <path d={d} fill="none" stroke={s.color} strokeWidth={w(s.kw)} strokeLinecap="round" className="flow" />}
          </g>
        );
      })}
      {/* PV → storage charge path */}
      {f.pvToStorage > 0.3 && (
        <g>
          <path d={`M60,${sources[0].y + 28} L60,${sources[2].y - 28}`} stroke={C.teal} strokeWidth={w(f.pvToStorage)} className="flow" strokeLinecap="round" />
          <text x={52} y={H / 2 - 40} fontSize={10} fill={mut} textAnchor="end" transform={`rotate(-90 52 ${H / 2 - 40})`}>charging storage {f.pvToStorage.toFixed(1)} kW</text>
        </g>
      )}
      {/* bus */}
      <g>
        <rect x={bus.x - 46} y={bus.y - 46} width={92} height={92} rx={14} fill={dark ? "#0B1220" : "#F3F7FA"} stroke={C.cyan} strokeWidth={1.25} />
        <text x={bus.x} y={bus.y - 12} textAnchor="middle" fontSize={10.5} fill={mut}>Site bus</text>
        <text x={bus.x} y={bus.y + 8} textAnchor="middle" fontSize={17} fontWeight={700} fill={fg} className="tnum">{f.load.toFixed(0)}</text>
        <text x={bus.x} y={bus.y + 24} textAnchor="middle" fontSize={10.5} fill={mut}>kW demand</text>
      </g>
      <text x={bus.x} y={bus.y + 66} textAnchor="middle" fontSize={10} fill={mut}>base load {f.base.toFixed(0)} kW</text>
      {/* bus → chargers */}
      {CHARGERS.map((c, i) => {
        const s = byCharger[c.id];
        const fault = faultAC4 && c.id === "AC-4";
        const kw = s ? s.powerKW : 0;
        const y = cy(i);
        const d = `M${bus.x + 46},${bus.y} C${bus.x + 110},${bus.y} ${560 - 80},${y} ${560 - 52},${y}`;
        return (
          <g key={c.id}>
            <path d={d} fill="none" stroke={stroke} strokeWidth={w(kw) + 2} strokeLinecap="round" strokeDasharray={fault ? "3 4" : undefined} />
            {kw > 0 && <path d={d} fill="none" stroke={C.cyan} strokeWidth={w(kw)} className="flow" strokeLinecap="round" />}
            <g transform={`translate(508,${y - 20})`} onClick={onSelect ? () => onSelect(c.id) : undefined} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}
              onKeyDown={onSelect ? (e) => (e.key === "Enter" || e.key === " ") && onSelect(c.id) : undefined}
              aria-label={onSelect ? `${c.id} ${fault ? "fault" : s ? `charging ${s.vehicleId} at ${kw} kW` : "idle"}` : undefined} style={{ cursor: onSelect ? "pointer" : undefined }}>
              <rect width={236} height={40} rx={9} fill={nodeBg} stroke={selected === c.id ? C.cyan : fault ? C.err : stroke} strokeWidth={selected === c.id ? 2 : 1} />
              <text x={12} y={17} fontSize={11.5} fontWeight={600} fill={fg}>{c.id}</text>
              <text x={12} y={31} fontSize={10} fill={mut}>{c.type} · {c.maxKW} kW</text>
              <text x={224} y={17} fontSize={11.5} fontWeight={600} textAnchor="end" fill={fault ? C.err : fg}>{fault ? "▲ Fault" : s ? s.vehicleId : "Idle"}</text>
              <text x={224} y={31} fontSize={10} textAnchor="end" fill={mut} className="tnum">{fault ? "excluded" : s ? `${kw} kW · until ${fmtT(s.end)}` : "available"}</text>
            </g>
          </g>
        );
      })}
      {sources.map((s) => node(s.id, s.x, s.y, s.label, s.sub, s.val, s.color))}
    </svg>
  );
}
