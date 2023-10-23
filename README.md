# Scribe Private Documents (MI) SDK

A Node library designed to facilitate accessing Scribe's Private Documents (MI) API.

## Installation

```
npm install @scribelabsai/mi
```

## Usage

### Construct client

The constructor expects an environment object:

```
const EnvironmentSchema = object({
  API_URL: string(),
  IDENTITY_POOL_ID: string(),
  USER_POOL_ID: string(),
  CLIENT_ID: string(),
  REGION: string(),
});
```

The `API_URL` is `"mi.scribelabs.ai/v1"`.

The `REGION` is `"eu-west-2"`.

Contact Scribe to obtain other details required for authentication.

```TypeScript
import { ScribeMIClient } from '@scribelabsai/mi';

const client = new ScribeMIClient({
  API_URL: 'mi.scribelabs.ai/v1',
  REGION: 'eu-west-2',
  IDENTITY_POOL_ID: 'Contact Scribe for authentication details',
  USER_POOL_ID: 'Contact Scribe for authentication details',
  CLIENT_ID: 'Contact Scribe for authentication details',
});
```

### Authenticate

Authentication is handled by [Scribe's Auth library](https://github.com/ScribeLabsAI/ScribeAuthNode/blob/master/README.md), without the need for you to call that library directly.

```TypeScript
// Authenticate with username / password
await client.authenticate({ username: 'myUsername', password: 'myPassword' });

// OR with refresh token
await client.authenticate({ refreshToken: 'myRefreshToken' });
```

The MI client will try to automatically re-authenticate with your refresh token, if you try to make an API call after credentials have expired.

### Submit a document for processing

```TypeScript
const jobid: string = await client.submitTask(myFileBuffer, {
  filetype: 'pdf',
  filename: 'example-co-2023-q1.pdf',
  companyname: 'Example Co Ltd',
});
```

The `filetype` parameter is required: it should match the file's extension / MIME type.

Other parameters are optional:

- `filename` is recommended: it should be the name of the uploaded file. It appears in API responses and the web UI.
- `companyname` can optionally be included for company Financials data: it should be the legal name of the company this document describes, so that documents relating to the same company can be collated.

The returned `jobid` can be used to find information about the task status via `getTask`, or via the web UI.

### View tasks

Fetch details of an individual task:

```TypeScript
const task: MITask = await client.getTask(jobid);
console.log(task.status);
```

Or list all tasks:

```TypeScript
const tasks: MITask[] = await client.listTasks();
```

### Export output models

After documents have been processed by Scribe, the task status (which can be seen via `getTask` / `listTasks`) is `"SUCCESS"`. At this point, you can export the model:

```TypeScript
const task = await client.getTask(jobid);

// Use fetchModel
const model: MIModel = await client.fetchModel(task);

// Alternatively, fetch the model directly from its URL
return task.modelUrl;
```

In either case, note that the model is accessed via a pre-signed URL, which is only valid for a limited time after calling `getTask` / `listTasks`.

#### Collate fund data

When using Scribe to process fund data, multiple models can be consolidated for export in a single file:

```TypeScript
const tasks = await client.listTasks();
const tasksToCollate = tasks.filter(
  (task) => task.status === 'SUCCESS' && task.originalFilename.startsWith('Fund_1')
);

const collatedModel = await client.consolidateTasks(tasksToCollate);
```

### Delete tasks / cancel processing

```TypeScript
const task = await client.getTask(jobid);

await client.deleteTask(task);
```

Deletion is irreversible.

After a successful deletion, the file, any output model, and any other file derived from the input are deleted permanently from Scribe's servers.

## See also

Documentation for the underlying REST API may also be useful, although we recommend accessing the API via this library or our Python SDK.

- [REST API documentation](https://scribelabs.ai/docs/docs-mi)

- [Python SDK](https://github.com/ScribeLabsAI/ScribeMi)
