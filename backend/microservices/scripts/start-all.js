const path = require("path");
const { spawn } = require("child_process");

const services = [
  { name: "auth-service", script: "microservices/auth-service/server.js" },
  { name: "document-service", script: "microservices/document-service/server.js" },
  { name: "verification-service", script: "microservices/verification-service/server.js" },
  { name: "monitoring-service", script: "microservices/monitoring-service/server.js" },
  { name: "api-gateway", script: "microservices/gateway/server.js" },
];

const cwd = path.resolve(__dirname, "../..");
const children = [];

function startService(entry) {
  const child = spawn("node", [entry.script], {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`${entry.name} exited with code ${code}`);
    }
  });

  children.push(child);
}

services.forEach(startService);

function shutdown() {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill();
    }
  });
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
