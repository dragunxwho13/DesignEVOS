# EVOS algorithms and formulas

## Scope

The backend engine in `backend/core/engine.mjs` implements a provider-neutral deterministic
baseline. It does not use AI/ML, external APIs, live telemetry, hardware control, V2G, or
fabricated datasets. Inputs are validated and all outputs are intended to remain explainable.

## Implemented formulas

| Formula | Implementation | Units / notes |
|---|---|---|
| Battery energy need | `max(0, (required - current) / 100 * capacity)` | kWh, battery-side |
| Wall energy need | `battery energy / efficiency` | kWh, efficiency applied once |
| Minimum charge time | `energy / feasible power` | hours/minutes; `null` when power is zero |
| `U` urgency | `1 - clamp(slackMinutes / 240, 0, 1)` | 0–1 |
| `N` shortfall | `clamp((required - current) / 100, 0, 1)` | 0–1 |
| `K` class weight | Critical `1.0`, Normal `0.6`, Low `0.3` | safe default Normal |
| `W` waiting | `clamp(waitingMinutes / 120, 0, 1)` | 0–1 |
| `S` stress | weighted high-SOC, temperature, C-rate, SOH and maintenance factors | 0–1, documented component weights in code |
| Priority | `0.35U + 0.20N + 0.20K + 0.15W - 0.10S` | explainable score |
| Confidence | `0.4D + 0.3F + 0.3M` | clamped 0–1 |
| Effective source cost | price + carbon weight + wear weight | normalized INR/kWh terms required |
| Cycle wear | `k * f_DoD * f_Temp * f_Crate` | simplified estimate, not electrochemical validation |
| SOH | `100 - (cycle wear + calendar wear)` | bounded 0–100 |

## Safety behavior

- SOC is validated to 0–100.
- Negative energy and power are rejected.
- Zero feasible charging power returns an infeasible/null time rather than dividing by zero.
- Charger allocation prevents duplicate charger assignments and respects vehicle/charger power.
- Energy dispatch keeps storage at or above reserve and reports balance error.
- Invalid/stale telemetry is excluded from safe fallback scheduling and creates an alert.
- No output claims a physical measurement, optimality, live source, or validated industrial battery diagnosis.

## Configurable defaults

Defaults are centralized in `backend/core/engine.mjs`: 80 kW grid limit, 100 kWh storage,
20% storage reserve, 50 kW storage power, 0.92 charger efficiency, carbon and wear weights,
telemetry age limits, and energy-balance tolerance. They are illustrative and must be moved
to validated configuration persistence before deployment.

## Tests

`backend/tests/engine.test.mjs` covers zero energy, zero-power feasibility, exact priority
components, negative slack, charger uniqueness/power limits, storage reserve, source balance,
wear/SOH/confidence/cost determinism, stale telemetry, invalid telemetry, and safe fallback.

## Not yet implemented

Persistent decision/audit records, HTTP routes, database transactions, source adapters,
scenario persistence, baseline evaluation persistence, import provenance storage, and RUL
estimation from sufficient history remain pending the runtime/database decision.
