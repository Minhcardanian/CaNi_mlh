# NightPermit

NightPermit is a testnet-only hackathon project for private 2-of-2 milestone approval on Midnight Preprod and exact replay-safe payout enforcement on Cardano Preview.

The cross-chain MVP is relay-attested. Cardano does not directly verify Midnight consensus or a Compact proof, and this project is not a trustless bridge or a production escrow.

## Current status

The repository is in P0 readiness and provenance validation. Reusable application code starts only after the blocker infrastructure gates and protocol decisions are evidenced.

Current project state, safe evidence, and blockers are maintained in the authoritative Google Drive plan and tracker, outside Git.

## Repository safety

Never commit secrets, wallet material, private witnesses, environment values, node or proof state, personal data, `.codex`, `docs/execution/`, AI session artifacts, prompts, transcripts, scratchpads, or generated AI reports.

Copy `.env.example` to an ignored local environment file and add values only on the local machine. Do not paste those values into issues, logs, evidence, or commits.

Run the repository hygiene gate with:

```sh
scripts/check-hygiene.sh
```

The command requires Gitleaks on `PATH` or through `GITLEAKS_BIN` and scans the complete Git history when history exists.

## Source destination

The authorized public repository is <https://github.com/Minhcardanian/CaNi_mlh>.
