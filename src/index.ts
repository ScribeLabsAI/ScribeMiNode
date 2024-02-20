import { Auth, Credentials, RefreshToken, UsernamePassword } from '@scribelabsai/auth';
import { createSignedFetcher } from 'aws-sigv4-fetch';
import Base64 from 'crypto-js/enc-base64';
import Hex from 'crypto-js/enc-hex';
import WordArray from 'crypto-js/lib-typedarrays';
import MD5 from 'crypto-js/md5';
import { object, string, type ZodType } from 'zod';
import { type Environment } from './envSchema.js';
import {
  DeleteMIOutputSchema,
  GetListMIsOutputSchema,
  GetMIOutputSchema,
  GetPortfolioFundPerformanceOutputSchema,
  MIModelSchema,
  PostSubmitMIOutputSchema,
  type MICollatedModelFundPerformance,
  type MIFileType,
  type MIModel,
  type MITask,
} from './schema.js';

const ErrorSchema = object({
  errorType: string(),
  errorMessage: string(),
});

export class ScribeMIClient {
  readonly env: Environment;
  readonly authClient: Auth;
  tokens: Awaited<ReturnType<Auth['getTokens']>> | undefined;
  userId: string | undefined;
  credentials: Credentials | undefined;
  fetch: typeof fetch | undefined;

  constructor(env: Environment) {
    this.env = env;
    this.authClient = new Auth({
      clientId: env.CLIENT_ID,
      userPoolId: env.USER_POOL_ID,
      identityPoolId: env.IDENTITY_POOL_ID,
    });
  }

  async authenticate(param: UsernamePassword | RefreshToken) {
    this.tokens = await this.authClient.getTokens(param);
    if ('challengeName' in this.tokens) {
      throw new Error('Challenge not supported');
    }
    this.userId = await this.authClient.getFederatedId(this.tokens.idToken);
    this.credentials = await this.authClient.getFederatedCredentials(
      this.userId,
      this.tokens.idToken
    );
    this.fetch = createSignedFetcher({
      service: 'execute-api',
      region: 'eu-west-2',
      credentials: {
        accessKeyId: this.credentials.AccessKeyId,
        secretAccessKey: this.credentials.SecretKey,
        sessionToken: this.credentials.SessionToken,
      },
    });
  }

  async reauthenticate() {
    if (!this.tokens || !this.userId) {
      throw new Error('Must authenticate before reauthenticating');
    }
    if ('challengeName' in this.tokens) {
      throw new Error('Challenge not supported');
    }
    this.tokens = await this.authClient.getTokens({ refreshToken: this.tokens.refreshToken });
    if ('challengeName' in this.tokens) {
      throw new Error('Challenge not supported');
    }
    this.credentials = await this.authClient.getFederatedCredentials(
      this.userId,
      this.tokens.idToken
    );
    this.fetch = createSignedFetcher({
      service: 'execute-api',
      region: 'eu-west-2',
      credentials: {
        accessKeyId: this.credentials.AccessKeyId,
        secretAccessKey: this.credentials.SecretKey,
        sessionToken: this.credentials.SessionToken,
      },
    });
  }

  async callEndpoint<T>(path: string, outputSchema: ZodType<T>, args?: RequestInit): Promise<T> {
    if (!this.fetch || !this.credentials) {
      throw new Error('Not authenticated');
    }
    if (this.credentials.Expiration < new Date()) {
      await this.reauthenticate();
    }
    const res = await this.fetch(`https://${this.env.API_URL}${path}`, args);
    if (res.status === 200) {
      return outputSchema.parse(await res.json());
    } else {
      const parsedError = ErrorSchema.safeParse(await res.json());
      // eslint-disable-next-line unicorn/prefer-ternary
      if (parsedError.success) {
        throw new Error(`${res.status} ${parsedError.data.errorMessage}`);
      } else {
        throw new Error(`Unknown error (${res.status})`);
      }
    }
  }

  async listTasks(companyName?: string): Promise<MITask[]> {
    const params = new URLSearchParams();
    params.append('includePresigned', 'true');
    if (companyName) {
      params.append('company', companyName);
    }
    const { tasks } = await this.callEndpoint(
      `/tasks?${params.toString()}`,
      GetListMIsOutputSchema
    );
    return tasks;
  }

  async getTask(jobid: string): Promise<MITask> {
    return await this.callEndpoint(`/tasks/${jobid}`, GetMIOutputSchema);
  }

  async fetchModel(task: MITask): Promise<MIModel> {
    if (!task.modelUrl) {
      throw new Error(`Cannot load model for task ${task.jobid}: model is not ready to export`);
    }
    const res = await fetch(task.modelUrl);
    const modelContent = await res.text();

    const md5checksumExpected = res.headers.get('ETag')?.replaceAll('"', '');
    const md5checksum = Hex.stringify(MD5(modelContent));
    if (md5checksum !== md5checksumExpected) {
      throw new Error('Integrity Error: invalid checksum. Please retry.');
    }

    try {
      return MIModelSchema.parse(JSON.parse(modelContent));
    } catch (err) {
      console.log('Model validation failed:', err);
      throw new Error('Model does not match expected format');
    }
  }

  async consolidateTasks(tasks: MITask[]): Promise<MICollatedModelFundPerformance> {
    const params = new URLSearchParams({
      jobids: tasks.map((task) => task.jobid).join(';'),
    });
    const { model } = await this.callEndpoint(
      `/fund-portfolio?${params.toString()}`,
      GetPortfolioFundPerformanceOutputSchema
    );
    return model;
  }

  async submitTask(
    file: Buffer,
    props: { filetype: MIFileType; filename?: string; companyname?: string }
  ) {
    const md5checksum = Base64.stringify(MD5(WordArray.create(file)));
    const { jobid, url } = await this.callEndpoint('/tasks', PostSubmitMIOutputSchema, {
      method: 'POST',
      body: JSON.stringify({ ...props, md5checksum }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const res = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-MD5': md5checksum,
      },
    });
    if (res.status !== 200) {
      throw new Error(`Failed to upload file: ${res.status} ${res.statusText}`);
    }
    return jobid;
  }

  async deleteTask(task: MITask) {
    return await this.callEndpoint(`/tasks/${task.jobid}`, DeleteMIOutputSchema, {
      method: 'DELETE',
    });
  }
}
