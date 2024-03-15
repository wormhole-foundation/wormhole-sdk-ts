import fs from "fs";
import path from "path";

function updateVersionInPackageJson(dirPath: string, version: string) {
  const packageJsonPath = path.join(dirPath, "package.json");
  const packageJson = require(packageJsonPath);
  packageJson.version = version;

  if (packageJson.dependencies)
    packageJson.dependencies = Object.fromEntries(
      Object.entries(packageJson.dependencies).map((entry) => {
        const [k, v] = entry as [string, string];
        // Note: this may be wrong if we start importing
        // packages outside the workspaces in this repo
        if (k.startsWith("@wormhole-foundation")) {
          return [k, `${version}`];
        }
        return [k, v];
      }),
    );

  if (!packageJson.exports) {
    packageJson.exports = {
      ".": {
        import: "./dist/esm/index.js",
        types: "./dist/esm/index.d.ts",
        require: "./dist/cjs/index.js",
      },
    };
  }

  packageJson.files = ["dist/esm", "dist/cjs"];

  if ("build" in packageJson.scripts) {
    if (packageJson.scripts.build.startsWith("tsc")) {
      packageJson.scripts["build:esm"] = packageJson.scripts.build;
      packageJson.scripts.build = "npm run build:esm && npm run build:cjs";
    }
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

function rootDir(): string {
  return path.join(__dirname);
}

function updateVersionsInWorkspaces(version: string) {
  const dir = rootDir();
  updateVersionInPackageJson(dir, version);

  const rootPackageJsonPath = path.join(dir, "package.json");
  const rootPackageJson = require(rootPackageJsonPath);
  rootPackageJson.workspaces.forEach((workspaceDir: string) => {
    const workspacePackageDir = path.join(dir, workspaceDir);
    updateVersionInPackageJson(workspacePackageDir, version);
  });
}

function getVersion(): string {
  const versionFilePath = path.join(rootDir(), "VERSION");
  const v = fs.readFileSync(versionFilePath);
  return v.toString().replace("\n", "");
}

updateVersionsInWorkspaces(getVersion());
