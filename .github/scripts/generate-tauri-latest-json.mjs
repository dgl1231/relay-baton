import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = "release-assets";
const tag = process.env.TAG;
const repository = process.env.REPOSITORY;

if (!tag || !repository) {
  console.log("Skipping latest.json: TAG or REPOSITORY is not set.");
  process.exit(0);
}

const files = await readdir(root).catch(() => []);
const assetUrl = (name) =>
  `https://github.com/${repository}/releases/download/${tag}/${encodeURIComponent(name)}`;

async function signatureFor(assetName) {
  const sigName = `${assetName}.sig`;
  if (!files.includes(sigName)) return null;
  return (await readFile(path.join(root, sigName), "utf8")).trim();
}

async function platform(assetName, platformKey) {
  const signature = await signatureFor(assetName);
  if (!signature) return null;
  return [platformKey, { url: assetUrl(assetName), signature }];
}

const linuxAsset = files.find((name) => name.endsWith("_amd64.AppImage"));
const macAsset = files.find((name) => name.endsWith(".app.tar.gz"));
const windowsAsset = files.find((name) => name.endsWith("_x64_en-US.msi"));

const entries = [];
if (linuxAsset) {
  const entry = await platform(linuxAsset, "linux-x86_64");
  if (entry) entries.push(entry);
}
if (macAsset) {
  const entry = await platform(macAsset, "darwin-aarch64");
  if (entry) entries.push(entry);
}
if (windowsAsset) {
  const entry = await platform(windowsAsset, "windows-x86_64");
  if (entry) entries.push(entry);
}

if (entries.length === 0) {
  console.log("Skipping latest.json: no signed updater artifacts were found.");
  process.exit(0);
}

const manifest = {
  version: tag.replace(/^v/, ""),
  notes: `relay-baton ${tag}`,
  pub_date: new Date().toISOString(),
  platforms: Object.fromEntries(entries),
};

await writeFile(path.join(root, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote latest.json for ${entries.length} platform(s).`);
