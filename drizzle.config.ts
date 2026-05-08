import "dotenv/config";

import { defineConfig } from "drizzle-kit";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL_DIRECT: z.string().url(),
});

const parsed = schema.safeParse({
  DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
});

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables for drizzle config: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dbCredentials: {
    url: parsed.data.DATABASE_URL_DIRECT,
  },
  strict: true,
  verbose: true,
});
