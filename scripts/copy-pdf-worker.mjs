/**
 * Copies the pdf.js worker into public/ so it can be loaded from a stable URL.
 *
 * pdf.js runs its parser in a Web Worker. Bundling that worker through the app
 * graph is brittle across bundler versions, so DO101 serves it as a plain
 * static asset instead. Re-run automatically before dev and build.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const to = join(root, "public/pdf.worker.min.mjs");

mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(from, to);
console.log("Copied pdf.js worker to public/pdf.worker.min.mjs");
