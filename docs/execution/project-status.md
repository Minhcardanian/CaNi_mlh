# Project status

Updated: 2026-08-31T03:30:00Z
Terminal target: HACKATHON_PRODUCT_DONE
Current phase: P0 readiness and provenance
Current item: P0-09 repository hygiene and CI baseline
Status: IN_PROGRESS

## Grounded state

- Authorized source: `https://github.com/Minhcardanian/CaNi_mlh`.
- GitHub reports the repository is public, empty, and created on 2026-08-31T03:03:37Z.
- The local checkout has no commits and `origin` targets the authorized repository.
- The Drive execution plan is version 0.5.0 and the completion loop is version 0.4.0.
- `.codex` and all AI session, prompt, transcript, scratchpad, and generated-report artifacts are prohibited from commits.
- No reusable feature code exists. P0 blocker gates remain incomplete.

## P0 status

| Task | Status | Current evidence | Next action |
| --- | --- | --- | --- |
| P0-01 compliance and provenance | BLOCKED_USER_ACTION | Public new repository and current rules verified. Registration, team, one-submission, and account facts are not independently visible. | Batch human confirmation after independent P0 work. |
| P0-02 host and Cardano checks | FAILED_CHECK | Host capacity and CLIs are present. Docker integration fails. Cardano socket refuses connections. | Restore Docker and Cardano node health. |
| P0-03 Ogmios health | FAILED_CHECK | `127.0.0.1:1337` refused connection. | Start the compatible Ogmios service after node recovery. |
| P0-04 Aiken smoke test | PASS | Aiken 1.1.13 with stdlib 2.2.1 passed one unit test and produced `plutus.json` in a disposable project. | Preserve the compatible pair when the Cardano contract boundary is scaffolded. |
| P0-05 Preview wallet and transaction | BLOCKED_USER_ACTION | No safe wallet evidence yet. | Batch wallet and funds confirmation. |
| P0-06 Midnight compatibility freeze | IN_PROGRESS | Official matrix still lists ledger-v8, proof server 8.0.3, Compact compiler 0.30.0, toolchain 0.5.1, language 0.22.0, and Midnight.js 4.0.4. Local `compact` reports 0.3.0 and requires resolution. | Verify the intended Compact command/toolchain and official example. |
| P0-07 upstream Midnight E2E | PENDING | Preprod indexer readiness returned HTTP 200. | Restore Docker, run official proof example, then perform wallet-controlled E2E. |
| P0-08 dual wallets | BLOCKED_USER_ACTION | Browser extensions and accounts are not inspectable from CLI. | Batch browser wallet confirmation. |
| P0-09 hygiene and CI baseline | IN_PROGRESS | Baseline files and checks are being created. | Validate locally, commit, push, and verify CI. |
| P0-10 tracker evidence | IN_PROGRESS | Drive workbook is grounded. | Write only verified results and preserve formatting. |

Industrial readiness and optional integrations remain outside the active MVP path.
