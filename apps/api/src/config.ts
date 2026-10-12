import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  // Localhost by default; the appliance sets HOST to listen on the home network.
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Users per appliance, owner included. Set per device at provisioning.
  MAX_USERS: z.coerce.number().int().min(1).max(50).default(6),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
}

export const config = {
  port: parsed.data.PORT,
  host: parsed.data.HOST,
  databaseUrl: parsed.data.DATABASE_URL,
  maxUsers: parsed.data.MAX_USERS,
};
