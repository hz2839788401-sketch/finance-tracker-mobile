const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const androidDir = path.join(root, "android");
const releaseDir = path.join(root, "release");
const gradlew = process.platform === "win32" ? "gradlew.bat" : "gradlew";
const version = require(path.join(root, "package.json")).version;
const workspaceToolchains = path.join(path.dirname(root), "toolchains");
const defaultJdk = path.join(workspaceToolchains, "jdk-17", "jdk-17.0.19+10");

function resolveBuildEnv() {
  const env = { ...process.env };
  const javaHome = env.JAVA_HOME || "";
  const javaExe = javaHome ? path.join(javaHome, "bin", "java.exe") : "";
  if (!javaExe || !fs.existsSync(javaExe)) {
    if (fs.existsSync(path.join(defaultJdk, "bin", "java.exe"))) {
      env.JAVA_HOME = defaultJdk;
      env.ANDROID_HOME = env.ANDROID_HOME || path.join(workspaceToolchains, "android-sdk");
      env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
      env.GRADLE_USER_HOME = env.GRADLE_USER_HOME || path.join(root, ".gradle");
      env.Path = `${path.join(defaultJdk, "bin")};${env.Path || ""}`;
    }
  }
  return env;
}

fs.mkdirSync(releaseDir, { recursive: true });

console.log("Building Android release APK...");
const build = spawnSync(path.join(androidDir, gradlew), ["assembleRelease"], {
  cwd: androidDir,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: resolveBuildEnv()
});
if (build.status !== 0) process.exit(build.status || 1);

const builtApk = path.join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
const targetApk = path.join(releaseDir, "finance-tracker-standalone.apk");
if (!fs.existsSync(builtApk)) {
  console.error(`Release APK not found: ${builtApk}`);
  process.exit(1);
}

fs.copyFileSync(builtApk, targetApk);
const stats = fs.statSync(targetApk);
const mb = (stats.size / (1024 * 1024)).toFixed(1);

const notes = `# Finance Tracker APK v${version}

## Current build

APK:

\`\`\`text
${targetApk.replace(/\\/g, "/")}
\`\`\`

Size: ~${mb} MB

Built: ${new Date().toISOString()}

## Changes in v0.2.0

- Animated in-app splash screen on startup
- Phone standalone unlock: device-local password (SecureStore), no PC API required
- PC browser debugging still uses local Express API on port 4010
- Native Android splash updated (dark theme + logo orb)

## Install

1. Copy \`finance-tracker-standalone.apk\` to your Android phone
2. Install and open the app
3. Create a device password on first launch
4. Grant notification access in system settings for notification sync

## Limits

- Debug-signed APK for local testing, not Play Store production signing
- Notification capture requires Android notification listener permission
- Does not connect to WeChat/Alipay/bank official APIs
`;

fs.writeFileSync(path.join(releaseDir, "RELEASE_NOTES.md"), notes, "utf8");
console.log(`Release ready: ${targetApk} (${mb} MB)`);
