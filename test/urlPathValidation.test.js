const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { decodeUrlPathSegment, decodeUrlPathSegmentNoSeparators } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "urlPathValidation.js"
));

test("decodeUrlPathSegment decodes and preserves safe strings", () => {
  assert.equal(decodeUrlPathSegment("hello"), "hello");
  assert.equal(decodeUrlPathSegment("hello%20world"), "hello world");
});

test("decodeUrlPathSegment rejects null byte", () => {
  assert.equal(decodeUrlPathSegment("a%00b"), null);
});

test("decodeUrlPathSegment allows encoded slash (token-safe)", () => {
  assert.equal(decodeUrlPathSegment("a%2Fb"), "a/b");
});

test("decodeUrlPathSegmentNoSeparators rejects encoded separators", () => {
  assert.equal(decodeUrlPathSegmentNoSeparators("a%2Fb"), null);
  assert.equal(decodeUrlPathSegmentNoSeparators("a%5Cb"), null);
});
