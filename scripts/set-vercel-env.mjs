// One-off: (re)set production env vars on Vercel, piping values via stdin
// (PowerShell `echo | npx` does not forward stdin to the CLI on Windows).
import { spawnSync } from "child_process";
import { readFileSync } from "fs";

const local = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const vars = {
  PLAID_CLIENT_ID: local.PLAID_CLIENT_ID,
  PLAID_SECRET: local.PLAID_SECRET,
  PLAID_ENV: "production",
  APP_PASSWORD_HASH: local.APP_PASSWORD_HASH,
  SESSION_SECRET: local.SESSION_SECRET,
  ENCRYPTION_KEY: local.ENCRYPTION_KEY,
  CRON_SECRET: local.CRON_SECRET,
  NEXT_PUBLIC_APP_URL: "https://sable-finance.vercel.app",
};

for (const [key, value] of Object.entries(vars)) {
  if (!value) {
    console.error(`skipping ${key}: no value`);
    continue;
  }
  spawnSync("npx.cmd", ["vercel", "env", "rm", key, "production", "--yes"], {
    stdio: ["ignore", "inherit", "ignore"],
    shell: true,
  });
  const res = spawnSync("npx.cmd", ["vercel", "env", "add", key, "production"], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
  });
  if (res.status !== 0) console.error(`FAILED: ${key}`);
  else console.log(`set ${key}`);
}
