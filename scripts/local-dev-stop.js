const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tmpDir = path.join(root, ".tmp");

for (const name of ["api", "web"]) {
  const pidFile = path.join(tmpDir, `${name}.pid`);
  if (!fs.existsSync(pidFile)) continue;
  const pid = Number(fs.readFileSync(pidFile, "utf8").trim());
  if (!Number.isFinite(pid)) continue;
  try {
    process.kill(pid);
    console.log(`Stopped ${name}: ${pid}`);
  } catch (error) {
    console.log(`Could not stop ${name} ${pid}: ${error.message}`);
  }
  fs.rmSync(pidFile, { force: true });
}
