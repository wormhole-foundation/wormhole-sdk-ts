import fs from "fs";

const README_PATH = "../README.md";
const EXAMPLES_PATH = "../examples/src";
const EXAMPLE_URL = "https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/";

type ExampleTag = { tag: string; start: number; stop: number };
type ExampleMeta = { filename: string; src: string; line: number };

function findTags(src: string): ExampleTag[] {
  const tags: ExampleTag[] = [];

  // find example snippet flags
  const lines = src.split("\n");
  let currentTag: ExampleTag | null = null;
  for (const lno in lines) {
    const line = lines[lno];
    const exampleTag = line?.match(/EXAMPLE_.*/g);
    if (!exampleTag) continue;
    const t = exampleTag[0].replace(/[^A-Z_]/g, "");
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
  const exampleSources: Record<string, ExampleMeta> = {};

  const examples = fs.readdirSync(EXAMPLES_PATH);
  for (const example of examples) {
    if (!example.endsWith(".ts")) continue;

    const examplePath = `${EXAMPLES_PATH}/${example}`;
    const exampleSource = fs.readFileSync(examplePath, "utf8");
    const exampleTags = findTags(exampleSource);

    for (const tag of exampleTags) {
      exampleSources[tag.tag] = {
        src: exampleSource
          .split("\n")
          .slice(tag.start + 1, tag.stop)
          .join("\n"),
        filename: example,
        line: tag.start,
      };
    }
  }

  let offset = 0;
  const lines = readme.split("\n");
  for (const tag of tags) {
    if (!(tag.tag in exampleSources)) {
      console.log(`No example source found for tag ${tag.tag}`);
      continue;
    }

    const src = exampleSources[tag.tag]!;
    const link = EXAMPLE_URL + src.filename + "#L" + (src.line + 2);

    const exampleLines = ["```ts", ...src.src.split("\n"), "```", `See example [here](${link})`];

    const replaced = lines.splice(
      offset + tag.start + 1,
      tag.stop - tag.start - 1,
      ...exampleLines,
    );

    offset += exampleLines.length - replaced.length;
  }

  fs.writeFileSync(README_PATH, lines.join("\n"));
})();
