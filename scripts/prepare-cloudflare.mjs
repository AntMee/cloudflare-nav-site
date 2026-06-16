import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const d1Name = process.env.D1_NAME || "nav_db";
const kvName = process.env.KV_NAME || "cloudflare_nav_cache";

assertResourceName(d1Name, "D1_NAME");
assertResourceName(kvName, "KV_NAME");

const d1Id = ensureD1(d1Name);
const kvId = ensureKV(kvName);

updateWranglerConfig(d1Name, d1Id, kvId);
applyD1Migrations(d1Name);

console.log(`D1 database: ${d1Name} (${d1Id})`);
console.log(`KV namespace: ${kvName} (${kvId})`);

function ensureD1(name) {
  const existing = findD1(name);
  if (existing) return existing;

  runWrangler(["d1", "create", name]);
  const created = findD1(name);
  if (!created) {
    throw new Error(`D1 database was created but its id could not be found: ${name}`);
  }
  return created;
}

function findD1(name) {
  const list = JSON.parse(runWrangler(["d1", "list", "--json"]) || "[]");
  const match = list.find((item) => item.name === name);
  return match?.uuid || match?.id || "";
}

function ensureKV(title) {
  const existing = findKV(title);
  if (existing) return existing;

  runWrangler(["kv", "namespace", "create", title]);
  const created = findKV(title);
  if (!created) {
    throw new Error(`KV namespace was created but its id could not be found: ${title}`);
  }
  return created;
}

function findKV(title) {
  const list = JSON.parse(runWrangler(["kv", "namespace", "list"]) || "[]");
  const match = list.find((item) => item.title === title);
  return match?.id || "";
}

function updateWranglerConfig(databaseName, databaseId, kvId) {
  const path = "wrangler.jsonc";
  const config = JSON.parse(stripJsonComments(readFileSync(path, "utf8")));
  const d1Binding = config.d1_databases?.find((binding) => binding.binding === "DB");
  const kvBinding = config.kv_namespaces?.find((binding) => binding.binding === "KV");

  if (!d1Binding) throw new Error("Missing DB D1 binding in wrangler.jsonc");
  if (!kvBinding) throw new Error("Missing KV namespace binding in wrangler.jsonc");

  d1Binding.database_name = databaseName;
  d1Binding.database_id = databaseId;
  kvBinding.id = kvId;

  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
}

function applyD1Migrations(databaseName) {
  runWrangler(["d1", "migrations", "apply", databaseName, "--remote"]);
}

function runWrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: process.env,
  }).trim();
}

function assertResourceName(value, envName) {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) {
    throw new Error(`${envName} may only contain letters, numbers, underscores, and hyphens`);
  }
}

function stripJsonComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}
