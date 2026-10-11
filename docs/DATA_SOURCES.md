# EVOS data sources and provenance

The frontend consumes the backend live-parameters route. NASA POWER/PVGIS values can update solar
inputs, configured tariff/carbon profiles can update those parameters, and ACN records are shown
as historical source evidence. ACN records are not falsely mapped to EVOS vehicle IDs without a
verified identity mapping. Connector tests use mocked responses, while local runtime verification
is performed against the configured upstream sources when credentials and network access exist.

| Source category | Official reference | Access treatment | Current status | Fallback/provenance |
|---|---|---|---|---|
| ACN-Data | https://ev.caltech.edu/dataset.html | Server-side historical connector using `ACN_DATA_API_KEY` and Basic auth | Implemented; connected when local env and upstream access are available | `current_api` on successful response; never fabricated |
| NASA POWER | https://power.larc.nasa.gov/docs/tutorials/api-getting-started/ | Server-side temporal point JSON connector with validated response boundary | Implemented; requires request coordinates/dates | labelled current API/historical according to source response |
| PVGIS | https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en | Server-side v5.3 `seriescalc` JSON connector | Implemented; requires request coordinates/system period | `modelled_api`/`cached`, not live meter data |
| NASA Li-ion aging | https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/ | Offline file import/parser after actual files are supplied | Import boundary not implemented | `imported`, with file/version/cell provenance |
| Indian electricity tariff | https://cea.nic.in/financial-studies-assistance-division/?lang=en | Official document/import/configuration; utility and effective date required | Source selection pending | `imported` or `illustrative`, never universal India-wide |
| Indian grid carbon | https://cea.nic.in/cdm-co2-baseline-database/?lang=en | Official factor import with methodology/geography/version | Source selection pending | `historical`/`imported`, not minute-by-minute live |

ElaadNL and Pecan Street are intentionally excluded from the active integration plan and removed
from the frontend catalogue.

## Required provenance fields

Normalized records should retain source name/category, external identifier where available,
observed/effective timestamp, fetched/imported timestamp, canonical unit, status
(`connected`, `cached`, `imported`, `stale`, `unconfigured`, `unavailable`, or `simulated`),
source/version/reference, validation status, and transformations.

## Credential handling

Any ACN credential must remain server-side in an environment variable selected after official
authentication verification. It must never be placed in `VITE_*`, browser code, logs, responses,
fixtures, or commits. Use `backend/.env.example` as the safe configuration template.
