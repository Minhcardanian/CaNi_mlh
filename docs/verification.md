# NightPermit verification map

The Drive tracker is the authoritative status record. This source map identifies the test or evidence location for every MUST requirement; a mapping does not imply that its live gate has passed.

| Requirement | Primary verification location |
| --- | --- |
| FR-001, FR-002 | `packages/web/test/runtime.test.ts`, `packages/web/test/DeployApp.test.tsx` |
| FR-003, FR-004, FR-005, FR-006 | `packages/midnight-contract/src/test/nightpermit.test.ts`, `packages/midnight-client/test/policy.test.ts`, `packages/relay/test/config.test.ts` |
| FR-007, FR-008 | `packages/midnight-client/test/api.test.ts`, `packages/relay/test/service.test.ts` |
| FR-009, FR-010 | `packages/permit/test/crypto.test.ts`, `contracts/cardano/lib/nightpermit/permit_v1.test.ak` |
| FR-011, FR-012, FR-013, FR-014 | `packages/cardano-client/test/claim.test.ts`, `contracts/cardano/validators/nightpermit.test.ak` |
| FR-015, FR-016 | `packages/web/test/App.test.tsx`, `packages/web/test/state.test.ts` |
| PR-001, PR-005 | `packages/midnight-contract/src/test/nightpermit.test.ts`, `docs/protocol/permit-v1.md` |
| PR-002, PR-003 | `packages/relay/test/server.test.ts`, `packages/web/test/product-bridge.test.ts`, `infra/check-readiness.test.mjs` |
| PR-004 | `infra/compose.cardano-providers.yaml`, local proof-server listener evidence in the Drive tracker |
| PR-006 | `packages/web/src/App.tsx`, `packages/web/test/App.test.tsx` |
| SR-001, SR-002 | `.gitignore`, `.env.example`, `packages/relay/test/config.test.ts`, local staged hygiene evidence in the Drive tracker |
| SR-003, SR-004, SR-005, SR-006 | `packages/permit/test/codec.test.ts`, `packages/permit/test/golden-vectors.test.ts`, `docs/protocol/permit-v1.md` |
| SR-007 | `packages/relay/test/config.test.ts`, `packages/cardano-client/test/claim.test.ts`, `contracts/cardano/validators/nightpermit.test.ak` |
| SR-008, SR-009 | `packages/cardano-client/test/initialize.test.ts`, `contracts/cardano/validators/nightpermit.test.ak` |
| SR-010, SR-011 | `packages/relay/test/service.test.ts`, `packages/relay/test/server.test.ts` |
| OR-001 | `infra/check-readiness.test.mjs`, bounded live readiness/recovery reports recorded in the Drive tracker |
| OR-002 | `packages/relay/test/store.test.ts`, `packages/cardano-client/test/claim.test.ts` |
| OR-003 | `packages/relay/test/config.test.ts`, `packages/relay/test/ogmios.test.ts`, `infra/check-readiness.test.mjs` |
| OR-004 | `packages/web/test/App.test.tsx`, `packages/web/test/DeployApp.test.tsx` |
| OR-005 | `packages/relay/test/server.test.ts`, live E2E correlation record in the Drive tracker |
| OR-008 | Product CI plus the exact-SHA clean-clone evidence in the Drive tracker |
| UX-001, UX-002, UX-003, UX-004, UX-005, UX-006 | `packages/web/test/App.test.tsx`, `packages/web/test/DeployApp.test.tsx`, `packages/web/src/App.tsx`, live browser review in the Drive tracker |
| PF-002 | `packages/web/test/App.test.tsx`, `packages/web/test/state.test.ts`, `packages/relay/test/ogmios.test.ts`, `infra/check-readiness.test.mjs`, live timing evidence in the Drive tracker |
| PF-004 | Demo checklist and truthful staged/live evidence in the Drive tracker |
| HC-001 through HC-010 | External registration, repository, submission, and video evidence owned in validation gate G00 |
| DR-001 through DR-007 | `README.md`, `docs/architecture.md`, `docs/security/threat-model.md`, component READMEs, and this map |
| PF-006 | `packages/permit/test/codec.test.ts`, `packages/relay/test/performance.test.ts` |
| PF-011, PF-012 | `contracts/cardano/validators/nightpermit.test.ak` |
| PF-017 | Bundle before/after measurements, complete invariant suite, and optimization record in the Drive tracker |

Repository-wide verification is `npm run check`, `npm test`, `npm run build`, and `npm audit --omit=dev --audit-level=high` under the pinned toolchain. Generated build output, environments, execution notes, and assistant artifacts remain local and ignored.
