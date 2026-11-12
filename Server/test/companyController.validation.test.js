import assert from "node:assert/strict";
import test from "node:test";
import { createCompany, updateCompany } from "../controllers/companyController.js";
import Company from "../models/Company.js";

const employerId = "507f1f77bcf86cd799439011";
const companyId = "507f1f77bcf86cd799439012";
const response = () => {
  const result = { statusCode: null, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};
const originalFindById = Company.findById;
test.afterEach(() => { Company.findById = originalFindById; });

test("company creation rejects malformed required and optional strings", async () => {
  for (const body of [{ name: 1 }, { name: null }, { name: "Acme", description: {} }, { name: "Acme", website: null }]) {
    const res = response();
    await createCompany({ user: { id: employerId, role: "employer" }, body }, res);
    assert.equal(res.statusCode, 400);
  }
});

test("company update rejects malformed and missing values before writing", async () => {
  Company.findById = async () => ({ createdBy: { toString: () => employerId } });
  for (const body of [{}, { name: {} }, { description: null }, { logo: 3 }]) {
    const res = response();
    await updateCompany({ user: { id: employerId }, params: { id: companyId }, body }, res);
    assert.equal(res.statusCode, 400);
  }
});
