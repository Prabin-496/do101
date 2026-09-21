/**
 * Turns Google's libphonenumber geocoding and carrier resources into small
 * JSON files the browser can fetch one calling code at a time.
 *
 * The Phone Number Checker answers "which region issued this prefix" and
 * "which network was it allocated to" entirely on the visitor's device, so
 * the data has to reach the browser. Shipping all of it would be absurd —
 * the English geocoding set alone is ~7MB, most of it North American
 * exchange-level detail nobody looking up a Japanese number needs. Splitting
 * it by calling code means a +81 lookup fetches 33KB and a +1 lookup fetches
 * the one big file it actually needs.
 *
 * Source: libphonenumber-geo-carrier (MIT), which repackages the resource
 * files from Google's libphonenumber (Apache-2.0). Both licences are copied
 * into public/phone-data/ alongside the data, because Apache-2.0 requires the
 * licence to travel with redistributed material.
 *
 * That package pins libphonenumber-js to one exact version as a peer, which is
 * why package.json carries an `overrides` entry for it. Only the .bson files
 * under its resources/ directory are read here — none of its code is imported
 * and no version of it runs in the browser — so the pin has nothing to say
 * about which libphonenumber-js the site ships. Bump the override alongside
 * libphonenumber-js and nothing else needs touching.
 *
 * Re-run automatically before dev and build; the output is gitignored.
 */
import { deserialize } from "bson";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "node_modules/libphonenumber-geo-carrier");
const out = join(root, "public/phone-data");

/**
 * The BSON files map a national-number prefix to a description. Descriptions
 * repeat heavily — every New Jersey exchange carries the string "New Jersey" —
 * so the prefix table points at a deduplicated name list instead.
 */
function compact(bson) {
  const raw = deserialize(readFileSync(bson));
  const names = [];
  const index = new Map();
  const prefixes = {};

  for (const [prefix, name] of Object.entries(raw)) {
    if (typeof name !== "string" || !name) continue;
    let at = index.get(name);
    if (at === undefined) {
      at = names.length;
      names.push(name);
      index.set(name, at);
    }
    prefixes[prefix] = at;
  }

  return { names, prefixes };
}

function build(kind) {
  const from = join(pkg, "resources", kind, "en");
  const to = join(out, kind);
  mkdirSync(to, { recursive: true });

  const codes = [];
  let bytes = 0;

  for (const file of readdirSync(from)) {
    if (!file.endsWith(".bson")) continue;
    const code = file.slice(0, -".bson".length);
    const json = JSON.stringify(compact(join(from, file)));
    writeFileSync(join(to, `${code}.json`), json);
    codes.push(code);
    bytes += Buffer.byteLength(json);
  }

  codes.sort();
  return { codes, bytes };
}

if (!existsSync(join(pkg, "resources", "geocodes", "en"))) {
  // Better to stop than to build a page whose region and carrier cards can
  // only ever say "Unknown / not available".
  throw new Error(
    "libphonenumber-geo-carrier resources are missing. Run `npm install` before building.",
  );
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const geocodes = build("geocodes");
const carrier = build("carrier");

writeFileSync(
  join(out, "index.json"),
  JSON.stringify({ geocodes: geocodes.codes, carrier: carrier.codes }),
);

copyFileSync(
  join(root, "node_modules/libphonenumber-js/LICENSE.Apache"),
  join(out, "LICENSE.libphonenumber.txt"),
);

const geoCarrierVersion = JSON.parse(
  readFileSync(join(pkg, "package.json"), "utf8"),
).version;

writeFileSync(
  join(out, "NOTICE.txt"),
  [
    "DO101 Phone Number Checker — bundled numbering data",
    "",
    "The prefix tables in this directory are the geocoding and carrier-mapping",
    "resource files from Google's libphonenumber, repackaged by",
    `libphonenumber-geo-carrier ${geoCarrierVersion} (MIT) and converted here into`,
    "JSON split by country calling code. No values were added, removed or edited.",
    "",
    "libphonenumber — Copyright (C) The Libphonenumber Authors",
    "  https://github.com/google/libphonenumber",
    "  Licensed under the Apache License 2.0; see LICENSE.libphonenumber.txt.",
    "",
    "libphonenumber-geo-carrier — Copyright (c) Martin Mende",
    "  https://github.com/mmende/libphonenumber-geo-carrier",
    "  Licensed under the MIT License.",
    "",
    "Carrier names are the network a prefix range was originally allocated to.",
    "Number portability means the current network may differ. Region names",
    "describe where a prefix is issued, never where a phone is.",
    "",
  ].join("\n"),
);

const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(
  `Built public/phone-data: ${geocodes.codes.length} geocode files (${mb(geocodes.bytes)}MB), ` +
    `${carrier.codes.length} carrier files (${mb(carrier.bytes)}MB)`,
);
