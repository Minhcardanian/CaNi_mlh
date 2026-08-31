import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { WebFlowError } from "./errors.js";
import { createProductBridge, productConfigFromEnvironment } from "./product-bridge.js";
import { createBrowserRuntime, relayUrl, type ProductBridge } from "./runtime.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("application root is missing");

function deploymentBridge(): ProductBridge | undefined {
  try {
    return createProductBridge(productConfigFromEnvironment(import.meta.env));
  } catch (error) {
    if (error instanceof WebFlowError && error.code === "NP_WEB_RUNTIME_NOT_CONFIGURED") return undefined;
    throw error;
  }
}

const runtime = createBrowserRuntime(
  relayUrl(import.meta.env.VITE_RELAY_URL ?? "http://127.0.0.1:8787"),
  deploymentBridge(),
);
createRoot(root).render(<StrictMode><App runtime={runtime} /></StrictMode>);
