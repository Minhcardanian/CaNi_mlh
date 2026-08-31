# NightPermit Midnight client

This package deploys or joins the fixed NightPermit Compact contract and submits one private reviewer approval. It validates every constructor byte width, the nonzero unsigned tranche bound, distinct reviewer commitments, and the local reviewer secret before any deployment or approval transaction.

Reviewer secrets are DApp private state; they do not come from the Lace connector. Joining reuses an existing account/contract-scoped private state without overwriting it, or accepts an explicitly provisioned 32-byte secret once after verifying its public commitment against the deployed ledger. Browser deployments must supply an encrypted private-state provider and a user/session storage secret that is never derived from public wallet data.

Approval results are derived from the exact finalized transaction state, not an unconstrained latest-state query. The public API returns only contract address, transaction identifier, block height, approval count, authorization status, and public commitments/nullifier. Private transaction objects and provider errors must never be logged or serialized.
