import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as {
  postgresClient: ReturnType<typeof postgres> | undefined;
};

const postgresClient =
  globalForDb.postgresClient ??
  postgres(env.DATABASE_URL, {
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = postgresClient;
}

export const db = drizzle(postgresClient);
