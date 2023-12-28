import {
  literal,
  number,
  object,
  record,
  string,
  union,
  enum as zenum,
  infer as zinfer,
} from 'zod';

export const mimemap = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export type MIFileType = keyof typeof mimemap;

export const MIAllowedFileTypes = [
  'pdf',
  'xlsx',
  'xls',
  'xlsm',
  'doc',
  'docx',
  'ppt',
  'pptx',
] as const satisfies readonly MIFileType[];

export const MIFiletypeSchema = zenum(MIAllowedFileTypes);

const JobIdSchema = string();

const MITaskSchema = object({
  jobid: JobIdSchema,
  client: string(),
  companyName: string().optional(),
  clientFilename: string().optional(),
  originalFilename: string().optional(),
  clientModelFilename: string().optional(),
  modelFilename: string().optional(),
  status: zenum(['SUCCESS', 'DELETED', 'PENDING_UPLOAD', 'PROCESSING']),
  submitted: number().int().positive(),
  modelUrl: string().url().optional(),
}).strict();
export type MITask = zinfer<typeof MITaskSchema>;

const MIPortfolioItemBaseSchema = object({
  client: string(),
  companyName: string(),
  jobids: JobIdSchema.array(),
}).strict();
export const MIPortfolioItemSchema = union([
  MIPortfolioItemBaseSchema.extend({ modelFilename: string().optional() }).strict(),
  MIPortfolioItemBaseSchema.extend({ modelUrl: string().url().optional() }).strict(),
]);
export type MIPortfolioItem = zinfer<typeof MIPortfolioItemSchema>;

export const ItemSchema = object({
  tag: string(),
  term: string(),
  ogterm: string(),
  values: record(
    string(),
    union([
      string(),
      number(),
      object({
        value: string().or(number()),
        bbox: union([
          literal(''),
          string().regex(/^\d+(?:;-?\d+(?:\.\d+)?){4}$/), // page;x;y;w;h
        ]).optional(),
      }).strict(),
    ])
  ),
}).strict();
export type Item = zinfer<typeof ItemSchema>;

export const MIModelFinancialsSchema = object({
  company: string().min(1),
  dateReporting: string().regex(/^\d{4}-\d{2}-\d{2}$/),
  covering: string(),
  items: ItemSchema.array(),
}).strict();
export type MIModelFinancials = zinfer<typeof MIModelFinancialsSchema>;

export const MIModelFundPerformanceSchema = object({
  date: string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tables: object({
    title: string(),
    columnsOrder: string().array(),
    items: ItemSchema.array(),
  }).array(),
}).strict();
export type MIModelFundPerformance = zinfer<typeof MIModelFundPerformanceSchema>;

export const MIModelSchema = union([MIModelFinancialsSchema, MIModelFundPerformanceSchema]);
export type MIModel = zinfer<typeof MIModelSchema>;

export const MICollatedModelFundPerformanceSchema = MIModelFundPerformanceSchema;
export type MICollatedModelFundPerformance = zinfer<typeof MICollatedModelFundPerformanceSchema>;

/****************************************/
/************* PostSubmitMI *************/
/****************************************/
export const PostSubmitMIOutputSchema = object({
  jobid: JobIdSchema,
  url: string().url(),
}).strict();
export type PostSubmitMIOutput = zinfer<typeof PostSubmitMIOutputSchema>;

/**************************************/
/************* GetListMIs *************/
/**************************************/
export const GetListMIsOutputSchema = object({
  tasks: MITaskSchema.array(),
}).strict();

/**************************************/
/**************** GetMI ***************/
/**************************************/
export const GetMIOutputSchema = MITaskSchema;
export type GetMIOutput = zinfer<typeof GetMIOutputSchema>;

/**************************************/
/************** DeleteMI **************/
/**************************************/
export const DeleteMIOutputSchema = MITaskSchema;
export type DeleteMIOutput = zinfer<typeof DeleteMIOutputSchema>;

/**************************************/
/*********** GetPortfolioFund *********/
/**************************************/
export const GetPortfolioFundPerformanceOutputSchema = object({
  model: MIModelFundPerformanceSchema,
}).strict();
export type GetPortfolioFundPerformanceOutput = zinfer<
  typeof GetPortfolioFundPerformanceOutputSchema
>;
