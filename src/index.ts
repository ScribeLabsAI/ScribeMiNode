import { Auth, Credentials, RefreshToken, Tokens, UsernamePassword } from '@scribelabsai/auth';
import { createSignedFetcher } from 'aws-sigv4-fetch';
import { object, string, type ZodType } from 'zod';
import { type Environment } from './env-schema.js';
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
  tokens: Tokens | undefined;
  userId: string | undefined;
  credentials: Credentials | undefined;
  fetch: typeof fetch | undefined;

  /**
   * Construct an MI client.
   * @param env - Environment vars
   */
  constructor(env: Environment) {
    this.env = env;
    this.authClient = new Auth({
      clientId: env.CLIENT_ID,
      userPoolId: env.USER_POOL_ID,
      identityPoolId: env.IDENTITY_POOL_ID,
    });
  }

  /**
   * To authenticate a user.
   * @param param - Username and password OR refreshToken.
   * @param param.username - usually an email address.
   * @param param.password - associated with this username.
   *                   OR
   * @param param.refreshToken - Refresh token to use.
   */
  async authenticate(param: UsernamePassword | RefreshToken) {
    this.tokens = await this.authClient.getTokens(param);
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

  /**
   * To reauthenticate a user without sending parameters. Must be called after authenticate.
   */
  async reauthenticate() {
    if (!this.tokens || !this.userId) {
      throw new Error('Must authenticate before reauthenticating');
    }
    this.tokens = await this.authClient.getTokens({ refreshToken: this.tokens.refreshToken });
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

  /**
   * To call an endpoint.
   * @param path - URL path to use, not including any prefix.
   * @param outputSchema - The schema to validate the output against.
   * @param args - Additional arguments to pass.
   * @returns JSON response.
   * @hidden
   */
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
      if (parsedError.success) {
        throw new Error(`${res.status} ${parsedError.data.errorMessage}`);
      } else {
        throw new Error(`Unknown error (${res.status})`);
      }
    }
  }

  /**
   * To list the tasks.
   * @param companyName - List tasks for a specific company.
   * @returns List of tasks.
   */
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

  /**
   * To get a task by jobid.
   * @param jobid - Jobid of the task to get.
   * @returns A task.
   */
  async getTask(jobid: string): Promise<MITask> {
    return await this.callEndpoint(`/tasks/${jobid}`, GetMIOutputSchema);
  }

  /**
   * Fetch the model for a task.
   * @param task - Task to fetch the model for.
   * @returns Model.
   */
  async fetchModel(task: MITask): Promise<MIModel> {
    if (!task.modelUrl) {
      throw new Error(`Cannot load model for task ${task.jobid}: model is not ready to export`);
    }
    const res = await fetch(task.modelUrl);
    try {
      return MIModelSchema.parse(await res.json());
    } catch (err) {
      console.log('Model validation failed:', err);
      throw new Error('Model does not match expected format');
    }
  }

  /**
   * To consolidate tasks.
   * @param tasks - List of tasks to consolidate.
   * @returns Consolidated model.
   */
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

  /**
   * To submit a task.
   * @param file - File to upload.
   * @param props - The properties of the file.
   * @param props.filetype - Type of file to submit.
   * @param props.filename - Name of the file to submit.
   * @param props.companyname - Name of the company to submit the file for.
   * @returns Jobid of the task.
   */
  async submitTask(
    file: Buffer,
    props: { filetype: MIFileType; filename?: string; companyname?: string }
  ) {
    const { jobid, url } = await this.callEndpoint('/tasks', PostSubmitMIOutputSchema, {
      method: 'POST',
      body: JSON.stringify(props),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const res = await fetch(url, {
      method: 'PUT',
      body: file,
    });
    if (res.status !== 200) {
      throw new Error(`Failed to upload file: ${res.status} ${res.statusText}`);
    }
    return jobid;
  }

  /**
   * To delete a task.
   * @param task - Task to delete.
   * @returns MITask deleted.
   */
  async deleteTask(task: MITask) {
    return await this.callEndpoint(`/tasks/${task.jobid}`, DeleteMIOutputSchema, {
      method: 'DELETE',
    });
  }
}
