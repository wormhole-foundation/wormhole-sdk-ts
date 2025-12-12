import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = path.resolve(__dirname, "..", ".."); // you're in docs/scripts
const docsDir = path.join(rootDir, "docs");
const latestDocs = path.join(docsDir, "latest");
const versionFile = path.join(docsDir, ".version");

// Read current version from package.json
const currentVersion = require(path.join(rootDir, "package.json")).version;
const currentMajor = currentVersion.split(".")[0];

// Read previous version from .version file
let previousVersion: string | null = null;
if (fs.existsSync(versionFile)) {
  previousVersion = fs.readFileSync(versionFile, "utf-8").trim();
}
const previousMajor = previousVersion?.split(".")[0] || null;

console.log(`Current version: ${currentVersion}`);
console.log(`Previous version: ${previousVersion ?? "none"}`);

// If major version changed, archive docs/latest → docs/v<previousMajor>
if (previousMajor && previousMajor !== currentMajor) {
  const archiveDir = path.join(docsDir, `v${previousMajor}`);
  if (!fs.existsSync(archiveDir)) {
    console.log(`Archiving docs/latest to: docs/v${previousMajor}`);
    fs.cpSync(latestDocs, archiveDir, { recursive: true });
  } else {
    console.warn(`docs/v${previousMajor} already exists. Skipping copy.`);
  }
}

// Generate fresh docs into docs/latest
console.log("🛠️ Generating docs in docs/latest...");
execSync(
  "NODE_OPTIONS=--max_old_space_size=8192 typedoc --options typedoc.json --out docs/latest",
  { cwd: rootDir, stdio: "inherit" },
);

// Update .version file
fs.writeFileSync(versionFile, currentVersion);
console.log("✅ Docs updated. Current version stored in .version.");
