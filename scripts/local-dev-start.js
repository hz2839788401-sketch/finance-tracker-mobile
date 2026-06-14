const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { applyProjectEnv } = require("./projectEnv");

const root = path.resolve(__dirname, "..");
const tmpDir = path.join(root, ".tmp");
fs.mkdirSync(tmpDir, { recursive: true });

for (const name of ["api", "web"]) {
  for (const stream of ["out", "err"]) {
    fs.writeFileSync(path.join(tmpDir, `${name}.${stream}.log`), "");
  }
}

function cleanEnv(extra = {}) {
  return { ...applyProjectEnv(), ...extra };
}

function spawnService(name, command, args, env = {}) {
  const outLog = fs.createWriteStream(path.join(tmpDir, `${name}.out.log`), { flags: "a" });
  const errLog = fs.createWriteStream(path.join(tmpDir, `${name}.err.log`), { flags: "a" });
  const child = spawn(command, args, {
    cwd: root,
    env: cleanEnv(env),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  fs.writeFileSync(path.join(tmpDir, `${name}.pid`), String(child.pid));

  child.stdout.on("data", (chunk) => {
    outLog.write(chunk);
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    errLog.write(chunk);
    process.stderr.write(`[${name}] ${chunk}`);
  });
  child.on("exit", (code, signal) => {
    process.stdout.write(`[${name}] exited code=${code ?? ""} signal=${signal ?? ""}\n`);
  });

  return child;
}

const nodeExe = process.execPath;
const expoCli = path.join(root, "node_modules", "expo", "bin", "cli");

const commonEnv = {};

const api = spawnService("api", nodeExe, ["apps/api/src/server.js"], commonEnv);
const web = spawnService("web", nodeExe, [expoCli, "start", "--web", "--port", "8082", "--localhost"], commonEnv);

console.log("Local debug services are starting (project caches on D:).");
console.log("API:  http://127.0.0.1:4010");
console.log("Web:  http://127.0.0.1:8082");
console.log(`Logs: ${tmpDir}`);
console.log("Keep this terminal open. Press Ctrl+C to stop both services.");

function stopAll() {
  for (const [name, child] of [
    ["api", api],
    ["web", web]
  ]) {
    if (!child.killed) {
      try {
        child.kill();
        fs.rmSync(path.join(tmpDir, `${name}.pid`), { force: true });
      } catch {
        // Process may have already exited.
      }
    }
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});

