import { AuditObjectContentOptions, AuditObjectContentResult, ConnectorConfig, ConnectorInterface, ConnectorUtilities, FindObjectOptions, FindObjectResult, GetReadableStreamOptions, ListNodesOptions, ListNodesResult, PreviewObjectOptions, RecordRetrievalTypeId, RetrieveRecordsOptions, RetrieveRecordsSummary } from '@dpuse/dpuse-shared/component/module/connector';
import { ToolConfig } from '@dpuse/dpuse-shared/component/module/tool';
import { ParsingRecord, PreviewConfig } from '@dpuse/dpuse-shared/component/dataView';
export declare class Connector implements ConnectorInterface {
    abortController: AbortController | undefined;
    readonly config: ConnectorConfig;
    connectorUtilities: ConnectorUtilities;
    readonly toolConfigs: ToolConfig[];
    constructor(connectorUtilities: ConnectorUtilities, toolConfigs: ToolConfig[]);
    abortOperation(): void;
    auditObjectContent(options: AuditObjectContentOptions, chunk: (rowCount: number) => void): Promise<AuditObjectContentResult>;
    findObject(options: FindObjectOptions): Promise<FindObjectResult>;
    getReadableStream(options: GetReadableStreamOptions): Promise<ReadableStream<Uint8Array>>;
    listNodes(options: ListNodesOptions): Promise<ListNodesResult>;
    previewObject(options: PreviewObjectOptions): Promise<PreviewConfig>;
    retrieveRecords(options: RetrieveRecordsOptions, chunk: (typeId: RecordRetrievalTypeId, records: ParsingRecord[]) => void, complete: (result: RetrieveRecordsSummary) => void): Promise<void>;
}
