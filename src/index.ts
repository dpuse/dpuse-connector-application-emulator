// ── DPUse Framework
import type { AuditObjectContentOptions, AuditObjectContentResult, ConnectionNodeConfig } from '@dpuse/dpuse-shared';
import { auditObjectContentWithParser, buildFetchError, buildPreviewObjectResult } from '@dpuse/dpuse-shared';
import { ConnectorError, extractExtensionFromPath, extractPathWithoutExtension, loadTool } from '@dpuse/dpuse-shared';
import type { ConnectorInterface, ConnectorUtilities, FindObjectOptions, FindObjectResult } from '@dpuse/dpuse-shared';
import type { GetReadableStreamOptions, ListNodesOptions, ListNodesResult, ParsedRecord } from '@dpuse/dpuse-shared';
import { normalizeToError, retrieveRecordsWithParser } from '@dpuse/dpuse-shared';
import type { PreviewObjectOptions, PreviewObjectResult, RecordRetrievalTypeId } from '@dpuse/dpuse-shared';
import type { RetrieveRecordsOptions, RetrieveRecordsSummary, ToolConfig } from '@dpuse/dpuse-shared';

// ── DPUse Tools
import type { Tool as FilePreviewerTool } from '@dpuse/dpuse-tool-file-previewer';

// ── Types ────────────────────────────────────────────────────────────────────────────────────────────────────────────

type AppIndexEntry =
    | { typeId: 'folder'; childCount: number; id: string; label?: string; name: string }
    | { typeId: 'object'; id: string; label?: string; lastModifiedAt: number; mimeType: string; name: string; size: number };
type AppIndex = Record<string, AppIndexEntry[]>;

// ── Constants ────────────────────────────────────────────────────────────────────────────────────────────────────────

const INDEX_URL = 'https://sample-data-eu.dpuse.app/applicationIndex.json'; // Fetched from the bucket rather than bundled, so changing the sample files needs no connector release.
const INDEX_TIMEOUT_MS = 30_000; // A stalled index request fails after this, rather than holding up 'listNodes' and 'findObject'.
const URL_PREFIX = 'https://sample-data-eu.dpuse.app/application';

// ── Connectors ───────────────────────────────────────────────────────────────────────────────────────────────────────

export class Connector implements ConnectorInterface {
    private pendingAppIndex: Promise<AppIndex> | undefined; // The application index, loaded on first use.
    private abortController: AbortController | undefined; // The latest operation's. An operation that ends clears it only if no later one has replaced it.
    private readonly connectorUtilities: ConnectorUtilities;
    private readonly toolConfigs;

    constructor(connectorUtilities: ConnectorUtilities, toolConfigs: ToolConfig[]) {
        this.abortController = undefined;
        this.connectorUtilities = connectorUtilities;
        this.toolConfigs = toolConfigs;
    }

    // ── Actions ──────────────────────────────────────────────────────────────────────────────────────────────────────

    abortOperation(): void {
        if (!this.abortController) return;
        this.abortController.abort();
        this.abortController = undefined;
    }

    async auditObjectContent(options: AuditObjectContentOptions, chunk: (recordCount: number, byteCount: number) => void): Promise<AuditObjectContentResult> {
        const abortController = new AbortController();
        this.abortController = abortController;
        const { signal } = abortController;

        try {
            const stream = await fetchObjectStream(options.path, signal);
            return await auditObjectContentWithParser({
                constructColumnAuditor: this.connectorUtilities.constructColumnAuditor,
                onProgress: chunk,
                options,
                signal,
                stream,
                toolConfigs: this.toolConfigs
            });
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            if (this.abortController === abortController) this.abortController = undefined;
        }
    }

    async findObject(options: FindObjectOptions): Promise<FindObjectResult> {
        const appIndex = await this.loadAppIndex();
        for (const folderPath in appIndex) {
            if (!Object.hasOwn(appIndex, folderPath)) continue;

            const folderPathNodes = appIndex[folderPath];
            const folderPathNode = folderPathNodes?.find((folderPathNode) => folderPathNode.typeId === 'object' && folderPathNode.id === options.nodeId);
            if (folderPathNode) return { path: folderPath };
        }
        throw new ConnectorError(`Object '${options.nodeId}' not found.`, 'dpuse-connector-application-emulator.Connector.findObject');
    }

    async getReadableStream(options: GetReadableStreamOptions): Promise<ReadableStream<Uint8Array>> {
        const abortController = new AbortController();
        this.abortController = abortController;
        const { signal } = abortController;

        try {
            return await fetchObjectStream(options.path, signal);
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            if (this.abortController === abortController) this.abortController = undefined;
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
        const abortController = new AbortController();
        this.abortController = abortController;
        const { signal } = abortController;

        try {
            const asAt = Date.now();
            const startedAt = performance.now();

            // Preview file to determine file format and decode text.
            const filePreviewerTool = await loadTool<FilePreviewerTool>(this.toolConfigs, 'file-previewer');
            // The user's choices of format and encoding, when made, replace what detection would find.
            const filePreview = await filePreviewerTool.previewFile(`${URL_PREFIX}${options.path}`, signal, options.chunkSize, options.mimeType, undefined, {
                dataFormatId: options.dataFormatId,
                encodingId: options.encodingId
            });
            return await buildPreviewObjectResult({
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
            if (this.abortController === abortController) this.abortController = undefined;
        }
    }

    // Retrieves all records from the object node, with the tool that read its preview.
    async retrieveRecords(
        options: RetrieveRecordsOptions,
        chunk: (typeId: RecordRetrievalTypeId, records: ParsedRecord[]) => void | Promise<void>, // A returned promise holds the read back until it settles.
        complete: (result: RetrieveRecordsSummary) => void
    ): Promise<void> {
        const abortController = new AbortController();
        this.abortController = abortController;
        const { signal } = abortController;

        try {
            const stream = await fetchObjectStream(options.path, signal);
            complete(await retrieveRecordsWithParser({ chunk, options, signal, stream, toolConfigs: this.toolConfigs }));
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            if (this.abortController === abortController) this.abortController = undefined;
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
