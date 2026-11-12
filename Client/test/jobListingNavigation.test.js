import assert from "node:assert/strict";
import test from "node:test";
import { openJobFromListing } from "../src/pages/jobs/jobListingNavigation.js";

test("opening a job commits the default listing before pushing job details", () => {
  const calls = [];
  let flushed = false;

  openJobFromListing(
    (to, options) => calls.push({ to, options, flushed }),
    "job-123",
    (callback) => { flushed = true; callback(); },
  );

  assert.deepEqual(calls, [
    { to: "/jobs", options: { replace: true }, flushed: true },
    { to: "/jobs/job-123", options: undefined, flushed: true },
  ]);
});
