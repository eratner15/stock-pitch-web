// A deployment is intentionally blocked until exact-SHA release approval is supplied.
import { execFileSync } from "node:child_process";
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (
  process.env.APPROVED_RELEASE_SHA !== sha ||
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
) {
  console.error(
    "Release blocked: clean checkout and explicit APPROVED_RELEASE_SHA matching HEAD required. See docs/research-workspace-release.md.",
  );
  process.exit(1);
}
