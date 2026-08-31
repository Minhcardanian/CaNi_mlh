# Evidence index

Evidence is concise, redacted, and limited to public identifiers and reproducible commands. Secrets, personal data, wallet material, private witnesses, environment values, `.codex`, and AI artifacts are excluded.

| Evidence ID | Gate or task | Timestamp UTC | Result | Command or source | Observed evidence |
| --- | --- | --- | --- | --- | --- |
| EV-P0-001 | Repository provenance | 2026-08-31T03:17:00Z | PASS | `gh repo view Minhcardanian/CaNi_mlh --json name,url,visibility,createdAt,defaultBranchRef,isEmpty` | Public, empty repository created 2026-08-31T03:03:37Z. |
| EV-P0-002 | Local Git destination | 2026-08-31T03:17:00Z | PASS | `git status --short --branch`; `git remote -v`; `git ls-remote --heads origin` | No local commits, authorized origin, and no remote heads. |
| EV-P0-003 | G01 host capacity | 2026-08-31T03:19:00Z | PARTIAL | Host and runtime version commands from gate G01 | Ubuntu 24.04.3 WSL2, 11 GiB RAM, 863 GiB free, Git 2.43.0, Node 22.13.1, npm 11.1.0, Bun 1.3.11. |
| EV-P0-004 | G01 Docker | 2026-08-31T03:19:00Z | FAIL | `docker --version`; `docker compose version`; `docker info` | Docker Desktop command reports WSL integration unavailable; daemon check exit 1. |
| EV-P0-005 | G02 Cardano node | 2026-08-31T03:19:00Z | FAIL | `cardano-node --version`; `cardano-cli --version`; socket test; `cardano-cli query tip --testnet-magic 2` | Node 11.0.1 and CLI 11.0.0.0 installed; socket is present but connection is refused. |
| EV-P0-006 | G03 Ogmios | 2026-08-31T03:19:00Z | FAIL | `curl` with bounded timeout to `http://127.0.0.1:1337/health` | Connection refused. |
| EV-P0-007 | G08 Midnight indexer | 2026-08-31T03:19:00Z | PARTIAL | `curl` with bounded timeout to the official Preprod readiness endpoint | HTTP 200. Remaining RPC and websocket checks are pending. |
| EV-P0-008 | G11 proof server | 2026-08-31T03:19:00Z | FAIL | `curl` with bounded timeout to `http://127.0.0.1:6300/health` | Connection refused. |
| EV-P0-009 | G09 compatibility source refresh | 2026-08-31T03:27:00Z | PASS | Official Midnight SDK compatibility matrix | Ledger-v8 and the documented 8.0.3, 0.30.0, 0.5.1, 0.22.0, and 4.0.4 baseline remain listed. |
| EV-P0-010 | G00 rule refresh | 2026-08-31T03:27:00Z | PARTIAL | Official Devpost and MLH event pages | Cross-Chain rules match the plan. Both pages report that the event ended; submission/account state remains human-controlled. |
| EV-P0-011 | G05 Aiken smoke | 2026-08-31T03:29:27Z | PASS | Disposable project: `aiken check`; `aiken build`; blueprint file check | Aiken 1.1.13 with stdlib 2.2.1 passed 1 of 1 unit tests and generated a 1,389-byte `plutus.json`. |
| EV-P0-012 | G16 repository hygiene | 2026-08-31T03:34:00Z | PASS | `GITLEAKS_BIN=/tmp/nightpermit-tools/gitleaks/gitleaks scripts/check-hygiene.sh` | HYG-001 through HYG-010 pass, including full history and current-tree secret scans plus the `.codex` and AI-artifact guard. |
| EV-P0-013 | G21 CI baseline | 2026-08-31T03:35:00Z | PASS | GitHub Actions run 33354274816 | Hygiene workflow passed for exact commit `bda20d55edb4cdd850fc6a89abd523ac8c1b9998`. |

Transaction, contract, validator, wallet, and public-network evidence is not yet available and is not claimed.
