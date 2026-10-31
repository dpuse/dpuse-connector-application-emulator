// ── DPUse Framework
import type {
    AuditObjectContentOptions,
    AuditObjectContentResult,
    ConnectionNodeConfig,
    ConnectorConfig,
    ConnectorInterface,
    ConnectorUtilities,
    FindObjectOptions,
    FindObjectResult,
    GetReadableStreamOptions,
    ListNodesOptions,
    ListNodesResult,
    ParsingRecord,
    PreviewConfig,
    PreviewObjectOptions,
    RecordRetrievalTypeId,
    RetrieveRecordsOptions,
    RetrieveRecordsSummary,
    ToolConfig
} from '@dpuse/dpuse-shared';
import {
    auditObjectContentWithParser,
    buildFetchError,
    buildPreviewConfig,
    ConnectorError,
    extractExtensionFromPath,
    extractPathWithoutExtension,
    loadTool,
    lookupMimeTypeForExtension,
    normalizeToError,
    retrieveRecordsWithParser
} from '@dpuse/dpuse-shared';

// ── DPUse Tools
import type { Tool as FilePreviewerTool } from '@dpuse/dpuse-tool-file-previewer';

// ── Data
import config from '~/config.json';

// ── Types ────────────────────────────────────────────────────────────────────────────────────────────────────────────

type AppFolderNode =
    | { typeId: 'folder'; childCount: number; id: string; label?: string; name: string }
    | { typeId: 'object'; id: string; label?: string; lastModifiedAt: number; mimeType?: string; name: string; size: number };
type AppFolderPaths = Record<string, AppFolderNode[]>;

// ── Constants ────────────────────────────────────────────────────────────────────────────────────────────────────────

const URL_PREFIX = 'https://sample-data-eu.dpuse.app/application';
const INDEX_URL = 'https://sample-data-eu.dpuse.app/applicationIndex.json';
const INDEX_TIMEOUT_MS = 30_000; // A stalled index request fails after this, rather than holding up 'listNodes' and 'findObject'.

// ── Connectors ───────────────────────────────────────────────────────────────────────────────────────────────────────

export class Connector implements ConnectorInterface {
    private applicationFolderPaths: Promise<AppFolderPaths> | undefined; // The application index, loaded on first use.
    abortController: AbortController | undefined;
    readonly config: ConnectorConfig;
    connectorUtilities: ConnectorUtilities;
    readonly toolConfigs;

    constructor(connectorUtilities: ConnectorUtilities, toolConfigs: ToolConfig[]) {
        this.abortController = undefined;
        this.config = config as ConnectorConfig;
        this.connectorUtilities = connectorUtilities;
        this.toolConfigs = toolConfigs;
    }

    // ── Actions ──────────────────────────────────────────────────────────────────────────────────────────────────────

    abortOperation(): void {
        if (!this.abortController) return;
        this.abortController.abort();
        this.abortController = undefined;
    }

    async auditObjectContent(options: AuditObjectContentOptions, chunk: (recordCount: number) => void): Promise<AuditObjectContentResult> {
        const { signal } = (this.abortController = new AbortController());

        try {
            const stream = await fetchObjectStream(options.path, signal);
            const contentAuditConfig = await auditObjectContentWithParser({
                constructColumnAuditor: this.connectorUtilities.constructColumnAuditor,
                onProgress: chunk,
                options,
                signal,
                stream,
                toolConfigs: this.toolConfigs
            });
            return { contentAuditConfig };
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }

    // Find the folder path containing the specified object node
    async findObject(options: FindObjectOptions): Promise<FindObjectResult> {
        const appFolderPaths = await this.loadApplicationFolderPaths();
        // Loop through the folder path data checking for an object entry with an identifier equal to the object name.
        for (const folderPath in appFolderPaths) {
            if (!Object.hasOwn(appFolderPaths, folderPath)) continue;

            const folderPathNodes = appFolderPaths[folderPath];
            const folderPathNode = folderPathNodes?.find((folderPathNode) => folderPathNode.typeId === 'object' && folderPathNode.id === options.nodeId);
            if (folderPathNode) return { path: folderPath }; // Found, return folder path.
        }
        throw new ConnectorError(`Object '${options.nodeId}' not found.`, 'dpuse-connector-application-emulator|Connector|findObject');
    }

    // Get a readable stream for the specified object node path
    async getReadableStream(options: GetReadableStreamOptions): Promise<ReadableStream<Uint8Array>> {
        // Create an abort controller and extract its signal.
        const { signal } = (this.abortController = new AbortController());

        try {
            return await fetchObjectStream(options.path, signal);
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }

    // Lists all nodes (folders and objects) in the specified folder path
    async listNodes(options: ListNodesOptions): Promise<ListNodesResult> {
        const appFolderPaths = await this.loadApplicationFolderPaths();
        const folderNodes = appFolderPaths[options.folderPath] ?? [];
        const connectionNodeConfigs: ConnectionNodeConfig[] = folderNodes.map((folderNode) =>
            folderNode.typeId === 'folder'
                ? constructFolderNodeConfig(options.folderPath, folderNode.id, folderNode.name, folderNode.childCount, folderNode.label)
                : constructObjectNodeConfig(options.folderPath, folderNode.id, folderNode.name, folderNode.lastModifiedAt, folderNode.size, folderNode.mimeType, folderNode.label)
        );
        return { cursor: undefined, isMore: false, connectionNodeConfigs, totalCount: connectionNodeConfigs.length };
    }

    // Preview the contents of the object node with the specified path
    async previewObject(options: PreviewObjectOptions): Promise<PreviewConfig> {
        // Create an abort controller and extract its signal.
        const { signal } = (this.abortController = new AbortController());

        try {
            const asAt = Date.now();
            const startedAt = performance.now();

            // Preview file to determine file format and decode text.
            const filePreviewerTool = await loadTool<FilePreviewerTool>(this.toolConfigs, 'file-previewer');
            const filePreview = await filePreviewerTool.previewFile(`${URL_PREFIX}${options.path}`, signal, options.chunkSize, options.mimeType, undefined, {
                dataFormatId: options.dataFormatId,
                encodingId: options.encodingId
            }); // The user's choices, when made, replace what detection would find.
            return await buildPreviewConfig({
                asAt,
                filePreview,
                inferDataTypes: this.connectorUtilities.inferDataTypes,
                parserId: options.parserId,
                startedAt,
                toolConfigs: this.toolConfigs,
                valueDelimiterId: options.valueDelimiterId
            });
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }

    // Retrieves all records from the object node, with the tool that read its preview.
    async retrieveRecords(
        options: RetrieveRecordsOptions,
        chunk: (typeId: RecordRetrievalTypeId, records: ParsingRecord[]) => void,
        complete: (result: RetrieveRecordsSummary) => void
    ): Promise<void> {
        const { signal } = (this.abortController = new AbortController());

        try {
            const stream = await fetchObjectStream(options.path, signal);
            complete(await retrieveRecordsWithParser({ chunk, options, signal, stream, toolConfigs: this.toolConfigs }));
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

    // Loads the application index once, from beside the files it lists, so it always matches them.
    private loadApplicationFolderPaths(): Promise<AppFolderPaths> {
        this.applicationFolderPaths ??= this.fetchApplicationFolderPaths();
        return this.applicationFolderPaths;
    }

    // A failed fetch is not kept, so the next call tries again.
    private async fetchApplicationFolderPaths(): Promise<AppFolderPaths> {
        try {
            const response = await fetch(INDEX_URL, { signal: AbortSignal.timeout(INDEX_TIMEOUT_MS) });
            if (!response.ok)
                throw await buildFetchError(response, 'Failed to fetch the application index.', 'dpuse-connector-application-emulator|Connector|fetchApplicationFolderPaths');
            return (await response.json()) as AppFolderPaths;
        } catch (error) {
            this.applicationFolderPaths = undefined;
            throw normalizeToError(error);
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// Fetches an object's content. Aborting the signal stops the fetch and the reading of the stream it returns.
async function fetchObjectStream(path: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(encodeURI(`${URL_PREFIX}${path}`), { signal }); // Encoded as the file previewer encodes its URL.
    if (!response.ok) throw await buildFetchError(response, `Failed to fetch '${path}' file.`, 'dpuse-connector-application-emulator|fetchObjectStream');
    if (response.body == null)
        throw new ConnectorError('Readable streams are not supported in this runtime.', 'dpuse-connector-application-emulator|fetchObjectStream.unsupported');
    return response.body;
}

// Construct folder node configuration. The index's label, when it has one, shows the folder as a group of tables.
function constructFolderNodeConfig(folderPath: string, id: string, name: string, childCount: number, label = name): ConnectionNodeConfig {
    return {
        childCount,
        childNodes: [],
        description: '',
        extension: undefined,
        folderPath,
        handle: undefined,
        icon: null,
        iconDark: null,
        id,
        label,
        lastModifiedAt: undefined,
        mimeType: undefined,
        name,
        size: undefined,
        typeId: 'folder'
    };
}

// Construct object (file) node configuration. The index's label, when it has one, shows the file as a table.
function constructObjectNodeConfig(
    folderPath: string,
    id: string,
    fullName: string,
    lastModifiedAt: number,
    size: number,
    mimeType: string | undefined,
    label = fullName
): ConnectionNodeConfig {
    const name = extractPathWithoutExtension(fullName) ?? '';
    const extension = extractExtensionFromPath(fullName);
    return {
        childCount: undefined,
        childNodes: [],
        description: '',
        extension,
        folderPath,
        handle: undefined,
        icon: null,
        iconDark: null,
        id,
        label,
        lastModifiedAt,
        mimeType: mimeType ?? lookupMimeTypeForExtension(extension), // The index's type, which matches what the bucket serves.
        name,
        size,
        typeId: 'object'
    };
}
