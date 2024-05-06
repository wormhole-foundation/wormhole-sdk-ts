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

  //if (packageJson.exports) {
  //  packageJson.exports = Object.fromEntries(
  //    Object.entries(packageJson.exports).map(([path, stuff]) => {
  //      stuff = {
  //        "react-native": {
  //          // @ts-ignore
  //          import: stuff["import"]["default"],
  //          // @ts-ignore
  //          require: stuff["require"]["default"],
  //          // @ts-ignore
  //          types: stuff["default"]["types"],
  //          // @ts-ignore
  //          default: stuff["default"]["default"],
  //        },
  //        // @ts-ignore
  //        ...stuff,
  //      };
  //      return [path, stuff];
  //    }),
  //  );
  //}

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

const args = process.argv.slice(2);
const version = args[0];

if (!version) throw new Error("Need to pass in a version arg");

updateVersionsInWorkspaces(version);
