import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { createBrowserRuntime, relayUrl } from "./runtime.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("application root is missing");

const runtime = createBrowserRuntime(relayUrl(import.meta.env.VITE_RELAY_URL ?? "http://127.0.0.1:8787"));
createRoot(root).render(<StrictMode><App runtime={runtime} /></StrictMode>);
