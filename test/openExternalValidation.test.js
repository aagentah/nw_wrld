const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { URL } = require("node:url");

const { normalizeOpenExternalUrl } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "openExternalValidation.js"
));

test("normalizeOpenExternalUrl allows http/https urls", () => {
  const httpsRes = normalizeOpenExternalUrl("https://example.com");
  assert.ok(httpsRes);
  assert.equal(new URL(httpsRes).protocol, "https:");

  const httpRes = normalizeOpenExternalUrl("http://example.com");
  assert.ok(httpRes);
  assert.equal(new URL(httpRes).protocol, "http:");
});

test("normalizeOpenExternalUrl rejects non-http(s) schemes and invalid inputs", () => {
  assert.equal(normalizeOpenExternalUrl("javascript:alert(1)"), null);
  assert.equal(normalizeOpenExternalUrl("file:///etc/passwd"), null);
  assert.equal(normalizeOpenExternalUrl("data:text/plain,hi"), null);
  assert.equal(normalizeOpenExternalUrl("mailto:test@example.com"), null);
  assert.equal(normalizeOpenExternalUrl("not a url"), null);
  assert.equal(normalizeOpenExternalUrl(""), null);
  assert.equal(normalizeOpenExternalUrl(null), null);
  assert.equal(normalizeOpenExternalUrl(123), null);
});

