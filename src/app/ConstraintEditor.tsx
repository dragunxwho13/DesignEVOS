import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Field, Segmented, Slider, inputCls, Status, Note } from "../components/ui";
import { VEHICLES, NOW, STEPS, fmtT, type Priority } from "../lib/sim";

/** Edits one vehicle's operator constraints. Changes go to shared state, so every view recalculates. */
export default function ConstraintEditor({ vehicleId, onDone }: { vehicleId: string; onDone?: () => void }) {
  const { sim, a, setOverride } = useStore();
  const base = VEHICLES.find((v) => v.id === vehicleId)!;
  const v = sim.vehicles.find((x) => x.id === vehicleId)!;
  const o = a.overrides[vehicleId] ?? {};
  const [priority, setPriority] = useState<Priority>(o.priority ?? "Normal");
  const [dep, setDep] = useState(o.departureStep ?? base.departure);
  const [target, setTarget] = useState(o.requiredSoC ?? base.requiredSoC);
  useEffect(() => { setPriority(o.priority ?? "Normal"); setDep(o.departureStep ?? base.departure); setTarget(o.requiredSoC ?? base.requiredSoC); }, [vehicleId, a.overrides]); // eslint-disable-line
  const err = target <= v.soc && v.readiness !== "Ready" ? undefined : undefined;
  const changed = priority !== (o.priority ?? "Normal") || dep !== (o.departureStep ?? base.departure) || target !== (o.requiredSoC ?? base.requiredSoC);
  const opts = Array.from({ length: (STEPS - NOW) / 2 }, (_, i) => NOW + 2 + i * 2);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><div className="font-semibold">{v.id}</div><div className="text-xs text-muted">{v.cls} · SoC {v.soc}%</div></div>
        <Status s={v.readiness} />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium" id={`pr-${vehicleId}`}>Operator priority</p>
        <Segmented label="Operator priority" value={priority} onChange={setPriority} options={[{ v: "High", label: "High" }, { v: "Normal", label: "Normal" }, { v: "Low", label: "Low" }]} />
        <p className="mt-1 text-xs text-muted">EVOS adds ±25 score points; rule-based schedules High first. FCFS ignores priority.</p>
      </div>
      <Field id={`dep-${vehicleId}`} label="Departure time" help={`Default ${fmtT(base.departure)}`}>
        <select id={`dep-${vehicleId}`} value={dep} onChange={(e) => setDep(Number(e.target.value))} className={inputCls}>
          {!opts.includes(dep) && <option value={dep}>{fmtT(dep)}</option>}
          {opts.map((t) => <option key={t} value={t}>{fmtT(t)}</option>)}
        </select>
      </Field>
      <Field id={`tg-${vehicleId}`} label="Required departure SoC" error={err} help={`Default ${base.requiredSoC}% · current ${v.soc}%`}>
        <Slider id={`tg-${vehicleId}`} value={target} min={40} max={100} step={5} onChange={setTarget} fmt={(x) => `${x}%`} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!changed} onClick={() => { setOverride(vehicleId, { priority, departureStep: dep, requiredSoC: target }); onDone?.(); }}>Apply and reschedule</Button>
        {a.overrides[vehicleId] && <Button variant="secondary" onClick={() => setOverride(vehicleId, null)}>Restore defaults</Button>}
      </div>
      {target <= v.soc && <Note title="Note">Target is at or below current SoC, so this vehicle will not request charge.</Note>}
    </div>
  );
}
