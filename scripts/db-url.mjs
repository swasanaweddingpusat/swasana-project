/**
 * db-url.mjs — resolve a DB connection URL by environment, reading .env
 * (including commented-out lines). Never switches/edits the .env file.
 *
 * Usage:
 *   import { resolveDbUrls, ENV_HOST } from "./db-url.mjs"
 *   const { direct, pooled } = resolveDbUrls("prod")
 *
 * CLI (prints PowerShell env-set lines, host masked in the value only when piped):
 *   node scripts/db-url.mjs prod   # emits:  $env:DIRECT_URL="..."; $env:DATABASE_URL="..."
 *
 * Host fragments identify each environment uniquely:
 *   dev     -> ep-silent-cell-ap8gvquc
 *   staging -> ep-purple-waterfall-amnb5vv6
 *   prod    -> ep-shiny-sunset-amdepefn
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ENV_HOST = {
  dev: "ep-silent-cell-ap8gvquc",
  staging: "ep-purple-waterfall-amnb5vv6",
  prod: "ep-shiny-sunset-amdepefn",
};

function readEnv() {
  return readFileSync(path.join(__dirname, "..", ".env"), "utf8");
}

/** Find a VAR's value whose URL contains hostFragment, scanning commented lines too. */
function extractByHost(envText, varName, hostFragment) {
  for (const raw of envText.split(/\r?\n/)) {
    const line = raw.replace(/^[#\s]+/, "").trim();
    if (!line.startsWith(varName)) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (val.includes(hostFragment)) return val;
  }
  return undefined;
}

export function resolveDbUrls(envName) {
  const frag = ENV_HOST[envName];
  if (!frag) throw new Error(`unknown env "${envName}" (use dev|staging|prod)`);
  const text = readEnv();
  const direct = extractByHost(text, "DIRECT_URL", frag);
  const pooled = extractByHost(text, "DATABASE_URL", frag);
  if (!direct && !pooled) throw new Error(`no DB url found for ${envName} (fragment ${frag})`);
  return { direct: direct ?? pooled, pooled: pooled ?? direct, fragment: frag };
}

export function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "[invalid]";
  }
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, "/") ||
    process.argv[1]?.endsWith("db-url.mjs")) {
  const env = process.argv[2];
  if (!env) {
    console.error("usage: node scripts/db-url.mjs <dev|staging|prod>");
    process.exit(1);
  }
  const { direct, pooled } = resolveDbUrls(env);
  // Emit PowerShell statements to set env for THIS shell only.
  process.stdout.write(`$env:DIRECT_URL="${direct}"; $env:DATABASE_URL="${pooled}"\n`);
}
