import { object, string, infer as zinfer } from 'zod';

export const EnvironmentSchema = object({
  API_URL: string(),
  IDENTITY_POOL_ID: string(),
  USER_POOL_ID: string(),
  CLIENT_ID: string(),
  REGION: string(),
});

export type Environment = zinfer<typeof EnvironmentSchema>;
