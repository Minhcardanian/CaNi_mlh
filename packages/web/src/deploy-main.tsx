import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DeployApp } from "./DeployApp.js";
import type { DeploymentRuntime } from "./deployment-runtime.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("application root is missing");

let runtime: Promise<DeploymentRuntime> | undefined;
function loadRuntime(): Promise<DeploymentRuntime> {
  return runtime ??= import("./deployment-runtime.js").then(({ createDeploymentRuntime }) => createDeploymentRuntime({
    validatorCompiledCode: import.meta.env.VITE_CARDANO_VALIDATOR_COMPILED_CODE ?? "",
    midnightArtifactBaseUrl: new URL(import.meta.env.VITE_MIDNIGHT_ARTIFACT_BASE_URL ?? "/", window.location.href),
    cardanoKupoUrl: import.meta.env.VITE_CARDANO_KUPO_URL ?? "http://127.0.0.1:1442",
    cardanoOgmiosUrl: import.meta.env.VITE_CARDANO_OGMIOS_URL ?? "http://127.0.0.1:1337",
    cardanoFallbackKupoUrl: import.meta.env.VITE_CARDANO_FALLBACK_KUPO_URL,
    cardanoFallbackOgmiosUrl: import.meta.env.VITE_CARDANO_FALLBACK_OGMIOS_URL,
    relayUrl: import.meta.env.VITE_RELAY_URL ?? "http://127.0.0.1:8787",
  }));
}

createRoot(root).render(<StrictMode><DeployApp loadRuntime={loadRuntime} /></StrictMode>);
