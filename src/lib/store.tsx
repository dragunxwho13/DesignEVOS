import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Context,
} from "react"
import {
  DEFAULTS,
  simulate,
  deriveAlerts,
  type Assumptions,
  type SimResult,
  type AlertItem,
  type VehicleOverride,
  type FaultId,
} from "./sim"
import { fetchLiveParameters, type LiveParameters } from "../services"

interface Store {
  a: Assumptions
  setA: (a: Assumptions) => void
  sim: SimResult
  live: LiveParameters | null
  liveError: string | null
  alerts: AlertItem[]
  acked: Set<string>
  toggleAck: (id: string) => void
  toast: (msg: string, undoable?: boolean) => void
  toastMsg: string | null
  canUndo: boolean
  undo: () => void
  /** Update assumptions and offer an undo in the toast. */
  change: (next: Assumptions, msg: string) => void
  setOverride: (id: string, o: VehicleOverride | null) => void
  toggleFault: (id: FaultId) => void
  resetAll: () => void
  addVehicle: (vehicle: import("./sim").VehicleSpec) => void
  removeVehicle: (id: string) => void
}
// Keep one context instance across hot-module reloads; otherwise an edited store module creates a
// new context and already-mounted consumers can no longer find the provider.
const g = globalThis as typeof globalThis & {
  __evosStoreCtx?: Context<Store | null>
}
const Ctx =
  g.__evosStoreCtx ?? (g.__evosStoreCtx = createContext<Store | null>(null))

export function StoreProvider({ children }: { children: ReactNode }) {
  const [a, setAStateRaw] = useState<Assumptions>(() => {
    try {
      const s = sessionStorage.getItem("evos-a")
      return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS
    } catch {
      return DEFAULTS
    }
  })
  const [acked, setAcked] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem("evos-ack") || "[]"))
    } catch {
      return new Set()
    }
  })
  // Recalculation is non-urgent: controls paint their new state immediately, results follow.
  const setAState = (n: Assumptions) => startTransition(() => setAStateRaw(n))
  const [toastMsg, setToast] = useState<string | null>(null)
  const [prev, setPrev] = useState<Assumptions | null>(null)
  const [live, setLive] = useState<LiveParameters | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const liveSolarMult = live?.parameters.solarMult
  const liveTariff = live?.parameters.tariffINR
  const liveCarbon = live?.parameters.carbonG
  const sim = useMemo(
    () =>
      simulate({
        ...a,
        ...(liveSolarMult === null || liveSolarMult === undefined
          ? {}
          : { solarMult: liveSolarMult }),
        ...(liveTariff === null || liveTariff === undefined
          ? {}
          : { tariffINR: liveTariff }),
        ...(liveCarbon === null || liveCarbon === undefined
          ? {}
          : { carbonG: liveCarbon }),
      }),
    [a, liveSolarMult, liveTariff, liveCarbon],
  )

  useEffect(() => {
    if (!import.meta.env.VITE_BACKEND_URL) return
    let active = true
    const refresh = async () => {
      try {
        const result = await fetchLiveParameters(a)
        if (active) {
          setLive(result)
          setLiveError(null)
        }
      } catch (error) {
        if (active)
          setLiveError(
            error instanceof Error ? error.message : "Live data unavailable",
          )
      }
    }
    void refresh()
    const id = window.setInterval(refresh, 60_000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [a.pvKWp])
  const alerts = useMemo(() => deriveAlerts(sim), [sim])

  useEffect(() => {
    sessionStorage.setItem("evos-a", JSON.stringify(a))
  }, [a])
  useEffect(() => {
    sessionStorage.setItem("evos-ack", JSON.stringify([...acked]))
  }, [acked])
  useEffect(() => {
    if (!toastMsg) return
    const id = setTimeout(
      () => {
        setToast(null)
        setPrev(null)
      },
      prev ? 6000 : 3200,
    )
    return () => clearTimeout(id)
  }, [toastMsg, prev])

  const value: Store = {
    a,
    setA: setAState,
    sim,
    live,
    liveError,
    alerts,
    acked,
    toggleAck: (id) =>
      setAcked((s) => {
        const n = new Set(s)
        n.has(id) ? n.delete(id) : n.add(id)
        return n
      }),
    toast: (m, undoable) => {
      if (!undoable) setPrev(null)
      setToast(m)
    },
    toastMsg,
    canUndo: !!prev,
    undo: () => {
      if (prev) {
        setAState(prev)
        setPrev(null)
        setToast("Change undone")
      }
    },
    change: (next, msg) => {
      setPrev(a)
      setAState(next)
      setToast(msg)
    },
    setOverride: (id, o) => {
      const ov = { ...a.overrides }
      if (o === null) delete ov[id]
      else ov[id] = { ...ov[id], ...o }
      setPrev(a)
      setAState({ ...a, overrides: ov })
      setToast(
        o === null
          ? `${id} restored to default constraints`
          : `${id} updated — schedule recalculated`,
      )
    },
    toggleFault: (id) => {
      const f = a.faults.includes(id)
        ? a.faults.filter((x) => x !== id)
        : [...a.faults, id]
      setPrev(a)
      setAState({ ...a, faults: f })
      setToast(
        f.includes(id)
          ? `Simulated fault injected: ${id}`
          : `Simulated fault cleared: ${id}`,
      )
    },
    resetAll: () => {
      setPrev(a)
      setAState(DEFAULTS)
      setToast("Simulation reset to illustrative defaults")
    },
    addVehicle: (vehicle) => {
      const customVehicles = [...(a.customVehicles ?? []).filter((v) => v.id !== vehicle.id), vehicle]
      setAState({ ...a, customVehicles })
      setToast(`${vehicle.id} added to the local vehicle registry`)
    },
    removeVehicle: (id) => {
      const removedVehicleIds = [...new Set([...(a.removedVehicleIds ?? []), id])]
      setAState({ ...a, removedVehicleIds })
      setToast(`${id} removed from the active vehicle registry`)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error("StoreProvider missing")
  return c
}
