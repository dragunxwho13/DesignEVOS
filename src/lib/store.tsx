import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULTS, simulate, deriveAlerts, type Assumptions, type SimResult, type AlertItem, type VehicleOverride, type FaultId } from "./sim";

interface Store {
  a: Assumptions;
  setA: (a: Assumptions) => void;
  sim: SimResult;
  alerts: AlertItem[];
  acked: Set<string>;
  toggleAck: (id: string) => void;
  toast: (msg: string, undoable?: boolean) => void;
  toastMsg: string | null;
  canUndo: boolean;
  undo: () => void;
  /** Update assumptions and offer an undo in the toast. */
  change: (next: Assumptions, msg: string) => void;
  setOverride: (id: string, o: VehicleOverride | null) => void;
  toggleFault: (id: FaultId) => void;
  resetAll: () => void;
}
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [a, setAState] = useState<Assumptions>(() => {
    try {
      const s = sessionStorage.getItem("evos-a");
      return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS;
    } catch { return DEFAULTS; }
  });
  const [acked, setAcked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("evos-ack") || "[]")); } catch { return new Set(); }
  });
  const [toastMsg, setToast] = useState<string | null>(null);
  const [prev, setPrev] = useState<Assumptions | null>(null);
  const sim = useMemo(() => simulate(a), [a]);
  const alerts = useMemo(() => deriveAlerts(sim), [sim]);

  useEffect(() => { sessionStorage.setItem("evos-a", JSON.stringify(a)); }, [a]);
  useEffect(() => { sessionStorage.setItem("evos-ack", JSON.stringify([...acked])); }, [acked]);
  useEffect(() => {
    if (!toastMsg) return;
    const id = setTimeout(() => { setToast(null); setPrev(null); }, prev ? 6000 : 3200);
    return () => clearTimeout(id);
  }, [toastMsg, prev]);

  const value: Store = {
    a, setA: setAState, sim, alerts, acked,
    toggleAck: (id) => setAcked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }),
    toast: (m, undoable) => { if (!undoable) setPrev(null); setToast(m); }, toastMsg,
    canUndo: !!prev,
    undo: () => { if (prev) { setAState(prev); setPrev(null); setToast("Change undone"); } },
    change: (next, msg) => { setPrev(a); setAState(next); setToast(msg); },
    setOverride: (id, o) => {
      const ov = { ...a.overrides };
      if (o === null) delete ov[id]; else ov[id] = { ...ov[id], ...o };
      setPrev(a); setAState({ ...a, overrides: ov }); setToast(o === null ? `${id} restored to default constraints` : `${id} updated — schedule recalculated`);
    },
    toggleFault: (id) => {
      const f = a.faults.includes(id) ? a.faults.filter((x) => x !== id) : [...a.faults, id];
      setPrev(a); setAState({ ...a, faults: f }); setToast(f.includes(id) ? `Simulated fault injected: ${id}` : `Simulated fault cleared: ${id}`);
    },
    resetAll: () => { setPrev(a); setAState(DEFAULTS); setToast("Simulation reset to illustrative defaults"); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
