import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toFlowError } from "./errors.js";
import type { AppRuntime } from "./runtime.js";
import { flowReducer, initialFlowState, type Operation } from "./state.js";

const operationStatus: Record<Operation, { title: string; boundary: string }> = {
  "connect-midnight": {
    title: "Waiting for Midnight wallet",
    boundary: "Wallet-controlled prompt; NightPermit does not retry it automatically.",
  },
  "connect-cardano": {
    title: "Waiting for Cardano wallet",
    boundary: "Wallet-controlled prompt; NightPermit does not retry it automatically.",
  },
  approve: {
    title: "Submitting private Midnight approval",
    boundary: "30-second public-state deadline; a timeout returns a retry-safe failure.",
  },
  permit: {
    title: "Verifying the relay permit",
    boundary: "5-second request deadline; no Cardano transaction is submitted.",
  },
  claim: {
    title: "Submitting the Cardano claim",
    boundary: "One wallet signature and one submission; confirmation is tracked separately.",
  },
};

function short(value: string | undefined): string {
  if (!value) return "Not available";
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className={ok ? "status status--ok" : "status"}>{children}</span>;
}

export function App({ runtime }: { runtime: AppRuntime }) {
  const [state, dispatch] = useReducer(flowReducer, initialFlowState);
  const errorRef = useRef<HTMLDivElement>(null);
  const [reviewerSecretHex, setReviewerSecretHex] = useState("");
  const [privateStoragePassword, setPrivateStoragePassword] = useState("");
  const [operationStartedAt, setOperationStartedAt] = useState(0);
  const [operationElapsedMs, setOperationElapsedMs] = useState(0);
  const busy = state.operation !== undefined;

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);

  useEffect(() => {
    if (!state.operation || operationStartedAt === 0) return;
    const updateElapsed = () => setOperationElapsedMs(Math.max(0, Date.now() - operationStartedAt));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(timer);
  }, [operationStartedAt, state.operation]);

  const run = async (operation: Operation, action: () => Promise<void>) => {
    setOperationStartedAt(Date.now());
    setOperationElapsedMs(0);
    dispatch({ type: "START", operation });
    try {
      await action();
    } catch (error) {
      dispatch({ type: "FAILED", error: toFlowError(error) });
    }
  };

  const stageNumber = state.stage === "connect" ? 1 : state.stage === "authorize" ? 2 : 3;
  const completion = useMemo(() => `${stageNumber} of 3`, [stageNumber]);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="NightPermit home">NightPermit</a>
        <div className="networks" aria-label="Active test networks">
          <span>Midnight Preprod</span><span aria-hidden="true">→</span><span>Cardano Preview</span>
        </div>
      </header>

      <section className="hero" id="top" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Private approval · public payout</p>
          <h1 id="page-title">Release one milestone.<br />Reveal only the permit.</h1>
        </div>
        <div className="progress" aria-label={`Stage ${completion}`}>
          <span>{completion}</span>
          <div><i style={{ width: `${stageNumber / 3 * 100}%` }} /></div>
        </div>
      </section>

      {state.error && (
        <div className="error" role="alert" tabIndex={-1} ref={errorRef}>
          <div><strong>{state.error.code}</strong><p>{state.error.message}</p><small>
            {state.error.retryable
              ? "No completion was recorded. You can safely retry this step."
              : "Review the wallet, deployment, or public configuration before trying again."}
          </small></div>
          <button type="button" onClick={() => dispatch({ type: "CLEAR_ERROR" })}>Dismiss</button>
        </div>
      )}

      {state.operation && (
        <div className="operation-status" role="status" aria-live="polite">
          <div><strong>{operationStatus[state.operation].title}</strong><small>{operationStatus[state.operation].boundary}</small></div>
          <span>{(operationElapsedMs / 1_000).toFixed(1)}s elapsed</span>
        </div>
      )}

      <section className="workspace" aria-live="polite">
        <nav className="stages" aria-label="Claim stages">
          {[
            [1, "Connect", "Confirm both test networks"],
            [2, "Authorize", "Two private reviewer approvals"],
            [3, "Claim", "Verify permit and submit payout"],
          ].map(([number, title, detail]) => (
            <div className={stageNumber === number ? "stage stage--active" : "stage"} key={String(number)}>
              <b>{number}</b><span><strong>{title}</strong><small>{detail}</small></span>
            </div>
          ))}
        </nav>

        <article className="task">
          {state.stage === "connect" && (
            <>
              <p className="step-label">Stage 1</p><h2>Connect the two sides</h2>
              <p className="lead">Wallet prompts always name the chain and action. No key or witness leaves your wallet.</p>
              <div className="wallet-row">
                <div><span>Midnight</span><strong>{state.midnightWallet?.name ?? "Not connected"}</strong><small>Required: Preprod</small></div>
                <button disabled={busy || Boolean(state.midnightWallet)} onClick={() => void run("connect-midnight", async () => {
                  dispatch({ type: "MIDNIGHT_CONNECTED", wallet: await runtime.connectMidnight() });
                })}>{state.midnightWallet ? "Connected" : "Connect Midnight"}</button>
              </div>
              <div className="wallet-row">
                <div><span>Cardano</span><strong>{state.cardanoWallet?.name ?? "Not connected"}</strong><small>Required: Preview</small></div>
                <button disabled={busy || Boolean(state.cardanoWallet)} onClick={() => void run("connect-cardano", async () => {
                  dispatch({ type: "CARDANO_CONNECTED", wallet: await runtime.connectCardano() });
                })}>{state.cardanoWallet ? "Connected" : "Connect Cardano"}</button>
              </div>
            </>
          )}

          {state.stage === "authorize" && (
            <>
              <p className="step-label">Stage 2</p><h2>Approve without publishing identity</h2>
              <p className="lead">The Compact circuit checks this reviewer locally. Public state records only threshold progress and a replay-safe nullifier.</p>
              <div className="reviewer-access">
                <label>Encrypted storage password <small>At least 16 characters and three character types</small><input
                  type="password"
                  autoComplete="off"
                  minLength={16}
                  value={privateStoragePassword}
                  onChange={(event) => setPrivateStoragePassword(event.target.value)}
                  required
                /></label>
                <label>Reviewer secret <small>64 lowercase hex characters; leave blank only after this reviewer was provisioned</small><input
                  type="password"
                  autoComplete="off"
                  inputMode="text"
                  value={reviewerSecretHex}
                  onChange={(event) => setReviewerSecretHex(event.target.value)}
                /></label>
                <p>This DApp state is not recoverable from the wallet. Keep the secret and password in an approved recovery channel. A second reviewer must use a separately provisioned identity.</p>
              </div>
              <div className="approval-count"><span>{state.approvalCount}</span><p><strong>of 2 approvals confirmed</strong><small>A different eligible reviewer must provide the second approval.</small></p></div>
              <button className="primary" disabled={busy || privateStoragePassword.length === 0} onClick={() => void run("approve", async () => {
                try {
                  const result = await runtime.approve(reviewerSecretHex
                    ? { privateStoragePassword, reviewerSecretHex }
                    : { privateStoragePassword });
                  dispatch({ type: "APPROVAL_CONFIRMED", ...result });
                } finally {
                  setReviewerSecretHex("");
                  setPrivateStoragePassword("");
                }
              })}>{busy ? "Waiting for Midnight…" : "Review and approve on Midnight"}</button>
            </>
          )}

          {state.stage === "claim" && (
            <>
              <p className="step-label">Stage 3</p><h2>Claim the exact tranche</h2>
              <p className="lead">The relay attests to confirmed Midnight state. Cardano still enforces beneficiary, amount, validity, and one-time use.</p>
              {!state.permit ? (
                <button className="primary" disabled={busy || !state.midnightTxId} onClick={() => void run("permit", async () => {
                  const result = await runtime.getPermit(state.midnightTxId!);
                  dispatch({ type: "PERMIT_RECEIVED", ...result });
                })}>{busy ? "Checking authorization…" : "Get signed permit"}</button>
              ) : !state.cardanoTxId ? (
                <button className="primary" disabled={busy} onClick={() => void run("claim", async () => {
                  const result = await runtime.claim(state.permit!);
                  dispatch({ type: "CLAIM_SUBMITTED", transactionId: result.transactionId });
                  await result.awaitConfirmation();
                  dispatch({ type: "CLAIM_CONFIRMED", transactionId: result.transactionId });
                })}>{busy ? "Waiting for Cardano…" : "Review and claim on Cardano"}</button>
              ) : <p className="pending">Submitted. Waiting for Preview confirmation…</p>}
            </>
          )}

          {state.stage === "complete" && (
            <>
              <p className="step-label">Complete</p><h2>Milestone paid once</h2>
              <p className="lead">Cardano Preview confirmed the claim. Reusing this permit nullifier will fail.</p>
              <Status ok>Confirmed on Cardano Preview</Status>
            </>
          )}
        </article>

        <aside className="evidence" aria-labelledby="evidence-title">
          <div><p className="step-label">Public evidence</p><h2 id="evidence-title">Protocol record</h2></div>
          <dl>
            <div><dt>Midnight wallet</dt><dd><Status ok={Boolean(state.midnightWallet)}>{state.midnightWallet ? "Preprod connected" : "Waiting"}</Status></dd></div>
            <div><dt>Cardano wallet</dt><dd><Status ok={Boolean(state.cardanoWallet)}>{state.cardanoWallet ? "Preview connected" : "Waiting"}</Status></dd></div>
            <div><dt>Threshold</dt><dd>{state.approvalCount} / 2</dd></div>
            <div><dt>Midnight transaction</dt><dd title={state.midnightTxId}>{short(state.midnightTxId)}</dd></div>
            <div><dt>Permit hash</dt><dd title={state.permit?.permitHash}>{short(state.permit?.permitHash)}</dd></div>
            <div><dt>Authorization nullifier</dt><dd title={state.nullifier}>{short(state.nullifier)}</dd></div>
            <div><dt>Relay signature</dt><dd>{state.relayVerified ? <Status ok>Verified</Status> : "Not verified"}</dd></div>
            <div><dt>Correlation ID</dt><dd title={state.correlationId}>{short(state.correlationId)}</dd></div>
            <div><dt>Cardano transaction</dt><dd title={state.cardanoTxId}>{short(state.cardanoTxId)}</dd></div>
            <div><dt>Final state</dt><dd><Status ok={state.confirmed}>{state.confirmed ? "Confirmed" : "Not confirmed"}</Status></dd></div>
          </dl>
          <p className="trust-note"><strong>Trust boundary</strong>The relay is a single testnet attestor. Cardano does not verify a Midnight proof directly.</p>
        </aside>
      </section>
    </main>
  );
}
