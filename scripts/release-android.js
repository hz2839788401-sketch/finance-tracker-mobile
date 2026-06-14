const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { applyProjectEnv } = require("./projectEnv");

const root = path.resolve(__dirname, "..");
const androidDir = path.join(root, "android");
const releaseDir = path.join(root, "release");
const gradlew = process.platform === "win32" ? "gradlew.bat" : "gradlew";
const version = require(path.join(root, "package.json")).version;

fs.mkdirSync(releaseDir, { recursive: true });

console.log("Building Android release APK (project caches on D:)...");
const build = spawnSync(path.join(androidDir, gradlew), ["assembleRelease"], {
  cwd: androidDir,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: applyProjectEnv()
});
if (build.status !== 0) process.exit(build.status || 1);

const builtApk = path.join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
const targetApk = path.join(releaseDir, "finance-tracker-standalone.apk");
if (!fs.existsSync(builtApk)) {
  console.error(`Release APK not found: ${builtApk}`);
  process.exit(1);
}

fs.copyFileSync(builtApk, targetApk);
console.log(`Release ready: ${targetApk}`);
