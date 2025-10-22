import { object, string, infer as zinfer } from 'zod';

export const EnvironmentSchema = object({
  API_URL: string(),
  USER_POOL_ID: string(),
  CLIENT_ID: string(),
});

export type Environment = zinfer<typeof EnvironmentSchema>;
