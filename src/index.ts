// ── DPUse Framework
import type { AuditObjectContentOptions, AuditObjectContentResult, ConnectionNodeConfig } from '@dpuse/dpuse-shared';
import { auditObjectContentWithParser, buildFetchError, buildPreviewObjectResult } from '@dpuse/dpuse-shared';
import { ConnectorError, extractExtensionFromPath, extractPathWithoutExtension, loadTool } from '@dpuse/dpuse-shared';
import type { ConnectorInterface, ConnectorUtilities, FilePreviewerInterface } from '@dpuse/dpuse-shared';
import type { FindObjectOptions, FindObjectResult, GetReadableStreamOptions } from '@dpuse/dpuse-shared';
import type { ListNodesOptions, ListNodesResult } from '@dpuse/dpuse-shared';
import { normalizeToError, readTableSchema, resolveRequestSignal, retrieveRecordsWithParser } from '@dpuse/dpuse-shared';
import type { ParsedRecordsChunk, PreviewObjectOptions, PreviewObjectResult, RetrieveRecordsOptions } from '@dpuse/dpuse-shared';
import type { RetrieveRecordsSummary, ToolConfig } from '@dpuse/dpuse-shared';

// ── Types ────────────────────────────────────────────────────────────────────────────────────────────────────────────

type AppIndexEntry =
    | { typeId: 'folder'; childCount: number; id: string; label?: string; name: string }
    | { typeId: 'object'; id: string; label?: string; lastModifiedAt: number; mimeType: string; name: string; size: number };
type AppIndex = Record<string, AppIndexEntry[]>;
type TableResource = ReturnType<typeof readTableSchema>;

// ── Constants ────────────────────────────────────────────────────────────────────────────────────────────────────────

const INDEX_URL = 'https://sample-data-eu.dpuse.app/applicationIndex.json'; // Fetched from the bucket rather than bundled, so changing the sample files needs no connector release.
const INDEX_TIMEOUT_MS = 30_000; // A stalled index request fails after this, rather than holding up 'listNodes' and 'findObject'.
const URL_PREFIX = 'https://sample-data-eu.dpuse.app/application';
const RESOURCE_FILE_SUFFIX = '.resource.json'; // A table's Data Resource sits beside it, e.g. 'people.resource.json' for 'people.csv'.

// ── Connectors ───────────────────────────────────────────────────────────────────────────────────────────────────────

export class Connector implements ConnectorInterface {
    private pendingAppIndex: Promise<AppIndex> | undefined; // The application index, loaded on first use.
    private readonly connectorUtilities: ConnectorUtilities;
    private readonly toolConfigs;

    constructor(connectorUtilities: ConnectorUtilities, toolConfigs: ToolConfig[]) {
        this.connectorUtilities = connectorUtilities;
        this.toolConfigs = toolConfigs;
    }

    // ── Actions ──────────────────────────────────────────────────────────────────────────────────────────────────────

    async auditObjectContent(options: AuditObjectContentOptions, chunk: (recordCount: number, byteCount: number) => void): Promise<AuditObjectContentResult> {
        const signal = resolveRequestSignal(options);

        try {
            const tableResource = await fetchTableResource(options.path, signal); // The options already read the table as its resource says, because they come from its preview.
            const stream = await fetchObjectStream(options.path, signal);
            return await auditObjectContentWithParser({
                constructColumnAuditor: this.connectorUtilities.constructColumnAuditor,
                declaredColumnConfigs: tableResource?.declaredColumnConfigs,
                onProgress: chunk,
                options,
                signal,
                stream,
                toolConfigs: this.toolConfigs
            });
        } catch (error) {
            throw normalizeToError(error);
        }
    }

    async findObject(options: FindObjectOptions): Promise<FindObjectResult> {
        const appIndex = await this.loadAppIndex();
        for (const folderPath in appIndex) {
            if (!Object.hasOwn(appIndex, folderPath)) continue;

            const folderPathNodes = appIndex[folderPath];
            const folderPathNode = folderPathNodes?.find((folderPathNode) => folderPathNode.typeId === 'object' && folderPathNode.id === options.id);
            if (folderPathNode) return { path: `${folderPath}/${folderPathNode.name}` };
        }
        throw new ConnectorError(`Object '${options.id}' not found.`, 'dpuse-connector-application-emulator.Connector.findObject');
    }

    async getReadableStream(options: GetReadableStreamOptions): Promise<ReadableStream<Uint8Array>> {
        const signal = resolveRequestSignal(options);

        try {
            return await fetchObjectStream(options.path, signal);
        } catch (error) {
            throw normalizeToError(error);
        }
    }

    // Lists the folders and files directly inside the folder.
    async listNodes(options: ListNodesOptions): Promise<ListNodesResult> {
        const appIndex = await this.loadAppIndex();
        const folderNodes = appIndex[options.folderPath] ?? [];
        const connectionNodeConfigs: ConnectionNodeConfig[] = folderNodes.map((folderNode) =>
            folderNode.typeId === 'folder'
                ? constructFolderNodeConfig(options.folderPath, folderNode.id, folderNode.name, folderNode.childCount, folderNode.label)
                : constructObjectNodeConfig(options.folderPath, folderNode.id, folderNode.name, folderNode.lastModifiedAt, folderNode.size, folderNode.mimeType, folderNode.label)
        );
        return { cursor: undefined, isMore: false, connectionNodeConfigs, totalCount: connectionNodeConfigs.length };
    }

    async previewObject(options: PreviewObjectOptions): Promise<PreviewObjectResult> {
        const signal = resolveRequestSignal(options);

        try {
            const asAt = Date.now();
            const startedAt = performance.now();

            // A table's resource says how it is read, in place of the user's choices and of detection. A table without one is
            // read as the user chose, or as detected.
            const tableResource = await fetchTableResource(options.path, signal);
            const declaredReadingConfig = tableResource?.declaredReadingConfig;
            const filePreviewerTool = await loadTool<FilePreviewerInterface>(this.toolConfigs, 'file-previewer');
            const filePreview = await filePreviewerTool.previewFile(
                `${URL_PREFIX}${options.path}`,
                signal,
                options.chunkSize,
                options.mimeType,
                declaredReadingConfig?.encodingId ?? options.encodingId
            );
            return await buildPreviewObjectResult({
                asAt,
                declaredColumnConfigs: tableResource?.declaredColumnConfigs,
                declaredReadingConfig,
                filePreview,
                inferDataTypes: this.connectorUtilities.inferDataTypes,
                readingChoiceConfig: {
                    dataFormatId: options.dataFormatId,
                    encodingId: options.encodingId,
                    hasHeaders: undefined,
                    parserId: options.parserId,
                    valueDelimiterId: options.valueDelimiterId // Replaced by the resource's delimiter, when it gives one.
                },
                startedAt,
                toolConfigs: this.toolConfigs
            });
        } catch (error) {
            throw normalizeToError(error);
        }
    }

    // Retrieves all records from the object node, with the tool that read its preview.
    async *retrieveRecords(options: RetrieveRecordsOptions): AsyncGenerator<ParsedRecordsChunk, RetrieveRecordsSummary, undefined> {
        const signal = resolveRequestSignal(options);

        try {
            const stream = await fetchObjectStream(options.path, signal);
            return yield* retrieveRecordsWithParser({ options, signal, stream, toolConfigs: this.toolConfigs });
        } catch (error) {
            throw normalizeToError(error);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

    // Fetches the application index on first use. Later calls, including ones made while the fetch is running, share it.
    private loadAppIndex(): Promise<AppIndex> {
        this.pendingAppIndex ??= this.fetchAppIndex();
        return this.pendingAppIndex;
    }

    // A failed fetch is not kept, so the next call tries again.
    private async fetchAppIndex(): Promise<AppIndex> {
        try {
            const response = await fetch(INDEX_URL, { signal: AbortSignal.timeout(INDEX_TIMEOUT_MS) });
            if (!response.ok) throw await buildFetchError(response, 'Failed to fetch the application index.', 'dpuse-connector-application-emulator.Connector.fetchAppIndex');
            return (await response.json()) as AppIndex; // Not validated, because dpuse-resources generates the index ('scripts/buildIndexes.ts').
        } catch (error) {
            this.pendingAppIndex = undefined;
            if (error instanceof Error && error.name === 'TimeoutError') {
                const message = `Failed to fetch the application index within ${String(INDEX_TIMEOUT_MS / 1000)} seconds.`;
                throw new ConnectorError(message, 'dpuse-connector-application-emulator.Connector.fetchAppIndex.timeout', undefined, { cause: error });
            }
            throw normalizeToError(error);
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// Fetches an object's content. Aborting the signal stops the fetch and the reading of the stream it returns.
async function fetchObjectStream(path: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(encodeURI(`${URL_PREFIX}${path}`), { signal }); // Encoded the same way the file previewer encodes its URL, so both fetch the same file. 'encodeURI' leaves '#' and '?' as they are, but the files are managed in dpuse-resources and no name holds them.
    if (!response.ok) throw await buildFetchError(response, `Failed to fetch '${path}' file.`, 'dpuse-connector-application-emulator.fetchObjectStream');
    if (response.body == null)
        throw new ConnectorError('Readable streams are not supported in this runtime.', 'dpuse-connector-application-emulator.fetchObjectStream.unsupported');
    return response.body;
}

// Fetches the Data Resource beside a table and reads how the table is read and the columns it holds. A table without one
// is read as any file is, so a missing resource is not an error.
async function fetchTableResource(path: string, signal: AbortSignal): Promise<TableResource | undefined> {
    const resourcePath = `${extractPathWithoutExtension(path) ?? path}${RESOURCE_FILE_SUFFIX}`;
    const response = await fetch(encodeURI(`${URL_PREFIX}${resourcePath}`), { signal }); // Encoded as the table's own URL is.
    if (response.status === 404) return undefined;
    if (!response.ok) throw await buildFetchError(response, `Failed to fetch '${resourcePath}' resource.`, 'dpuse-connector-application-emulator.fetchTableResource');
    return readTableSchema((await response.json()) as Parameters<typeof readTableSchema>[0]); // Checked by 'readTableSchema', which rejects a resource without a valid schema.
}

// The index's label, when it has one, shows the folder as a group of tables.
function constructFolderNodeConfig(folderPath: string, id: string, name: string, childCount: number, label = name): ConnectionNodeConfig {
    return {
        childCount,
        description: '',
        extension: undefined,
        folderPath,
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

// The index's label, when it has one, shows the file as a table.
function constructObjectNodeConfig(
    folderPath: string,
    id: string,
    fullName: string,
    lastModifiedAt: number,
    size: number,
    mimeType: string,
    label = fullName
): ConnectionNodeConfig {
    const name = extractPathWithoutExtension(fullName) ?? '';
    const extension = extractExtensionFromPath(fullName);
    return {
        childCount: undefined,
        description: '',
        extension,
        folderPath,
        icon: null,
        iconDark: null,
        id,
        label,
        lastModifiedAt,
        mimeType, // The index's type, which matches what the bucket serves.
        name,
        size,
        typeId: 'object'
    };
}
