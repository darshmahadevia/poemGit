import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_DIRECT: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

const publicEnv = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!publicEnv.success) {
  throw new Error(
    `Invalid public environment variables: ${JSON.stringify(publicEnv.error.flatten().fieldErrors)}`,
  );
}

const serverEnv =
  typeof window === "undefined"
    ? serverEnvSchema.safeParse({
        DATABASE_URL: process.env.DATABASE_URL,
        DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      })
    : null;

if (serverEnv && !serverEnv.success) {
  throw new Error(
    `Invalid server environment variables: ${JSON.stringify(serverEnv.error.flatten().fieldErrors)}`,
  );
}

export const env = {
  ...publicEnv.data,
  ...(serverEnv ? serverEnv.data : {}),
} as z.infer<typeof publicEnvSchema> & z.infer<typeof serverEnvSchema>;
