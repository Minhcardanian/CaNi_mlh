import { useRef, useState } from "react";
import { toFlowError } from "./errors.js";
import { parsePublicPolicy, policyTemplate } from "./deployment-input.js";
import type {
  DeploymentArtifacts,
  DeploymentRuntime,
  InitializationCandidate,
} from "./deployment-runtime.js";
import type { PublicWallet } from "./state.js";

type Stage = "connect" | "prepare" | "midnight" | "cardano" | "complete";

function short(value: string): string {
  return value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

function PublicJson({ label, value }: { label: string; value: unknown }) {
  return <section className="public-output"><h3>{label}</h3><pre>{JSON.stringify(value, null, 2)}</pre></section>;
}

export function DeployApp({ loadRuntime }: { loadRuntime(): Promise<DeploymentRuntime> }) {
  const runtimeRef = useRef<DeploymentRuntime | undefined>(undefined);
  const [stage, setStage] = useState<Stage>("connect");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof toFlowError>>();
  const [midnightWallet, setMidnightWallet] = useState<PublicWallet>();
  const [cardanoWallet, setCardanoWallet] = useState<PublicWallet>();
  const [candidates, setCandidates] = useState<InitializationCandidate[]>([]);
  const [selectedRef, setSelectedRef] = useState("");
  const [policy, setPolicy] = useState(policyTemplate);
  const [prepared, setPrepared] = useState<{ validatorHash: string; validatorAddress: string }>();
  const [privateStoragePassword, setPrivateStoragePassword] = useState("");
  const [reviewerSecretHex, setReviewerSecretHex] = useState("");
  const [midnightTransaction, setMidnightTransaction] = useState("");
  const [initialLovelace, setInitialLovelace] = useState("5000000");
  const [cardanoTransaction, setCardanoTransaction] = useState("");
  const [artifacts, setArtifacts] = useState<DeploymentArtifacts>();

  const runtime = async () => runtimeRef.current ??= await loadRuntime();
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(toFlowError(cause));
    } finally {
      setBusy(false);
    }
  };
  const selected = candidates.find(({ txHash, outputIndex }) => `${txHash}#${outputIndex}` === selectedRef);

  return <main>
    <header className="topbar">
      <a className="brand" href="/">NightPermit</a>
      <div className="networks"><span>Deployment ceremony</span><span>Preprod → Preview</span></div>
    </header>
    <section className="hero">
      <div><p className="eyebrow">Public configuration · wallet custody</p><h1>Bind both chains.<br />Publish one policy.</h1></div>
      <p className="ceremony-note">This page prepares public identifiers and asks wallet extensions to sign. It never writes seed phrases, signing keys, or reviewer credentials to an artifact.</p>
    </section>
    {error && <div className="error" role="alert"><div><strong>{error.code}</strong><p>{error.message}</p></div><button onClick={() => setError(undefined)}>Dismiss</button></div>}
    <section className="ceremony">
      <nav className="ceremony-steps" aria-label="Deployment steps">
        {(["connect", "prepare", "midnight", "cardano", "complete"] as const).map((name, index) =>
          <span key={name} className={stage === name ? "active" : ""}>{index + 1}. {name}</span>)}
      </nav>

      {stage === "connect" && <article className="ceremony-panel">
        <p className="step-label">Step 1</p><h2>Connect deployment wallets</h2>
        <p className="lead">Use Midnight Preprod and Cardano Preview wallets controlled by the deployment operator.</p>
        <div className="wallet-row"><div><span>Midnight</span><strong>{midnightWallet?.name ?? "Not connected"}</strong><small>Preprod required</small></div><button disabled={busy || Boolean(midnightWallet)} onClick={() => void run(async () => setMidnightWallet(await (await runtime()).connectMidnight()))}>{midnightWallet ? "Connected" : "Connect Midnight"}</button></div>
        <div className="wallet-row"><div><span>Cardano</span><strong>{cardanoWallet?.name ?? "Not connected"}</strong><small>Preview required</small></div><button disabled={busy || Boolean(cardanoWallet)} onClick={() => void run(async () => {
          const active = await runtime();
          setCardanoWallet(await active.connectCardano());
          const available = await active.initializationCandidates();
          setCandidates(available);
          if (available[0]) setSelectedRef(`${available[0].txHash}#${available[0].outputIndex}`);
        })}>{cardanoWallet ? "Connected" : "Connect Cardano"}</button></div>
        <button className="primary" disabled={busy || !midnightWallet || !cardanoWallet || candidates.length === 0} onClick={() => setStage("prepare")}>Review public policy</button>
      </article>}

      {stage === "prepare" && <article className="ceremony-panel">
        <p className="step-label">Step 2</p><h2>Prepare the cross-chain binding</h2>
        <p className="lead">All values below are public protocol identifiers. The selected Preview output makes the validator instance unique.</p>
        <label className="field">Public policy JSON<textarea rows={18} spellCheck={false} value={policy} onChange={(event) => setPolicy(event.target.value)} /></label>
        <label className="field">Initialization output<select value={selectedRef} onChange={(event) => setSelectedRef(event.target.value)}>{candidates.map((candidate) => {
          const value = `${candidate.txHash}#${candidate.outputIndex}`;
          return <option key={value} value={value}>{short(candidate.txHash)}#{candidate.outputIndex} · {candidate.lovelace} lovelace · {candidate.assetCount} assets</option>;
        })}</select></label>
        <button className="primary" disabled={busy || !selected} onClick={() => void run(async () => {
          if (!selected) return;
          setPrepared(await (await runtime()).prepare(parsePublicPolicy(policy), selected));
          setStage("midnight");
        })}>Validate and prepare</button>
      </article>}

      {stage === "midnight" && prepared && <article className="ceremony-panel">
        <p className="step-label">Step 3</p><h2>Deploy the private approval contract</h2>
        <dl className="review-record"><div><dt>Cardano validator hash</dt><dd>{prepared.validatorHash}</dd></div><div><dt>Preview address</dt><dd>{prepared.validatorAddress}</dd></div></dl>
        <div className="reviewer-access">
          <label>Encrypted storage password<input type="password" autoComplete="off" value={privateStoragePassword} onChange={(event) => setPrivateStoragePassword(event.target.value)} /></label>
          <label>Deploying reviewer secret<input type="password" autoComplete="off" value={reviewerSecretHex} onChange={(event) => setReviewerSecretHex(event.target.value)} /></label>
          <p>These credentials remain in memory only for this operation and are cleared after the wallet request.</p>
        </div>
        <button className="primary" disabled={busy || !privateStoragePassword || !reviewerSecretHex} onClick={() => void run(async () => {
          try {
            const result = await (await runtime()).deployMidnight({ privateStoragePassword, reviewerSecretHex });
            setMidnightTransaction(result.transactionId);
            setStage("cardano");
          } finally {
            setPrivateStoragePassword("");
            setReviewerSecretHex("");
          }
        })}>Deploy with Midnight wallet</button>
      </article>}

      {stage === "cardano" && <article className="ceremony-panel">
        <p className="step-label">Step 4</p><h2>Initialize the public escrow state</h2>
        <p className="lead">Midnight deployment confirmed. The Preview transaction locks the configured tranche with the zero-sequence state token.</p>
        <dl className="review-record"><div><dt>Midnight transaction</dt><dd>{midnightTransaction}</dd></div></dl>
        <label className="field">State output lovelace<input inputMode="numeric" value={initialLovelace} onChange={(event) => setInitialLovelace(event.target.value)} /></label>
        <button className="primary" disabled={busy || !/^[1-9][0-9]*$/.test(initialLovelace)} onClick={() => void run(async () => {
          const active = await runtime();
          const result = await active.initializeCardano(BigInt(initialLovelace));
          setCardanoTransaction(result.transactionId);
          await result.awaitConfirmation();
          setArtifacts(await active.artifacts());
          setStage("complete");
        })}>{busy ? "Waiting for Preview confirmation…" : "Initialize with Cardano wallet"}</button>
      </article>}

      {stage === "complete" && artifacts && <article className="ceremony-panel">
        <p className="step-label">Complete</p><h2>Deployment confirmed on both chains</h2>
        <dl className="review-record"><div><dt>Midnight transaction</dt><dd>{midnightTransaction}</dd></div><div><dt>Cardano transaction</dt><dd>{cardanoTransaction}</dd></div></dl>
        <p className="lead">Copy these public values into controlled deployment configuration. They contain no private key or reviewer secret.</p>
        <PublicJson label="Browser environment" value={artifacts.browserEnvironment} />
        <PublicJson label="Relay environment" value={artifacts.relayEnvironment} />
        <PublicJson label="Relay policy" value={artifacts.relayPolicy} />
      </article>}
    </section>
  </main>;
}
