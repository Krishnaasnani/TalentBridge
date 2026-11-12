import assert from "node:assert/strict";
import test from "node:test";
import { authRateLimit } from "../middleware/authRateLimitMiddleware.js";

const createResponse = () => {
  const response = { headers: {}, statusCode: null, body: null };
  response.set = (name, value) => { response.headers[name] = value; return response; };
  response.status = (code) => { response.statusCode = code; return response; };
  response.json = (body) => { response.body = body; return response; };
  return response;
};

test("allows authentication attempts below the threshold", () => {
  let nextCalled = false;
  authRateLimit({ ip: "test-allow" }, createResponse(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("rejects an eleventh authentication attempt during the limit window", () => {
  const request = { ip: "test-limit" };
  for (let index = 0; index < 10; index += 1) {
    authRateLimit(request, createResponse(), () => {});
  }

  const response = createResponse();
  authRateLimit(request, response, () => assert.fail("request should be throttled"));

  assert.equal(response.statusCode, 429);
  assert.match(response.headers["Retry-After"], /^\d+$/);
  assert.equal(response.body.success, false);
});
