import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const compressedBudgetBytes = 500 * 1024;
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(packageRoot, "dist");
const manifest = JSON.parse(readFileSync(join(outputRoot, ".vite", "manifest.json"), "utf8"));
const entries = Object.entries(manifest).filter(([, chunk]) => chunk.isEntry);
if (entries.length === 0) throw new Error("production bundle manifest has no application entry");

for (const [name, entry] of entries) {
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
  console.log(JSON.stringify({ metric: "initial_javascript_gzip", entry: name, compressedBytes, compressedBudgetBytes }));
  if (compressedBytes > compressedBudgetBytes) {
    throw new Error(`${name} initial compressed JavaScript ${compressedBytes} exceeds ${compressedBudgetBytes} bytes`);
  }
}
