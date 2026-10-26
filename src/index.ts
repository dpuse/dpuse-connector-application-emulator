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
    RecordDelimiterId,
    RecordRetrievalTypeId,
    RetrieveRecordsOptions,
    RetrieveRecordsSummary,
    ToolConfig,
    ValueDelimiterId
} from '@dpuse/dpuse-shared';
import {
    buildFetchError,
    ConnectorError,
    extractExtensionFromPath,
    extractPathWithoutExtension,
    loadTool,
    lookupMimeTypeForExtension,
    normalizeToError,
    ORDERED_VALUE_DELIMITER_IDS
} from '@dpuse/dpuse-shared';

// ── DPUse Tools
import type { Tool as CSVParseTool } from '@dpuse/dpuse-tool-adaltas-csv-parser';
import type { Tool as FileOperatorsTool } from '@dpuse/dpuse-tool-file-previewer';
import type { Tool as RustCsvCoreTool } from '@dpuse/dpuse-tool-rust-csv-core-parser';

// ── Data
import config from '~/config.json';

/**
 * File store folder paths.
 */
// eslint-disable-next-line unicorn/name-replacements -- Prefer ApplicationFolderNode to AppFolderNode
type ApplicationFolderNode =
    | ({ typeId: 'folder'; childCount: number; id: string } & { label?: string; name: string })
    | ({ typeId: 'object'; id: string; lastModifiedAt: number; mimeType?: string; size: number } & { label?: string; name: string });

/**
 * File store folder paths.
 */
// eslint-disable-next-line unicorn/name-replacements -- Prefer ApplicationFolderPath to AppFolderPath.
type ApplicationFolderPaths = Record<string, ApplicationFolderNode[]>;

/**
 * Cloudflare R2 file store directory prefix.
 */
const URL_PREFIX = 'https://sample-data-eu.dpuse.app/application';

// Lists the application folder's folders and files, published with them.
const INDEX_URL = 'https://sample-data-eu.dpuse.app/applicationIndex.json';

// Text the previewer takes as delimited is read as delimited even when no delimiter is found, such as a single column
// or rows that split unevenly. It is then read with these, the most common ones. An empty file is read with them too.
const DEFAULT_RECORD_DELIMITER_ID: RecordDelimiterId = '\n';
const DEFAULT_VALUE_DELIMITER_ID: ValueDelimiterId = ',';

// Connectors
export class Connector implements ConnectorInterface {
    #applicationFolderPaths: Promise<ApplicationFolderPaths> | undefined; // The application index, loaded on first use.
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

    // ── Operations ───────────────────────────────────────────────────────────────────────────────────────────────────

    // Abort the currently running operation
    abortOperation(): void {
        if (!this.abortController) return;
        this.abortController.abort();
        this.abortController = undefined;
    }

    // Audit object content
    async auditObjectContent(options: AuditObjectContentOptions, chunk: (rowCount: number) => void): Promise<AuditObjectContentResult> {
        this.abortController = new AbortController();

        try {
            if (options.parsingToolName === 'dpuse-tool-rust-csv-core-parser') {
                // Get the readable stream
                const stream = await this.getReadableStream({ id: '', path: options.path });

                // Load the Rust CSV core tool
                const rustCsvTool = await loadTool<RustCsvCoreTool>(this.toolConfigs, 'rust-csv-core-parser');

                // Choose processing mode based on browser capability
                const options2 = { delimiter: ',', hasHeaders: true };
                const result = options.supportsTransferableStreams
                    ? await rustCsvTool.processWithTransferableStream(stream, options2, chunk)
                    : await rustCsvTool.processWithChunks(stream, options2, chunk);

                return { processedRowCount: result.processedRowCount, durationMs: result.durationMs ?? 0 };
            }

            const csvParseTool = await loadTool<CSVParseTool>(this.toolConfigs, 'adaltas-csv-parser');
            const parseStreamOptions = { delimiter: options.valueDelimiterId, relax_column_count: true };
            const url = `${URL_PREFIX}${options.path}`;
            const summary = await csvParseTool.parseStream(options, parseStreamOptions, url, this.abortController, (parameter) => {
                console.log(parameter);
            });
            console.log('summary', summary);
            // complete(summary);

            return { processedRowCount: 0, durationMs: 0 };
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }

    // Find the folder path containing the specified object node
    async findObject(options: FindObjectOptions): Promise<FindObjectResult> {
        const fileStoreFolderPaths = await this.loadApplicationFolderPaths();
        // Loop through the folder path data checking for an object entry with an identifier equal to the object name.
        for (const folderPath in fileStoreFolderPaths) {
            if (!Object.hasOwn(fileStoreFolderPaths, folderPath)) continue;

            const folderPathNodes = fileStoreFolderPaths[folderPath];
            const folderPathNode = folderPathNodes?.find((folderPathNode) => folderPathNode.typeId === 'object' && folderPathNode.id === options.nodeId);
            if (folderPathNode) return { path: folderPath }; // Found, return folder path.
        }
        throw new Error('Not found.'); // Not found.
    }

    // Get a readable stream for the specified object node path
    async getReadableStream(options: GetReadableStreamOptions): Promise<ReadableStream<Uint8Array>> {
        // Create an abort controller and extract its signal.
        const { signal } = (this.abortController = new AbortController());

        try {
            const response = await fetch(`${URL_PREFIX}${options.path}`, { signal });
            if (!response.ok) {
                throw await buildFetchError(response, `Failed to fetch '${options.path}' file.`, 'dpuse-connector-application-emulator|Connector|getReadableStream');
            }
            if (response.body == null) {
                throw new ConnectorError('Readable streams are not supported in this runtime.', 'dpuse-connector-application-emulator|Connector|getReadableStream.unsupported');
            }
            return response.body;
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }

    // Lists all nodes (folders and objects) in the specified folder path
    async listNodes(options: ListNodesOptions): Promise<ListNodesResult> {
        const fileStoreFolderPaths = await this.loadApplicationFolderPaths();
        const folderNodes = fileStoreFolderPaths[options.folderPath] ?? [];
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
            const fileOperatorsTool = await loadTool<FileOperatorsTool>(this.toolConfigs, 'file-previewer');
            const filePreviewResult = await fileOperatorsTool.previewFile(`${URL_PREFIX}${options.path}`, signal, options.chunkSize, options.mimeType, undefined, {
                dataFormatId: options.dataFormatId,
                encodingId: options.encodingId
            }); // The user's choices, when made, replace what detection would find.
            // An empty file is a table with no rows. An issue says so, because it is not an error but the user should know
            // why there is nothing to show.
            if (filePreviewResult.bytes.length === 0) {
                return {
                    asAt,
                    columnConfigs: [],
                    dataFormatId: 'dtv',
                    duration: performance.now() - startedAt,
                    encodingId: undefined,
                    encodingConfidenceLevel: undefined,
                    fileType: undefined,
                    hasHeaders: false,
                    recordDelimiterId: DEFAULT_RECORD_DELIMITER_ID,
                    parsedRecords: [],
                    inferenceRecords: [],
                    issues: [{ id: 'empty', lineNumber: undefined, message: 'The file is empty.', severityId: 'info' }],
                    size: 0,
                    text: undefined,
                    valueDelimiterId: DEFAULT_VALUE_DELIMITER_ID
                };
            }
            // Only delimited text is parsed. Any other format comes back as itself with no records, rather than as an error:
            // markdown, which is a document, JSON and JSON Lines, which have no reader yet, and a type the app cannot read,
            // which comes back as 'unknown'. The text is kept so the picker can still show it.
            if (filePreviewResult.dataFormatId !== 'dtv' || filePreviewResult.text == null) {
                return {
                    asAt,
                    columnConfigs: [],
                    dataFormatId: filePreviewResult.dataFormatId ?? 'unknown',
                    duration: performance.now() - startedAt,
                    encodingId: filePreviewResult.encodingId,
                    encodingConfidenceLevel: filePreviewResult.encodingConfidenceLevel,
                    fileType: filePreviewResult.fileTypeConfig,
                    hasHeaders: undefined,
                    recordDelimiterId: undefined,
                    parsedRecords: [],
                    inferenceRecords: [],
                    issues: [],
                    size: filePreviewResult.bytes.length,
                    text: filePreviewResult.text,
                    valueDelimiterId: undefined
                };
            }

            // Parse text, identify delimiters, and produce string value records. With no delimiter found, the text is parsed
            // again with the default, so the records match the delimiter reported. Whether the preview holds the whole file
            // decides if a quote left open at its end is an error, or a value the preview cut off.
            const csvParseTool = await loadTool<CSVParseTool>(this.toolConfigs, 'adaltas-csv-parser');
            const detectedParseTextResult = await csvParseTool.parseText(filePreviewResult.text, ORDERED_VALUE_DELIMITER_IDS, filePreviewResult.isComplete);
            const parseTextResult =
                detectedParseTextResult.valueDelimiterId == null
                    ? await csvParseTool.parseText(filePreviewResult.text, [DEFAULT_VALUE_DELIMITER_ID], filePreviewResult.isComplete)
                    : detectedParseTextResult;

            // Infer and cast values for each parsed record.
            const inferenceSummary = this.connectorUtilities.inferDataTypes(parseTextResult.parsedRecords);

            return {
                asAt,
                columnConfigs: inferenceSummary.columnConfigs,
                dataFormatId: filePreviewResult.dataFormatId,
                duration: performance.now() - startedAt,
                encodingId: filePreviewResult.encodingId,
                encodingConfidenceLevel: filePreviewResult.encodingConfidenceLevel,
                fileType: filePreviewResult.fileTypeConfig,
                hasHeaders: inferenceSummary.hasHeaderRow,
                recordDelimiterId: parseTextResult.recordDelimiterId,
                parsedRecords: parseTextResult.parsedRecords,
                inferenceRecords: inferenceSummary.typedRecords,
                issues: parseTextResult.issues, // Records the parser could not read. The text is still returned, so the user can see them.
                size: filePreviewResult.bytes.length,
                text: filePreviewResult.text,
                valueDelimiterId: parseTextResult.valueDelimiterId ?? DEFAULT_VALUE_DELIMITER_ID
            };
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }
    // Retrieves all records from a CSV object node using streaming and chunked processing
    async retrieveRecords(
        options: RetrieveRecordsOptions,
        chunk: (typeId: RecordRetrievalTypeId, records: ParsingRecord[]) => void,
        complete: (result: RetrieveRecordsSummary) => void
    ): Promise<void> {
        this.abortController = new AbortController();
        try {
            const csvParseTool = await loadTool<CSVParseTool>(this.toolConfigs, 'adaltas-csv-parser');
            const parseStreamOptions = { delimiter: options.valueDelimiterId, info: true, relax_column_count: true };
            const url = `${URL_PREFIX}${options.path}`;
            const summary = await csvParseTool.parseStream(options, parseStreamOptions, url, this.abortController, chunk);
            complete(summary);
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

    // Loads the application index once, from beside the files it lists, so it always matches them.
    private loadApplicationFolderPaths(): Promise<ApplicationFolderPaths> {
        this.#applicationFolderPaths ??= this.fetchApplicationFolderPaths();
        return this.#applicationFolderPaths;
    }

    // A failed fetch is not kept, so the next call tries again.
    private async fetchApplicationFolderPaths(): Promise<ApplicationFolderPaths> {
        try {
            const response = await fetch(INDEX_URL);
            if (!response.ok)
                throw await buildFetchError(response, 'Failed to fetch the application index.', 'dpuse-connector-application-emulator|Connector|fetchApplicationFolderPaths');
            return (await response.json()) as ApplicationFolderPaths;
        } catch (error) {
            this.#applicationFolderPaths = undefined;
            throw normalizeToError(error);
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────

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
    const lastModifiedAtTimestamp = lastModifiedAt;
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
        lastModifiedAt: lastModifiedAtTimestamp,
        mimeType: mimeType ?? lookupMimeTypeForExtension(extension), // The index's type, which matches what the bucket serves.
        name,
        size,
        typeId: 'object'
    };
}
