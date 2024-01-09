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
        // Note: this may be wrong if we start importing packages outside the workspaces
        // in this repo
        if (k.startsWith("@wormhole-foundation")) {
          return [k, `^${version}`];
        }
        return [k, v];
      }),
    );

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

function updateVersionsInWorkspaces(version: string) {
  updateVersionInPackageJson(__dirname, version);

  const rootPackageJsonPath = path.join(__dirname, "package.json");
  const rootPackageJson = require(rootPackageJsonPath);
  rootPackageJson.workspaces.forEach((workspaceDir: string) => {
    const workspacePackageDir = path.join(__dirname, workspaceDir);
    updateVersionInPackageJson(workspacePackageDir, version);
  });
}

function getVersion(): string {
  const versionFilePath = path.join(__dirname, "VERSION");
  const v = fs.readFileSync(versionFilePath);
  return v.toString().replace('\n', '');
}

updateVersionsInWorkspaces(getVersion());
