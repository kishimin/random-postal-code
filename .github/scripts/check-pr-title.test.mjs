import assert from "node:assert/strict";
import { test } from "node:test";

import { CONVENTIONAL_TYPES, isConventionalTitle } from "./check-pr-title.mjs";

test("every allowed type passes with a description", () => {
  for (const type of CONVENTIONAL_TYPES) {
    assert.equal(isConventionalTitle(`${type}: keep the history`), true, type);
  }
});

test("a scope and a breaking-change mark are optional", () => {
  assert.equal(isConventionalTitle("feat(web): add a page"), true);
  assert.equal(isConventionalTitle("feat!: drop the old API"), true);
  assert.equal(isConventionalTitle("feat(api)!: drop the old API"), true);
  assert.equal(isConventionalTitle("fix(web-frontend): wrap the label"), true);
});

test("a title without an allowed type fails", () => {
  assert.equal(isConventionalTitle("Add the five guide pages"), false);
  assert.equal(isConventionalTitle("feature: add a page"), false);
  assert.equal(isConventionalTitle("Fix: add a page"), false);
  assert.equal(isConventionalTitle("fixes: add a page"), false);
});

test("a malformed header fails", () => {
  assert.equal(isConventionalTitle("fix add a page"), false);
  assert.equal(isConventionalTitle("fix:add a page"), false);
  assert.equal(isConventionalTitle("fix: "), false);
  assert.equal(isConventionalTitle("fix:    "), false);
  assert.equal(isConventionalTitle("fix(): add a page"), false);
  assert.equal(isConventionalTitle("fix(a b): add a page"), false);
  assert.equal(isConventionalTitle("fix!add a page"), false);
  assert.equal(isConventionalTitle(" fix: add a page"), false);
  assert.equal(isConventionalTitle(""), false);
});
