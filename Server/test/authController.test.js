import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { loginUser, registerUser } from "../controllers/authController.js";
import User from "../models/User.js";

const testSecret = "auth-controller-test-secret";
process.env.JWT_SECRET = testSecret;

const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

const originals = { findOne: User.findOne, create: User.create };

test.afterEach(() => {
  User.findOne = originals.findOne;
  User.create = originals.create;
});

test("registration rejects invalid required fields, email, password, and role inputs", async () => {
  const invalidBodies = [
    {},
    { fullName: "Ada", email: "not-an-email", password: "password123" },
    { fullName: "Ada", email: "ada@example.test", password: "short" },
    { fullName: "Ada", email: "ada@example.test", password: "password123", role: "admin" },
  ];

  for (const body of invalidBodies) {
    const res = response();
    await registerUser({ body }, res);
    assert.equal(res.statusCode, 400);
  }
});

test("registration hashes passwords and never returns them", async () => {
  let createPayload;
  User.findOne = async () => null;
  User.create = async (data) => {
    createPayload = { ...data };
    return { _id: "user-id", ...data };
  };
  const res = response();

  await registerUser({ body: { fullName: " Ada ", email: "ADA@Example.Test", password: "password123", role: "candidate" } }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createPayload.email, "ada@example.test");
  assert.equal(createPayload.password === "password123", false);
  assert.equal(await bcrypt.compare("password123", createPayload.password), true);
  assert.equal("password" in res.body.user, true);
  assert.equal(res.body.user.password, undefined);
  assert.equal(JSON.stringify(res.body).includes(createPayload.password), false);
});

test("registration rejects a duplicate account", async () => {
  User.findOne = async () => ({ _id: "existing-user" });
  const res = response();

  await registerUser({ body: { fullName: "Ada", email: "ada@example.test", password: "password123" } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "User already exists");
});

test("login rejects invalid credentials and returns a safe authenticated response", async () => {
  User.findOne = () => ({ select: async () => null });
  const missingUser = response();
  await loginUser({ body: { email: "ada@example.test", password: "password123" } }, missingUser);
  assert.equal(missingUser.statusCode, 401);

  const passwordHash = await bcrypt.hash("correct-password", 10);
  User.findOne = () => ({ select: async () => ({ _id: "user-id", role: "candidate", fullName: "Ada", password: passwordHash }) });
  const wrongPassword = response();
  await loginUser({ body: { email: "ada@example.test", password: "wrong-password" } }, wrongPassword);
  assert.equal(wrongPassword.statusCode, 401);

  const valid = response();
  await loginUser({ body: { email: "ada@example.test", password: "correct-password" } }, valid);
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.body.success, true);
  assert.equal(jwt.verify(valid.body.token, testSecret).role, "candidate");
  assert.equal(valid.body.user.password, undefined);
  assert.equal(JSON.stringify(valid.body).includes(passwordHash), false);
});
