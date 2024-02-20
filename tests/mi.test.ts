import { config as configureEnv } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { EnvironmentSchema } from '../src/env-schema.js';
import { ScribeMIClient } from '../src/index';
import { type MITask } from '../src/schema.js';

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

describe('auth', () => {
  it('fetches credentials with username / password', async () => {
    const client = new ScribeMIClient(env);
    await expect(client.authenticate({ username, password })).resolves.not.toThrow();
  });

  it('fetches credentials with refresh token', async () => {
    const client = new ScribeMIClient(env);
    await client.authenticate({ username, password });
    await expect(
      client.authenticate({ refreshToken: client.tokens!.refreshToken })
    ).resolves.not.toThrow();
  });

  it('reauthenticates', async () => {
    const client = new ScribeMIClient(env);
    await client.authenticate({ username, password });
    await expect(client.reauthenticate()).resolves.not.toThrow();
  });

  it('makes authenticated API calls', async () => {
    const client = new ScribeMIClient(env);
    await client.authenticate({ username, password });
    await expect(client.listTasks()).resolves.not.toThrow();
  });

  it('throws if not authenticated', async () => {
    const client = new ScribeMIClient(env);
    await expect(client.listTasks()).rejects.toThrow('Not authenticated');
  });
});

describe('error handling', () => {
  it('throws in case of error responses', async () => {
    const client = new ScribeMIClient(env);
    await client.authenticate({ username, password });
    await expect(client.getTask('invalidJobid')).rejects.toThrow();
  });
});

describe('endpoints can be called', () => {
  const client = new ScribeMIClient(env);
  let testFile: Buffer;
  let jobid = '';
  let task: MITask;

  beforeAll(async () => {
    await client.authenticate({ username, password });
    testFile = await readFile('tests/assets/test-pdf.pdf');
  });

  it('submitTask', async () => {
    await expect(
      (async () => {
        jobid = await client.submitTask(testFile, { filetype: 'pdf' });
      })()
    ).resolves.not.toThrow();
  });

  it('listTasks', async () => {
    await expect(client.listTasks()).resolves.not.toThrow();
  });

  it('getTask', async () => {
    await expect(
      (async () => {
        task = await client.getTask(jobid);
      })()
    ).resolves.not.toThrow();
  });

  it('fetchModel', async () => {
    await expect(client.fetchModel(task)).rejects.toThrow(
      `Cannot load model for task ${jobid}: model is not ready to export`
    );
  });

  it('consolidateTasks', async () => {
    // Expected to fail, because the model is not ready
    await expect(client.consolidateTasks([task])).rejects.toThrow();
  });

  it('deleteTask', async () => {
    await expect(client.deleteTask(task)).resolves.not.toThrow();
  });
});
