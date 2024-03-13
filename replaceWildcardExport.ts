import ts from "typescript";
import fs from "fs";
import path from "path";

function getModuleExports(filePath: string): string[] {
  const program = ts.createProgram({
    rootNames: [filePath],
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  });
  const srcFile = program.getSourceFile(filePath)!;
  const checker = program.getTypeChecker();

  const sourceFileSymbol = checker.getSymbolAtLocation(srcFile)!;
  const exports = checker.getExportsOfModule(sourceFileSymbol);
  return exports.map((exp) => exp.getName());
}

function findExports(filePath: string) {
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf8"),
    ts.ScriptTarget.ES2022,
  );

  const exports: Record<string, string[]> = {};
  ts.forEachChild(sourceFile, (node) => {
    // Find wildcard exports from index.ts files
    if (ts.isExportDeclaration(node) && !node.exportClause && node.moduleSpecifier) {
      // @ts-ignore
      const fileName = node.moduleSpecifier!.text;

      // external re-exports, skippy
      if (fileName.startsWith("@")) return;

      // maybe a dir or a file
      const modulePath = path.join(path.dirname(filePath), fileName);

      let isDir = false;
      try {
        // will throw if not a directory
        isDir = fs.statSync(modulePath).isDirectory();
      } catch {}

      const file = isDir ? path.join(modulePath, "index.ts") : modulePath + ".ts";
      const name = path.basename(modulePath);
      try {
        exports[name] = getModuleExports(file);
      } catch (e) {
        console.log("Failed to get module exports for ", file, "Referred to by", filePath);
        console.log(e);
      }
    }
  });
  return exports;
}

function updateExportStatements(directoryPath: string) {
  const contents = fs.readdirSync(directoryPath).map((file) => path.join(directoryPath, file));
  const dirs = contents.filter((filePath) => fs.statSync(filePath).isDirectory());
  const files = contents.filter(
    (filePath) => fs.statSync(filePath).isFile() && path.basename(filePath) === "index.ts",
  );

  dirs.forEach(updateExportStatements);
  files.forEach((filePath) => {
    // Only update index.ts exports directly
    if (fs.statSync(filePath).isFile() && path.basename(filePath) === "index.ts") {
      let fileContent = fs.readFileSync(filePath, "utf8");
      const exports = findExports(filePath);
      for (const [name, exported] of Object.entries(exports)) {
        if (exported.length === 0) continue;
        // Replace the export statement with named exports (this is a simplified replacement logic)
        const explicitExport = `export {${exported.join(", ")}} from "./${name}";`;
        fileContent = fileContent.replace(`export * from "./${name}";`, explicitExport);
      }
      //console.log(filePath);
      fs.writeFileSync(filePath, fileContent, "utf8");
    }
  });
}

function identifyWorkspaces(directoryPath: string) {
  // find all packages in workspaces package.json file
  const packageFile = fs.readFileSync(path.join(directoryPath, "package.json"), "utf8");
  const packageJson = JSON.parse(packageFile);
  for (const ws of packageJson.workspaces) {
    updateExportStatements(path.join(directoryPath, ws, "src"));
  }
}

identifyWorkspaces("/home/ben/connect-sdk");
