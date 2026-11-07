#!/usr/bin/env node
// pack-local.mjs: build a personal .ehpk from the tracked app.json plus an untracked app.local.json.
//
// Why: the tracked manifest must stay generic (upstream merges cleanly, no private hosts in a public repo),
// but a personal build should (a) carry its own package_id so it never collides with the upstream store
// listing, and (b) replace the catch-all "*" network allowlist with the exact Beeper origin(s) it needs.
//
// app.local.json (untracked, next to app.json):
//   {
//     "package_id": "com.example.gazechat",          // required: reverse-DNS id, unique to you
//     "name": "GazeChat",                            // optional: display name override
//     "beeper_origins": ["http://100.x.y.z:23373"]   // required: full origins only (scheme://host[:port])
//   }
//
// Usage: npm run pack:local   (runs `npm run build` first, then this script)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trackedPath = resolve(root, "app.json");
const localPath = resolve(root, "app.local.json");
const outDir = resolve(root, ".local-build");
const outManifest = resolve(outDir, "app.json");
const outPackage = resolve(root, "gazechat-local.ehpk");

function fail(message) {
  console.error(`[pack-local] ERROR: ${message}`);
  process.exit(1);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(`cannot read ${path}: ${e.message}`);
  }
}

// Even Hub's allowlist takes full origins only: no wildcards, no bare hostnames, no paths.
// See https://hub.evenrealities.com/docs/build/networking
function assertOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`not a URL: ${JSON.stringify(value)}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") fail(`origin must be http(s): ${value}`);
  if (url.origin !== value.replace(/\/$/, "")) fail(`give a bare origin (no path/query): ${value}`);
  if (url.hostname.includes("*")) fail(`wildcards are not allowed: ${value}`);
  return url.origin;
}

if (!existsSync(localPath)) {
  fail(`missing ${localPath}. Copy app.local.example.json to app.local.json and fill it in.`);
}

const tracked = readJson(trackedPath);
const local = readJson(localPath);

if (typeof local.package_id !== "string" || !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/.test(local.package_id)) {
  fail(`app.local.json package_id must be reverse-DNS lowercase, e.g. com.example.gazechat (got ${JSON.stringify(local.package_id)})`);
}
if (local.package_id === tracked.package_id) {
  fail("app.local.json package_id must differ from the upstream package_id, or your build collides with the store listing");
}
if (!Array.isArray(local.beeper_origins) || local.beeper_origins.length === 0) {
  fail("app.local.json beeper_origins must be a non-empty array of origins");
}
const beeperOrigins = local.beeper_origins.map(assertOrigin);

const manifest = structuredClone(tracked);
manifest.package_id = local.package_id;
if (local.name !== undefined) {
  if (typeof local.name !== "string" || local.name.length === 0 || local.name.length > 15) {
    fail("app.local.json name must be 1-15 characters");
  }
  manifest.name = local.name;
}

const network = manifest.permissions?.find((p) => p.name === "network");
if (!network || !Array.isArray(network.whitelist)) fail("tracked app.json has no network whitelist to narrow");

// Keep upstream's static help-link entries, drop the catch-all and the localhost default
// (localhost on the phone is the phone itself, never Beeper Desktop), then add our origins.
const kept = network.whitelist.filter((entry) => entry !== "*" && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(entry));
network.whitelist = [...new Set([...beeperOrigins, ...kept])];

mkdirSync(outDir, { recursive: true });
writeFileSync(outManifest, JSON.stringify(manifest, null, 2) + "\n");
console.log(`[pack-local] manifest: ${outManifest}`);
console.log(`[pack-local] package_id=${manifest.package_id} whitelist=${JSON.stringify(network.whitelist)}`);

if (!existsSync(resolve(root, "dist", "index.html"))) fail("dist/index.html missing: run `npm run build` first");

// Run the CLI's entry file with this Node binary: no shell, so paths need no quoting on any OS.
const require = createRequire(import.meta.url);
const cliDir = dirname(require.resolve("@evenrealities/evenhub-cli/package.json"));
const cliMain = resolve(cliDir, require("@evenrealities/evenhub-cli/package.json").bin.evenhub);
execFileSync(process.execPath, [cliMain, "pack", outManifest, "dist", "-o", outPackage], {
  cwd: root,
  stdio: "inherit",
});
console.log(`[pack-local] package: ${outPackage}`);
