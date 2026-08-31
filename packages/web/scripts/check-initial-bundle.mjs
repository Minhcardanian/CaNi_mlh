import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const compressedBudgetBytes = 500 * 1024;
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(packageRoot, "dist");
const manifest = JSON.parse(readFileSync(join(outputRoot, ".vite", "manifest.json"), "utf8"));
const entry = Object.values(manifest).find((chunk) => chunk.isEntry);

if (!entry) throw new Error("production bundle manifest has no application entry");

const files = new Set();
function collect(chunk) {
  if (!chunk || files.has(chunk.file)) return;
  files.add(chunk.file);
  for (const source of chunk.imports ?? []) collect(manifest[source]);
}
collect(entry);

const compressedBytes = [...files].reduce(
  (total, file) => total + gzipSync(readFileSync(join(outputRoot, file))).length,
  0,
);
console.log(JSON.stringify({ metric: "initial_javascript_gzip", compressedBytes, compressedBudgetBytes }));
if (compressedBytes > compressedBudgetBytes) {
  throw new Error(`initial compressed JavaScript ${compressedBytes} exceeds ${compressedBudgetBytes} bytes`);
}
