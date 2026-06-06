import { pathToFileURL } from "node:url";

import postgres from "postgres";

import { seedStatements } from "./seed-data";

export type SeedExecution = {
  statementCount: number;
  mode: "applied" | "dry-run";
};

export type SeedDatabaseOptions = {
  databaseUrl?: string;
  dryRun?: boolean;
};

export async function seedDatabase(options: SeedDatabaseOptions = {}): Promise<SeedExecution> {
  if (options.dryRun) {
    return { statementCount: seedStatements.length, mode: "dry-run" };
  }

  if (!options.databaseUrl) {
    throw new Error("DATABASE_URL is required unless --dry-run is used.");
  }

  const sql = postgres(options.databaseUrl, { max: 1 });

  try {
    await sql.begin(async (transaction) => {
      for (const statement of seedStatements) {
        await transaction.unsafe(statement);
      }
    });
  } finally {
    await sql.end();
  }

  return { statementCount: seedStatements.length, mode: "applied" };
}

function isDirectRun() {
  const entrypoint = process.argv[1];
  return entrypoint ? import.meta.url === pathToFileURL(entrypoint).href : false;
}

if (isDirectRun()) {
  const dryRun = process.argv.includes("--dry-run") || process.env.MCP_DB_DRY_RUN === "true";

  seedDatabase({ databaseUrl: process.env.DATABASE_URL, dryRun })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
