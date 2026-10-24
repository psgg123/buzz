import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { koreanBuildNumber, koreanSourceInfo } from "./korean-build-info.mjs";

test("local build numbers are explicit bounded revisions independent of the profile ID", () => {
  assert.equal(koreanBuildNumber([]), "1");
  assert.equal(koreanBuildNumber(["--build-number", "2"]), "2");
  for (const value of [undefined, "0", "02", "1.2", "abc", "10000"])
    assert.throws(() => koreanBuildNumber(["--build-number", value]));
});

test("the source fingerprint catches edits, deletions and untracked inputs but excludes ignored files", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "buzz-source-fingerprint-"),
  );
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, stdio: "pipe" });
  try {
    git("init", "--quiet");
    fs.writeFileSync(path.join(root, "source.txt"), "original");
    fs.writeFileSync(path.join(root, ".gitignore"), "local/\n");
    fs.symlinkSync("outside", path.join(root, "link"));
    git("add", ".");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-s",
      "-m",
      "fixture",
    );
    const baseline = koreanSourceInfo(root);
    assert.equal(baseline.dirty, false);
    assert.equal(baseline.commit.length, 40);
    assert.equal(baseline.sourceFiles, 3);
    fs.mkdirSync(path.join(root, "local"));
    fs.writeFileSync(path.join(root, "local/private.txt"), "ignored");
    assert.deepEqual(koreanSourceInfo(root), baseline);
    fs.writeFileSync(path.join(root, "source.txt"), "edited");
    assert.notEqual(koreanSourceInfo(root).sourceSha256, baseline.sourceSha256);
    fs.writeFileSync(path.join(root, "source.txt"), "original");
    assert.deepEqual(koreanSourceInfo(root), baseline);
    fs.writeFileSync(path.join(root, "new.txt"), "new source");
    assert.equal(koreanSourceInfo(root).dirty, true);
    assert.notEqual(koreanSourceInfo(root).sourceSha256, baseline.sourceSha256);
    fs.unlinkSync(path.join(root, "new.txt"));
    fs.unlinkSync(path.join(root, "source.txt"));
    assert.notEqual(koreanSourceInfo(root).sourceSha256, baseline.sourceSha256);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
