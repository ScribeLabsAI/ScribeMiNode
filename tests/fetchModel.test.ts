import { config as configureEnv } from 'dotenv';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentSchema } from '../src/envSchema.js';
import { ScribeMIClient } from '../src/index.js';
import type { MIModel, MITask } from '../src/schema.js';

configureEnv({ override: true });

const env = EnvironmentSchema.parse(process.env);

const username = process.env['USERNAME'];
const password = process.env['PASSWORD'];
if (!username) {
  throw new Error('Missing ENV.USERNAME');
}
if (!password) {
  throw new Error('Missing ENV.PASSWORD');
}

const MOCK_MODEL: MIModel = {
  company: 'EXAMPLE CO LTD',
  dateReporting: '2024-01-01',
  covering: 'year',
  items: [],
};
const MOCK_URL_INVALID_CHECKSUM = 'mock-url-invalid-checksum';

global.fetch = vi.fn(
  async (url: URL | RequestInfo) =>
    new Response(JSON.stringify(MOCK_MODEL), {
      status: 200,
      headers: {
        ETag:
          url === MOCK_URL_INVALID_CHECKSUM
            ? '"invalid-checksum"'
            : '"3f627dbbd74547377281ff090bf313eb"',
      },
    })
);

describe('fetchModel', () => {
  const client = new ScribeMIClient(env);

  it('succeeds if the checksum is valid', async () => {
    const mockTask: MITask = {
      client: 'Scribe',
      jobid: 'abcdabcd',
      status: 'SUCCESS',
      submitted: 99995,
      modelUrl: 'mock-url',
    };

    const model = await client.fetchModel(mockTask);

    expect(model).toEqual(MOCK_MODEL);
  });

  it('fails if the checksum is invalid', async () => {
    const mockTask: MITask = {
      client: 'Scribe',
      jobid: 'abcdabcd',
      status: 'SUCCESS',
      submitted: 99995,
      modelUrl: MOCK_URL_INVALID_CHECKSUM,
    };

    await expect(client.fetchModel(mockTask)).rejects.toThrow();
  });
});
