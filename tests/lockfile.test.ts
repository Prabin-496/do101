import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the dependency tree against the npm optional-dependency bug
 * (npm/cli#4828), which has broken this project's deploy once already.
 *
 * The failure mode: installing an unrelated package can silently drop every
 * platform-specific optional binding from the lockfile, or a native binding can
 * end up as a *direct* dependency — which npm then enforces on every platform,
 * so `npm install` aborts on Linux with EBADPLATFORM.
 *
 * Both are invisible locally and fatal on Vercel, so they are asserted here.
 */
interface LockPackage {
  os?: string[];
  cpu?: string[];
  optional?: boolean;
}

const lock = JSON.parse(
  readFileSync(join(process.cwd(), "package-lock.json"), "utf8"),
) as { packages: Record<string, LockPackage> };

const manifest = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("dependency tree portability", () => {
  it("declares no platform-specific package as a direct dependency", () => {
    const direct = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    const platformSpecific = direct.filter((name) =>
      /-(darwin|linux|win32|android|freebsd|openharmony)-/.test(name),
    );
    expect(
      platformSpecific,
      "A native binding must never be a direct dependency — npm enforces its os/cpu on every platform and the install fails elsewhere.",
    ).toEqual([]);
  });

  it("marks every os/cpu-constrained package in the lockfile as optional", () => {
    const enforced = Object.entries(lock.packages)
      .filter(([path, info]) => path && (info.os || info.cpu) && !info.optional)
      .map(([path]) => path);
    expect(
      enforced,
      "These would abort `npm install` on any other platform, including Vercel's linux/x64.",
    ).toEqual([]);
  });

  it("keeps the Linux bindings the build host needs", () => {
    const paths = Object.keys(lock.packages);
    // If npm has pruned the optional set, these disappear and the deploy breaks.
    for (const required of [
      "node_modules/@rolldown/binding-linux-x64-gnu",
      "node_modules/@next/swc-linux-x64-gnu",
      "node_modules/@tailwindcss/oxide-linux-x64-gnu",
    ]) {
      expect(paths, `${required} is missing — regenerate the lockfile with a clean install.`).toContain(
        required,
      );
    }
  });
});
