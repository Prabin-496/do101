/**
 * Copies the kuromoji IPADIC dictionary into public/ so the browser can fetch it.
 *
 * The Japanese tools romanise text by looking words up, and a bundled word list
 * small enough to ship on every page load is nowhere near a real vocabulary —
 * business Japanese immediately falls outside it and comes out as "?" or as a
 * per-character guess. kuromoji carries the full IPADIC instead, which reads
 * 浅野 as asano rather than sen'ya.
 *
 * That dictionary is ~17MB of already-gzipped data, far too much to bundle or
 * to load on a page view. It is served as plain static files and fetched only
 * when a reader explicitly asks for accurate readings, so everyone else pays
 * nothing for it.
 *
 * Re-run automatically before dev and build; the output is gitignored.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/@sglkc/kuromoji/dict");
const to = join(root, "public/kuromoji/dict");

mkdirSync(to, { recursive: true });

let bytes = 0;
for (const name of readdirSync(from)) {
  if (!name.endsWith(".dat.gz")) continue;
  copyFileSync(join(from, name), join(to, name));
  bytes += statSync(join(from, name)).size;
}

console.log(
  `Copied kuromoji dictionary to public/kuromoji/dict (${(bytes / 1024 / 1024).toFixed(1)}MB)`,
);
