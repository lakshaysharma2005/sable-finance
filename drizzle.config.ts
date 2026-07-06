import { readFileSync } from "fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't load .env.local on its own — read it here so
// `npm run db:migrate` works without extra tooling.
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i);
    const value = line.slice(i + 1).replace(/^"|"$/g, "");
    if (value && !process.env[key]) process.env[key] = value;
  }
} catch {
  // no .env.local — rely on the shell environment
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
  },
});
