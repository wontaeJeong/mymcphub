import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import postgres from "postgres";

export type Migration = {
  id: string;
  sql: string;
};

export type MigrationExecution = {
  id: string;
  mode: "applied" | "dry-run" | "skipped";
};

export type RunMigrationsOptions = {
  databaseUrl?: string;
  dryRun?: boolean;
  migrationsDir?: string;
};

const defaultMigrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export async function loadMigrations(migrationsDir = defaultMigrationsDir): Promise<Migration[]> {
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  return Promise.all(
    migrationFiles.map(async (file) => ({
      id: file,
      sql: await readFile(join(migrationsDir, file), "utf8")
    }))
  );
}

export async function runMigrations(options: RunMigrationsOptions = {}): Promise<MigrationExecution[]> {
  const migrations = await loadMigrations(options.migrationsDir);

  if (options.dryRun) {
    return migrations.map((migration) => ({ id: migration.id, mode: "dry-run" }));
  }

  if (!options.databaseUrl) {
    throw new Error("DATABASE_URL is required unless --dry-run is used.");
  }

  const sql = postgres(options.databaseUrl, { max: 1 });
  const executions: MigrationExecution[] = [];

  try {
    await sql`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    for (const migration of migrations) {
      await sql.begin(async (transaction) => {
        const existing = await transaction<{ id: string }[]>`
          select id from schema_migrations where id = ${migration.id}
        `;

        if (existing.length > 0) {
          executions.push({ id: migration.id, mode: "skipped" });
          return;
        }

        await transaction.unsafe(migration.sql);
        await transaction`
          insert into schema_migrations (id) values (${migration.id})
        `;
        executions.push({ id: migration.id, mode: "applied" });
      });
    }
  } finally {
    await sql.end();
  }

  return executions;
}

function isDirectRun() {
  const entrypoint = process.argv[1];
  return entrypoint ? import.meta.url === pathToFileURL(entrypoint).href : false;
}

if (isDirectRun()) {
  const dryRun = process.argv.includes("--dry-run") || process.env.MCP_DB_DRY_RUN === "true";

  runMigrations({ databaseUrl: process.env.DATABASE_URL, dryRun })
    .then((executions) => {
      console.log(JSON.stringify({ dryRun, executions }, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
