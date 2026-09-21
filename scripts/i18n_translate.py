#!/usr/bin/env python3
"""Fills in the translation dictionaries, free and offline.

Reads the strings scripts/i18n-harvest.mjs collected and writes one JSON file
per language into src/lib/i18n/dictionaries/. Those files are checked in, so
the live site never translates anything at runtime: no API, no key, no server,
no per-visit cost. This script is the whole cost, it runs on a developer's
machine, and it runs once.

Engines
-------
argos   Argos Translate. Open source (MIT), models under a permissive licence,
        runs entirely on this machine after a one-off model download. No rate
        limit, no account, no network once the models are in place. The
        default, and the only engine used for the ten languages it covers.
google  The public translate.googleapis.com endpoint that Google's own web
        widget uses. Free and noticeably more fluent, but unofficial and
        rate-limited, so requests are throttled and backed off. Used
        automatically for Nepali, which Argos has no model for, and available
        for the rest with --engine google.

One-time setup
--------------
    python3 -m venv .venv-i18n
    .venv-i18n/bin/pip install argostranslate
    .venv-i18n/bin/python scripts/i18n_translate.py

Usage
-----
    ... i18n_translate.py                    # every language
    ... i18n_translate.py --locale ja        # one language
    ... i18n_translate.py --limit 50         # a quick look at the output
    ... i18n_translate.py --engine google    # fluency over independence
    ... i18n_translate.py --locale ja --force  # redo a language from scratch

The run is restartable. Every language's file is rewritten as translations
arrive, and a string that already has one is never translated again, so
stopping this with Ctrl-C and starting it again loses nothing.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_FILE = ROOT / "scripts" / "i18n" / "source-strings.json"
DICT_DIR = ROOT / "src" / "lib" / "i18n" / "dictionaries"

# Mirrors LOCALES in src/lib/i18n/locales.ts, minus English. tests/
# page-translation.test.ts fails if a language here has no dictionary file.
TARGETS = [
    ("ja", "Japanese"),
    ("es", "Spanish"),
    ("fr", "French"),
    ("de", "German"),
    ("pt", "Portuguese"),
    ("hi", "Hindi"),
    ("ne", "Nepali"),
    ("zh", "Chinese"),
    ("ko", "Korean"),
    ("id", "Indonesian"),
    ("ar", "Arabic"),
]

# Argos publishes no English-to-Nepali model, so Nepali uses the web engine.
NO_ARGOS_MODEL = {"ne"}

# Argos and Google disagree with locales.ts on two codes.
ARGOS_CODE = {"zh": "zh"}
GOOGLE_CODE = {"zh": "zh-CN"}

# Left exactly as they are: translating them makes the string wrong, not
# foreign. A string that is nothing but one of these is skipped outright.
PROTECTED = {
    "DO101", "PDF", "JSON", "CSV", "TSV", "YAML", "XML", "HTML", "CSS", "SQL",
    "JWT", "URL", "URI", "QR", "SEO", "AI", "OCR", "GPS", "RGB", "HEX", "HSL",
    "JPG", "JPEG", "PNG", "WebP", "HEIC", "SVG", "GIF", "BMP", "ICO", "MP4",
    "DOCX", "XLSX", "PPTX", "TXT", "MD", "ZIP", "Base64", "UUID", "MB", "KB",
    "GB", "DPI", "wpm", "API", "UTF-8", "ASCII", "CLI", "HTTP", "HTTPS",
}


def log(message: str = "") -> None:
    print(message, flush=True)


# --------------------------------- engines ---------------------------------


class ArgosEngine:
    """Local neural translation. Downloads a model per language, then runs offline."""

    name = "argos"

    def __init__(self) -> None:
        try:
            import argostranslate.package as package
            import argostranslate.translate as translate
        except ImportError:
            sys.exit(
                "argostranslate is not installed.\n"
                "    python3 -m venv .venv-i18n\n"
                "    .venv-i18n/bin/pip install argostranslate\n"
                "    .venv-i18n/bin/python scripts/i18n_translate.py"
            )
        self._package = package
        self._translate = translate
        self._index_loaded = False
        self._ready: set[str] = set()

    def supports(self, code: str) -> bool:
        return code not in NO_ARGOS_MODEL

    def prepare(self, code: str) -> bool:
        """Installs the English-to-`code` model if it is not already present."""
        target = ARGOS_CODE.get(code, code)
        if target in self._ready:
            return True

        installed = {
            (p.from_code, p.to_code) for p in self._package.get_installed_packages()
        }
        if ("en", target) not in installed:
            if not self._index_loaded:
                log("  fetching the Argos model index…")
                self._package.update_package_index()
                self._index_loaded = True
            available = [
                p
                for p in self._package.get_available_packages()
                if p.from_code == "en" and p.to_code == target
            ]
            if not available:
                return False
            log(f"  downloading the English → {target} model (one time)…")
            self._package.install_from_path(available[0].download())

        self._ready.add(target)
        return True

    def translate(self, text: str, code: str) -> str | None:
        target = ARGOS_CODE.get(code, code)
        try:
            return self._translate.translate(text, "en", target)
        except Exception:
            return None


class GoogleEngine:
    """The free endpoint behind Google's website widget. Throttled on purpose."""

    name = "google"

    def __init__(self, delay: float = 0.35) -> None:
        self.delay = delay
        self._last = 0.0

    def supports(self, code: str) -> bool:
        return True

    def prepare(self, code: str) -> bool:
        return True

    def translate(self, text: str, code: str) -> str | None:
        target = GOOGLE_CODE.get(code, code)
        params = urllib.parse.urlencode(
            {"client": "gtx", "sl": "en", "tl": target, "dt": "t", "q": text}
        )
        url = f"https://translate.googleapis.com/translate_a/single?{params}"

        for attempt in range(6):
            wait = self.delay - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()

            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                return "".join(part[0] for part in payload[0] if part[0])
            except Exception as err:
                status = getattr(err, "code", None)
                if status == 429 or status is None or status >= 500:
                    # Being told to slow down is the normal case here, not a
                    # failure: back off hard and keep the pace slower after.
                    time.sleep(min(60, 2 ** attempt) + random.random())
                    self.delay = min(3.0, self.delay * 1.4)
                    continue
                return None
        return None


# -------------------------------- filtering --------------------------------

_PROTECTED_LOWER = {p.lower() for p in PROTECTED}


def should_skip(text: str) -> bool:
    """True when translating a string could only damage it."""
    stripped = text.strip()
    if not stripped:
        return True
    # "PDF", "JSON", "DO101" — the same word in every language.
    if stripped.lower() in _PROTECTED_LOWER:
        return True
    # "PDF · JSON · CSV" and friends: nothing here is a word to translate.
    words = re.findall(r"[A-Za-z0-9.+-]+", stripped)
    return bool(words) and all(w.lower() in _PROTECTED_LOWER for w in words)


def is_sane(source: str, result: str) -> bool:
    """Rejects a translation that lost something the English promised."""
    if not result or not result.strip():
        return False
    # The product name must survive verbatim; an engine that drops or
    # transliterates it has rewritten a brand, and that is worse than English.
    if "DO101" in source and "DO101" not in result:
        return False
    # A "translation" that is three times the length is the engine looping.
    if len(result) > max(120, len(source) * 4):
        return False
    return True


# ---------------------------------- files ----------------------------------


def read_dictionary(code: str) -> dict[str, str]:
    path = DICT_DIR / f"{code}.json"
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def write_dictionary(code: str, entries: dict[str, str]) -> None:
    DICT_DIR.mkdir(parents=True, exist_ok=True)
    ordered = {key: entries[key] for key in sorted(entries)}
    path = DICT_DIR / f"{code}.json"
    path.write_text(
        json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


# ----------------------------------- run -----------------------------------


def pick_engine(code: str, name: str, args, engines: dict) -> ArgosEngine | GoogleEngine:
    """The engine for one language, reusing whichever have been built already."""
    if args.engine == "google" or code in NO_ARGOS_MODEL:
        if args.engine != "google":
            log(f"{code} ({name}): no Argos model, using the web engine")
        if "google" not in engines:
            engines["google"] = GoogleEngine(delay=args.delay)
        return engines["google"]

    if "argos" not in engines:
        engines["argos"] = ArgosEngine()
    argos = engines["argos"]
    if argos.prepare(code):
        return argos

    log(f"{code} ({name}): no Argos model available, falling back to the web engine")
    if "google" not in engines:
        engines["google"] = GoogleEngine(delay=args.delay)
    return engines["google"]


def translate_locale(code: str, name: str, sources: list[str], args, engines: dict) -> None:
    entries = {} if args.force else read_dictionary(code)
    engine = pick_engine(code, name, args, engines)

    pending = [s for s in sources if s not in entries and not should_skip(s)]
    if not pending:
        log(f"{code} ({name}): already complete — {len(entries)} strings")
        return

    log(f"{code} ({name}): {len(pending)} strings via {engine.name}")

    done = 0
    failed = 0
    started = time.monotonic()

    for source in pending:
        result = engine.translate(source, code)
        if result is not None:
            result = result.strip()
            # An engine that hands back the English has nothing to add; leaving
            # the key out means the runtime shows English, which is the same
            # thing without a misleading dictionary entry.
            if is_sane(source, result) and result != source:
                entries[source] = result
            else:
                failed += 1
        else:
            failed += 1

        done += 1
        if done % 25 == 0 or done == len(pending):
            rate = done / max(0.001, time.monotonic() - started)
            remaining = (len(pending) - done) / max(0.001, rate)
            print(
                f"\r  {done}/{len(pending)}  ({rate:.1f}/s, ~{remaining / 60:.0f} min left)",
                end="",
                flush=True,
            )
        if done % 100 == 0:
            write_dictionary(code, entries)

    write_dictionary(code, entries)
    log(f"\r  {len(entries)} strings written" + (f", {failed} left in English" if failed else ""))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--locale", help="translate one language only")
    parser.add_argument("--engine", choices=["argos", "google"], default="argos")
    parser.add_argument("--limit", type=int, help="only the first N source strings")
    parser.add_argument("--delay", type=float, default=0.35, help="web engine pacing, seconds")
    parser.add_argument("--force", action="store_true", help="ignore existing translations")
    args = parser.parse_args()

    if not SOURCE_FILE.exists():
        sys.exit(f"{SOURCE_FILE.relative_to(ROOT)} is missing — run: npm run i18n:harvest")

    sources = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    if args.limit:
        sources = sources[: args.limit]

    targets = TARGETS
    if args.locale:
        targets = [t for t in TARGETS if t[0] == args.locale]
        if not targets:
            sys.exit(f"unknown locale {args.locale!r}; known: {', '.join(c for c, _ in TARGETS)}")

    log(f"{len(sources)} source strings, {len(targets)} language(s)\n")
    engines: dict = {}
    for code, name in targets:
        translate_locale(code, name, sources, args, engines)


if __name__ == "__main__":
    main()
