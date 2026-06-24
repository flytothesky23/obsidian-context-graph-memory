import { access, readFile, stat } from "node:fs/promises";
import process from "node:process";

const requiredFiles = ["manifest.json", "main.js", "versions.json"];
const optionalFiles = ["styles.css"];

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));

const failures = [];

for (const file of requiredFiles) {
  try {
    const fileStat = await stat(file);
    if (!fileStat.isFile() || fileStat.size === 0) {
      failures.push(`${file} must exist and be non-empty.`);
    }
  } catch {
    failures.push(`${file} is missing.`);
  }
}

for (const file of optionalFiles) {
  try {
    await access(file);
  } catch {
    // Obsidian and BRAT treat styles.css as optional.
  }
}

if (packageJson.version !== manifest.version) {
  failures.push(`package.json version (${packageJson.version}) must match manifest.json version (${manifest.version}).`);
}

if (!versions[manifest.version]) {
  failures.push(`versions.json must include manifest version ${manifest.version}.`);
}

if (versions[manifest.version] !== manifest.minAppVersion) {
  failures.push(
    `versions.json[${manifest.version}] (${versions[manifest.version]}) must match manifest minAppVersion (${manifest.minAppVersion}).`,
  );
}

if (manifest.id !== "context-graph-memory") {
  failures.push(`manifest id must remain context-graph-memory for BRAT and vault folder consistency.`);
}

if (manifest.isDesktopOnly !== true) {
  failures.push("manifest isDesktopOnly must stay true because Neo4j driver usage is desktop-only for this MVP.");
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`release check passed for ${manifest.id} ${manifest.version}`);
