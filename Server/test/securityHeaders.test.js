import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

process.env.NODE_ENV = "test";
const { app } = await import("../server.js");

test("Express responses include Helmet security headers", async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try {
    const response = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/`, resolve).on("error", reject);
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
    assert.ok(response.headers["strict-transport-security"]);
    assert.equal(response.headers["content-security-policy"], undefined);
    response.resume();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
