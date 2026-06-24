import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import process from "node:process";

const requiredFiles = ["manifest.json", "main.js", "versions.json"];
const optionalFiles = ["styles.css"];

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));

const failures = [];
const releaseAssets = [];

for (const file of requiredFiles) {
  try {
    const fileStat = await stat(file);
    if (!fileStat.isFile() || fileStat.size === 0) {
      failures.push(`${file} must exist and be non-empty.`);
    } else {
      releaseAssets.push({ file, size: fileStat.size });
    }
  } catch {
    failures.push(`${file} is missing.`);
  }
}

for (const file of optionalFiles) {
  try {
    await access(file);
    const fileStat = await stat(file);
    if (fileStat.isFile() && fileStat.size > 0) {
      releaseAssets.push({ file, size: fileStat.size });
    }
  } catch {
    // Obsidian and BRAT treat styles.css as optional.
  }
}

const releaseTag = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME;

if (releaseTag && releaseTag !== manifest.version) {
  failures.push(`release tag (${releaseTag}) must match manifest.json version (${manifest.version}).`);
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
for (const asset of releaseAssets) {
  const bytes = await readFile(asset.file);
  const hash = createHash("sha256").update(bytes).digest("hex");
  console.log(`${asset.file}\t${asset.size} bytes\tsha256:${hash}`);
}
