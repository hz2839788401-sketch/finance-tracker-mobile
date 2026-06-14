const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const workspaceToolchains = path.join(path.dirname(root), "toolchains");

function getProjectPaths(projectRoot = root) {
  return {
    root: projectRoot,
    gradleUserHome: path.join(projectRoot, ".gradle"),
    npmCache: path.join(projectRoot, ".npm-cache"),
    expoHome: path.join(projectRoot, ".expo-home"),
    tmp: path.join(projectRoot, ".tmp"),
    jdk: path.join(workspaceToolchains, "jdk-17", "jdk-17.0.19+10"),
    androidSdk: path.join(workspaceToolchains, "android-sdk")
  };
}

function ensureProjectDirs(paths) {
  for (const dir of [paths.gradleUserHome, paths.npmCache, paths.expoHome, paths.tmp]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function applyProjectEnv(baseEnv = process.env, projectRoot = root) {
  const paths = getProjectPaths(projectRoot);
  ensureProjectDirs(paths);
  const env = { ...baseEnv };

  env.GRADLE_USER_HOME = paths.gradleUserHome;
  env.npm_config_cache = paths.npmCache;
  env.__UNSAFE_EXPO_HOME_DIRECTORY = paths.expoHome;
  env.TEMP = paths.tmp;
  env.TMP = paths.tmp;

  if (fs.existsSync(path.join(paths.jdk, "bin", "java.exe"))) {
    env.JAVA_HOME = paths.jdk;
    const jdkBin = path.join(paths.jdk, "bin");
    const pathKey = env.Path ? "Path" : env.PATH ? "PATH" : "Path";
    const currentPath = env[pathKey] || "";
    env[pathKey] = `${jdkBin};${currentPath}`;
    if (pathKey === "Path") env.PATH = env.Path;
    else env.Path = env.PATH;
  }

  if (fs.existsSync(paths.androidSdk)) {
    env.ANDROID_HOME = paths.androidSdk;
    env.ANDROID_SDK_ROOT = paths.androidSdk;
  }

  return env;
}

module.exports = {
  applyProjectEnv,
  ensureProjectDirs,
  getProjectPaths
};
