import fs from "fs";

const README_PATH = "../README.md";
const EXAMPLES_PATH = "../examples/src";

type ExampleTag = { tag: string; start: number; stop: number };

function findTags(src: string): ExampleTag[] {
  const tags: ExampleTag[] = [];

  // find example snippet flags
  const lines = src.split("\n");
  let currentTag: ExampleTag | null = null;
  for (const lno in lines) {
    const line = lines[lno];
    const exampleTag = line?.match(/EXAMPLE_.*/g);
    if (!exampleTag) continue;
    const t = exampleTag[0].replace("-->", "");
    if (!currentTag) {
      currentTag = { tag: t, start: parseInt(lno), stop: 0 };
    } else {
      currentTag.stop = parseInt(lno);
      tags.push(currentTag);
      currentTag = null;
    }
  }

  return tags;
}

(async function () {
  const readme = fs.readFileSync(README_PATH, "utf8");

  // find example snippet flags
  const tags = findTags(readme);
  if (tags.length === 0) throw new Error("No example snippet flags found in README.md");

  // Iterate over examples and find any example snippets
  const exampleSources: Record<string, string> = {};

  const examples = fs.readdirSync(EXAMPLES_PATH);
  for (const example of examples) {
    if (!example.endsWith(".ts")) continue;

    const examplePath = `${EXAMPLES_PATH}/${example}`;
    const exampleSource = fs.readFileSync(examplePath, "utf8");
    const exampleTags = findTags(exampleSource);

    for (const tag of exampleTags) {
      exampleSources[tag.tag] = exampleSource
        .split("\n")
        .slice(tag.start + 1, tag.stop)
        .join("\n");
    }
  }

  const lines = readme.split("\n");
  for (const tag of tags) {
    if (!(tag.tag in exampleSources)) {
      console.log(`No example source found for tag ${tag.tag}`);
      continue;
    }
    const exampleText = exampleSources[tag.tag]!;
    const exampleLines = ["```ts", ...exampleText.split("\n"), "```"];

    lines.splice(tag.start + 1, tag.stop - tag.start - 1, ...exampleLines);
  }

  fs.writeFileSync(README_PATH, lines.join("\n"));
})();
