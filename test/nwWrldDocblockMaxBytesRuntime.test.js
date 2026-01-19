const test = require("node:test");
const assert = require("node:assert/strict");

const { parseNwWrldDocblockMetadata } = require("../dist/runtime/shared/nwWrldDocblock.js");

test("parseNwWrldDocblockMetadata: maxBytes prevents parsing tags beyond cutoff", () => {
  const prefix = ["/*", "x".repeat(200), ""].join("\n");
  const tags = [
    '@nwWrld name: "SHOULD_NOT_PARSE"',
    "@nwWrld category: Visuals",
    "@nwWrld imports: THREE",
    "*/",
  ].join("\n");
  const text = `${prefix}${tags}\nexport default class X {}`;

  const cutoff = prefix.length;
  const metaCut = parseNwWrldDocblockMetadata(text, cutoff);
  assert.deepEqual(metaCut, { name: null, category: null, imports: [], hasMetadata: false });

  const metaFull = parseNwWrldDocblockMetadata(text, cutoff + tags.length);
  assert.deepEqual(metaFull, { name: "SHOULD_NOT_PARSE", category: "Visuals", imports: ["THREE"], hasMetadata: true });
});
