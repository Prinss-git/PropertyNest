#!/usr/bin/env node
/**
 * Manages the private development Postgres that lives in ../.devdb (port 5433, local only, no password).
 *
 *   node scripts/devdb.mjs init     create the data folder + database (first time only)
 *   node scripts/devdb.mjs start
 *   node scripts/devdb.mjs stop
 *   node scripts/devdb.mjs status
 *
 * Finds Postgres via PG_BIN, then PATH, then C:\Program Files\PostgreSQL\<newest>\bin.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const DATA_DIR = resolve(import.meta.dirname, "..", "..", ".devdb");
const PORT = "5433";
const USER = "propertynest";
const DB = "propertynest";
const exe = process.platform === "win32" ? ".exe" : "";

function findBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const fromPath = (process.env.PATH || "").split(process.platform === "win32" ? ";" : ":")
    .find((dir) => dir && existsSync(join(dir, "pg_ctl" + exe)));
  if (fromPath) return fromPath;
  const root = "C:\\Program Files\\PostgreSQL";
  if (existsSync(root)) {
    const versions = readdirSync(root).filter((v) => /^\d+$/.test(v)).sort((a, b) => b - a);
    for (const v of versions) {
      const bin = join(root, v, "bin");
      if (existsSync(join(bin, "pg_ctl" + exe))) return bin;
    }
  }
  console.error("Couldn't find PostgreSQL. Install it, or set PG_BIN to its bin folder.");
  process.exit(1);
}

const bin = findBin();
const run = (tool, args, opts = {}) => execFileSync(join(bin, tool + exe), args, { stdio: "inherit", ...opts });
const pgCtl = (...args) => run("pg_ctl", ["-D", DATA_DIR, ...args]);

// The server process would inherit our stdout and keep it open forever (so `npm run db:start` never
// returned when run from a script). Its output goes to server.log anyway, so don't pass ours on.
function startServer() {
  run("pg_ctl", ["-D", DATA_DIR, "-o", `-p ${PORT} -c listen_addresses=localhost`, "-l", join(DATA_DIR, "server.log"), "-w", "start"], { stdio: "ignore" });
  console.log(`Dev database running on localhost:${PORT}`);
}

const cmd = process.argv[2];
switch (cmd) {
  case "init":
    if (existsSync(DATA_DIR)) {
      console.log(`Dev database already exists at ${DATA_DIR}`);
      break;
    }
    run("initdb", ["-D", DATA_DIR, "-U", USER, "--auth=trust", "-E", "UTF8", "--locale=C"]);
    startServer();
    run("createdb", ["-h", "localhost", "-p", PORT, "-U", USER, DB]);
    console.log("Dev database created.");
    break;
  case "start":
    try {
      startServer();
    } catch {
      console.error(`Couldn't start the dev database. If it's already running, that's fine; otherwise see ${join(DATA_DIR, "server.log")}`);
      process.exitCode = 1;
    }
    break;
  case "stop":
    pgCtl("-w", "stop");
    break;
  case "status":
    try { pgCtl("status"); } catch { process.exitCode = 0; }
    break;
  default:
    console.log("Usage: node scripts/devdb.mjs <init|start|stop|status>");
}
