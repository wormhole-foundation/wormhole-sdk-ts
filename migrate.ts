import fs from "fs";
import path from "path";

const rootDir = (): string => path.join(__dirname);

updateImportsInWorkspaces();

function updateImportsInWorkspaces() {
  const dir = rootDir();
  const rootPackageJsonPath = path.join(dir, "package.json");
  const rootPackageJson = require(rootPackageJsonPath);
  rootPackageJson.workspaces.forEach((workspaceDir: string) => {
    const workspacePackageDir = path.join(dir, workspaceDir);
    console.log("Updating imports in", workspacePackageDir);
    updateTsFilesInDirectory(workspacePackageDir);
  });
}

function updateTsFilesInDirectory(workspaceDir: string) {
  findTsFiles(workspaceDir).forEach((file) => {
    fs.readFile(file, "utf8", (err, data) => {
      if (err) {
        console.error(`Error reading file ${file}:`, err);
        return;
      }

      const updatedContent = updateImportPaths(data);

      //fs.writeFile(file, updatedContent, "utf8", (err) => {
      //  if (err) {
      //    console.error(`Error writing file ${file}:`, err);
      //  } else {
      //    //console.log(`Updated file: ${file}`);
      //  }
      //});
    });
  });
}

function findTsFiles(dir: string): string[] {
  const contents = fs.readdirSync(dir).map((file) => path.join(dir, file));
  const dirs = contents.filter((filePath) => fs.statSync(filePath).isDirectory());

  // Recurse first, then look for imports in the current directory
  const nestedFiles = dirs.flatMap((dir) => findTsFiles(dir));

  const currentFiles = contents.filter(
    (filePath) => fs.statSync(filePath).isFile() && path.basename(filePath).endsWith(".ts"),
  )!;

  return [...nestedFiles, ...currentFiles];
}

// Function to modify the import/export statements
function updateImportPaths(fileContent: string) {
  return fileContent.replace(/from\s+['"]([^'"]*)['"]/g, (match, p1) => {
    // Check if the path already has a file extension
    if (path.extname(p1)) {
      return match; // Skip if the import statement has an extension
    }

    // Check if the path is relative
    if (!p1.startsWith(".") && !p1.startsWith("/")) {
      return match; // Skip if the import is not a relative path
    }

    if (p1.endsWith("/")) {
      p1 += "index";
    }
    if (p1 === ".") {
      p1 = "./index";
    }

    console.log(match, `from '${p1}.js'`);
    return `from '${p1}.js'`; // Append .js to the import path
  });
}
