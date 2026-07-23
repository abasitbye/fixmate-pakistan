import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import nextEnvironment from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

function normalizeDatabaseUrl(value) {
  try {
    new URL(value);
    return value;
  } catch {
    // Credential documents often contain a raw password; encode only that segment.
  }

  const schemeEnd = value.indexOf("://");
  const authorityEnd = value.lastIndexOf("@");
  const passwordStart = value.indexOf(":", schemeEnd + 3);

  if (schemeEnd < 0 || authorityEnd < 0 || passwordStart < 0) return value;

  const prefix = value.slice(0, passwordStart + 1);
  const password = value.slice(passwordStart + 1, authorityEnd).trim();
  const suffix = value.slice(authorityEnd);
  return `${prefix}${encodeURIComponent(password)}${suffix}`;
}

const databaseUrl = normalizeDatabaseUrl(rawDatabaseUrl);

const migrationDirectory = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
  .sort();

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  idle_timeout: 5,
  ssl: "require",
});

try {
  await sql.unsafe(`
    create table if not exists public.schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  const appliedRows = await sql`
    select version, checksum, applied_at
    from public.schema_migrations
    order by version
  `;
  const applied = new Map(appliedRows.map((row) => [row.version, row]));

  if (process.argv.includes("--status")) {
    for (const file of migrationFiles) {
      console.log(`${applied.has(file) ? "applied" : "pending"}  ${file}`);
    }
    process.exitCode = 0;
  } else {
    for (const file of migrationFiles) {
      const contents = await readFile(path.join(migrationDirectory, file), "utf8");
      const checksum = createHash("sha256").update(contents).digest("hex");
      const existing = applied.get(file);

      if (existing) {
        if (existing.checksum !== checksum) {
          throw new Error(`Applied migration checksum changed: ${file}`);
        }
        console.log(`verified ${file}`);
        continue;
      }

      console.log(`applying ${file}`);
      await sql.begin(async (transaction) => {
        await transaction.unsafe(contents);
        await transaction`
          insert into public.schema_migrations (version, checksum)
          values (${file}, ${checksum})
        `;
      });
      console.log(`applied  ${file}`);
    }
  }
} finally {
  await sql.end({ timeout: 5 });
}
