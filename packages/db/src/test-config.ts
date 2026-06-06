export function readTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const testDatabaseUrl = normalizeEnvValue(env.TEST_DATABASE_URL);
  if (!testDatabaseUrl) {
    return undefined;
  }

  const databaseUrl = normalizeEnvValue(env.DATABASE_URL);
  if (databaseUrl && databaseUrl === testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL must be separate from DATABASE_URL.");
  }

  return testDatabaseUrl;
}

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
