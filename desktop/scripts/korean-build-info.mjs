import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Parse the explicit local package revision without changing the app identity. */
export function koreanBuildNumber(args) {
  const index = args.indexOf("--build-number");
  const value = index < 0 ? "1" : args[index + 1];
  if (!/^[1-9]\d{0,3}$/.test(value ?? ""))
    throw new Error("--build-number must be an integer from 1 to 9999");
  return value;
}

/** Fingerprint source inputs, including pending edits and untracked source files. */
export function koreanSourceInfo(root) {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  const files = git(
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  const hash = createHash("sha256");
  for (const file of files) {
    const input = path.join(root, file);
    hash.update(file).update("\0");
    let stat;
    try {
      stat = fs.lstatSync(input);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      hash.update("deleted\0");
      continue;
    }
    hash.update(String(stat.mode & 0o777)).update("\0");
    hash.update(
      stat.isSymbolicLink() ? fs.readlinkSync(input) : fs.readFileSync(input),
    );
    hash.update("\0");
  }
  return {
    commit: git("rev-parse", "HEAD").trim(),
    dirty:
      git("status", "--porcelain=v1", "--untracked-files=normal").length > 0,
    sourceSha256: hash.digest("hex"),
    sourceFiles: files.length,
  };
}
