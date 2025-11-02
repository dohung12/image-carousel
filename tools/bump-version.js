#!/usr/bin/env node
import fs from "fs";
import path from "path";

const root = path.resolve(process.cwd());
const manifestPath = path.join(root, "manifest.json");
const packageJsonPath = path.join(root, "package.json");

const release = (process.argv[2] || "patch").toLowerCase();
const allowed = new Set(["patch", "minor", "major"]);
if (!allowed.has(release)) {
  console.error("Usage: node tools/bump-version.js [patch|minor|major]");
  process.exit(1);
}

function bump(version, release) {
  const parts = version.split(".").map((n) => parseInt(n, 10) || 0);
  let [major, minor, patch] = parts;
  if (release === "patch") {
    patch += 1;
  } else if (release === "minor") {
    minor += 1;
    patch = 0;
  } else if (release === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  }
  return [major, minor, patch].join(".");
}

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}
function writeJson(fp, obj) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

const manifest = readJson(manifestPath);
const pkg = fs.existsSync(packageJsonPath) ? readJson(packageJsonPath) : null;

const current = manifest.version || "0.0.0";
const next = bump(current, release);

manifest.version = next;
writeJson(manifestPath, manifest);

if (pkg) {
  pkg.version = next;
  writeJson(packageJsonPath, pkg);
}

console.log(`Version bumped: ${current} -> ${next}`);

