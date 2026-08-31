# Blockers

Updated: 2026-08-31T03:30:00Z

## BLK-P0-001 Docker unavailable in WSL

Status: FAILED_CHECK
Gate: G01, G11
Evidence: Docker Desktop command reports that WSL integration is unavailable, `docker info` exits 1, and the proof-server health port refuses connections.
Next safe action: start Docker Desktop and enable integration for this WSL distribution, then rerun the bounded daemon and proof-server checks.

## BLK-P0-002 Cardano node unavailable

Status: FAILED_CHECK
Gate: G02
Evidence: the configured socket exists, but `cardano-cli query tip --testnet-magic 2` returns connection refused.
Next safe action: identify the installed node service and start it without deleting or replacing chain data, then verify two advancing tips.

## BLK-P0-003 Ogmios unavailable

Status: FAILED_CHECK
Gate: G03
Evidence: `http://127.0.0.1:1337/health` refuses connections.
Dependency: resolve BLK-P0-002, then start the compatible Ogmios service and compare tips.

## BLK-P0-004 Human compliance and wallet evidence

Status: BLOCKED_USER_ACTION
Gates: G00, G05, G06, G12, G15
Evidence missing: registration and check-in state, matching registration email confirmation, team and submission facts, wallet versions/networks, test funds, and wallet-controlled transactions.
Security boundary: never provide a mnemonic, seed, private key, token, `.env`, raw witness, or complete wallet/provider response.
Independent work continues on local gates, protocol decisions, hygiene, and CI.

## BLK-P0-005 Event submission window

Status: BLOCKED_EXTERNAL
Gate: G00 and P7
Evidence: the official Devpost and MLH pages report the August 28 to 30 event has ended as of the 2026-08-31 verification.
Impact: HACKATHON_PRODUCT_DONE can continue as an engineering target, but SUBMISSION_DONE cannot be claimed without authoritative accepted-submission evidence.
