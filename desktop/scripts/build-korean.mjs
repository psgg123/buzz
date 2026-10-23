import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { demoBuildConfig } from "./demo-build-config.mjs";

const desktop = path.resolve(import.meta.dirname, "..");
const identity = demoBuildConfig("Korean", "0000000000000002");
if (process.argv.includes("--print-identity")) {
  console.log(JSON.stringify(identity, null, 2));
  process.exit(0);
}
if (process.platform !== "darwin")
  throw new Error("This package targets macOS.");
if (!new Set(["arm64", "x64"]).has(process.arch))
  throw new Error("Unsupported architecture.");
const index = process.argv.indexOf("--sidecars-from");
const sourceApp = index >= 0 ? process.argv[index + 1] : null;
const expectedVersion = JSON.parse(
  readFileSync(path.join(desktop, "package.json"), "utf8"),
).version;
const target =
  process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
const names = [
  "buzz-acp",
  "buzz-agent",
  "buzz-backend-kubernetes",
  "buzz-dev-mcp",
  "git-credential-nostr",
  "buzz",
];
const binaries = path.join(desktop, "src-tauri/binaries");
mkdirSync(binaries, { recursive: true });
if (sourceApp) {
  const version = execFileSync(
    "/usr/bin/plutil",
    [
      "-extract",
      "CFBundleShortVersionString",
      "raw",
      "-o",
      "-",
      path.join(sourceApp, "Contents/Info.plist"),
    ],
    { encoding: "utf8" },
  ).trim();
  if (version !== expectedVersion)
    throw new Error(
      `Sidecars must come from Buzz ${expectedVersion}; found ${version}.`,
    );
  // Check every input before copying any of them. Never modify the official app.
  for (const name of names) {
    const source = path.join(sourceApp, "Contents/MacOS", name);
    if (!existsSync(source)) throw new Error(`Missing sidecar: ${name}`);
    const arch = execFileSync("/usr/bin/lipo", ["-archs", source], {
      encoding: "utf8",
    });
    if (
      !arch.split(/\s+/).includes(process.arch === "arm64" ? "arm64" : "x86_64")
    )
      throw new Error(`Wrong sidecar architecture: ${name}`);
  }
  for (const name of names)
    copyFileSync(
      path.join(sourceApp, "Contents/MacOS", name),
      path.join(binaries, `${name}-${target}`),
    );
}
const sidecars = names.map((name) => {
  const file = path.join(binaries, `${name}-${target}`);
  if (!existsSync(file))
    throw new Error(`Missing ${name}; pass --sidecars-from /path/to/Buzz.app.`);
  return {
    name,
    sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
    sourceVersion: expectedVersion,
    rebuilt: false,
  };
});
const evidence = path.join(desktop, "output/korean-build");
mkdirSync(evidence, { recursive: true });
writeFileSync(
  path.join(evidence, "identity.json"),
  JSON.stringify(identity, null, 2) + "\n",
);
writeFileSync(
  path.join(evidence, "sidecars.json"),
  JSON.stringify(sidecars, null, 2) + "\n",
);
const config = path.join(
  mkdtempSync(path.join(tmpdir(), "buzz-korean-")),
  "tauri.json",
);
writeFileSync(config, JSON.stringify(identity.tauriConfig, null, 2));
const env = {
  ...process.env,
  VITE_BUZZ_DEFAULT_LANGUAGE: "ko",
  BUZZ_BUILD_DEMO_SLUG: identity.slug,
};
delete env.BUZZ_UPDATER_PUBLIC_KEY;
delete env.BUZZ_UPDATER_ENDPOINT;
const result = spawnSync(
  "pnpm",
  [
    "tauri",
    "build",
    "--features",
    "mesh-llm",
    "--bundles",
    "app",
    "--config",
    config,
  ],
  { cwd: desktop, env, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status === 0) {
  const app = path.join(
    desktop,
    "src-tauri/target/release/bundle/macos",
    `${identity.productName}.app`,
  );
  // Re-sign only this local bundle; the source official app is never modified.
  // This is an ad-hoc development signature, not Block signing or notarization.
  for (const name of names) {
    execFileSync(
      "/usr/bin/codesign",
      [
        "--force",
        "--sign",
        "-",
        "--timestamp=none",
        path.join(app, "Contents/MacOS", name),
      ],
      { stdio: "inherit" },
    );
  }
  execFileSync(
    "/usr/bin/codesign",
    [
      "--force",
      "--sign",
      "-",
      "--timestamp=none",
      "--entitlements",
      path.join(desktop, "src-tauri/Entitlements.plist"),
      app,
    ],
    { stdio: "inherit" },
  );
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", app], {
    stdio: "inherit",
  });
  writeFileSync(
    path.join(evidence, "packaged-sidecars.json"),
    JSON.stringify(
      names.map((name) => ({
        name,
        sha256: createHash("sha256")
          .update(readFileSync(path.join(app, "Contents/MacOS", name)))
          .digest("hex"),
        rebuilt: false,
        locallyResigned: true,
      })),
      null,
      2,
    ) + "\n",
  );
}
process.exit(result.status ?? 1);
