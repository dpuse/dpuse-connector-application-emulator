// External Dependencies
import { nanoid } from 'nanoid';

// DPUse Framework
import type { ConnectionNodeConfig } from '@dpuse/dpuse-shared/component/connection';
import type { EngineUtilities } from '@dpuse/dpuse-shared/engine';
import type {
    AuditObjectContentOptions,
    AuditObjectContentResult,
    ConnectorConfig,
    ConnectorInterface,
    FindObjectOptions,
    FindObjectResult,
    GetReadableStreamOptions,
    ListNodesOptions,
    ListNodesResult,
    PreviewObjectOptions,
    RetrievalTypeId,
    RetrieveRecordsOptions,
    RetrieveRecordsSummary
} from '@dpuse/dpuse-shared/component/module/connector';
import { buildFetchError, ConnectorError, normalizeToError } from '@dpuse/dpuse-shared/errors';
import { extractExtensionFromPath, extractNameFromPath, lookupMimeTypeForExtension } from '@dpuse/dpuse-shared/utilities';
import { loadTool, type ToolConfig } from '@dpuse/dpuse-shared/component/module/tool';
import { ORDERED_VALUE_DELIMITER_IDS, type ParsingRecord, type PreviewConfig } from '@dpuse/dpuse-shared/component/dataView';

// DPUse Tools
import type { Tool as CSVParseTool } from '@dpuse/dpuse-tool-csv-parse';
import type { Tool as FileOperatorsTool } from '@dpuse/dpuse-tool-file-operators';
import type { Tool as RustCsvCoreTool } from '@dpuse/dpuse-tool-rust-csv-core';

// Data
import config from '~/config.json';
import fileStoreFolderPathData from '@/fileStoreFolderPaths.json';

// TODO
import { addNumbersWithRust, checksumWithRust } from '@/rustBridge';

/**
 * File store folder paths.
 */
type FileStoreFolderNode =
    | ({ typeId: 'folder'; childCount: number } & { name: string })
    | ({ typeId: 'object'; id: string; lastModifiedAt: number; size: number } & { name: string });

/**
 * File store folder paths.
 */
type FileStoreFolderPaths = Record<string, FileStoreFolderNode[]>;

/**
 * Cloudflare R2 file store directory prefix.
 */
const URL_PREFIX = 'https://sample-data-eu.dpuse.app/fileStore';

// Connectors
export class Connector implements ConnectorInterface {
    abortController: AbortController | undefined;
    readonly config: ConnectorConfig;
    engineUtilities: EngineUtilities;
    readonly toolConfigs;

    constructor(engineUtilities: EngineUtilities, toolConfigs: ToolConfig[]) {
        this.abortController = undefined;
        this.config = config as ConnectorConfig;
        this.engineUtilities = engineUtilities;
        this.toolConfigs = toolConfigs;
    }

    // Operations ──────────────────────────────────────────────────────────────────────────────────────────────────────

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
            if (options.parsingToolName === 'dpuse-tool-rust-csv-core') {
                // Get the readable stream
                const stream = await this.getReadableStream({ id: '', path: options.path });

                // Load the Rust CSV core tool
                const rustCsvTool = await loadTool<RustCsvCoreTool>(this.toolConfigs, 'rust-csv-core');

                // Choose processing mode based on browser capability
                const options2 = { delimiter: ',', hasHeaders: true };
                const result = options.supportsTransferableStreams
                    ? await rustCsvTool.processWithTransferableStream(stream, options2, chunk)
                    : await rustCsvTool.processWithChunks(stream, options2, chunk);

                return { processedRowCount: result.processedRowCount, durationMs: result.durationMs ?? 0 };
            }

            const csvParseTool = await loadTool<CSVParseTool>(this.toolConfigs, 'csv-parse');
            const parseStreamOptions = { delimiter: options.valueDelimiterId, relax_column_count: true, relax_quotes: true };
            const url = `${URL_PREFIX}${options.path}`;
            const summary = await csvParseTool.parseStream(options, parseStreamOptions, url, this.abortController, (parameter) => console.log(parameter));
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
    findObject(options: FindObjectOptions): Promise<FindObjectResult> {
        const fileStoreFolderPaths = fileStoreFolderPathData as FileStoreFolderPaths;
        // Loop through the folder path data checking for an object entry with an identifier equal to the object name.
        for (const folderPath in fileStoreFolderPaths) {
            if (Object.hasOwn(fileStoreFolderPaths, folderPath)) {
                const folderPathNodes = fileStoreFolderPaths[folderPath];
                const folderPathNode = folderPathNodes?.find((folderPathNode) => folderPathNode.typeId === 'object' && folderPathNode.id === options.nodeId);
                if (folderPathNode) return Promise.resolve({ path: folderPath, object: undefined }); // Found, return folder path.
            }
        }
        return Promise.reject(new Error('Not found.')); // Not found.
    }

    // Get a readable stream for the specified object node path
    async getReadableStream(options: GetReadableStreamOptions): Promise<ReadableStream<Uint8Array>> {
        // Create an abort controller and extract its signal.
        const { signal } = (this.abortController = new AbortController());

        try {
            const response = await fetch(`${URL_PREFIX}${options.path}`, { signal });
            if (!response.ok) {
                throw await buildFetchError(response, `Failed to fetch '${options.path}' file.`, 'dpuse-connector-file-store-emulator|Connector|getReadableStream');
            }
            if (response.body == null) {
                throw new ConnectorError('Readable streams are not supported in this runtime.', 'dpuse-connector-file-store-emulator|Connector|getReadableStream.unsupported');
            }

            // TODO: Remove after testing.
            const xxx = await addNumbersWithRust(12, 56);
            const sum = await checksumWithRust(this.config.version);
            console.log('sum', sum, xxx);

            return await Promise.resolve(response.body);
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }

    // Lists all nodes (folders and objects) in the specified folder path
    listNodes(options: ListNodesOptions): Promise<ListNodesResult> {
        const fileStoreFolderPaths = fileStoreFolderPathData as FileStoreFolderPaths;
        const folderNodes = fileStoreFolderPaths[options.folderPath] ?? [];
        const connectionNodeConfigs: ConnectionNodeConfig[] = [];
        for (const folderNode of folderNodes) {
            if (folderNode.typeId === 'folder') {
                connectionNodeConfigs.push(constructFolderNodeConfig(options.folderPath, folderNode.name, folderNode.childCount));
            } else {
                connectionNodeConfigs.push(constructObjectNodeConfig(options.folderPath, folderNode.id, folderNode.name, folderNode.lastModifiedAt, folderNode.size));
            }
        }
        return Promise.resolve({ cursor: undefined, isMore: false, connectionNodeConfigs, totalCount: connectionNodeConfigs.length });
    }

    // Preview the contents of the object node with the specified path
    async previewObject(options: PreviewObjectOptions): Promise<PreviewConfig> {
        // Create an abort controller and extract its signal.
        const { signal } = (this.abortController = new AbortController());

        try {
            const asAt = Date.now();
            const startedAt = performance.now();

            // Preview file to determine file format and decode text.
            const fileOperatorsTool = await loadTool<FileOperatorsTool>(this.toolConfigs, 'file-operators');
            const filePreviewResult = await fileOperatorsTool.previewFile(`${URL_PREFIX}${options.path}`, signal, options.chunkSize);
            if (filePreviewResult.dataFormatId == null) throw new Error(`File '${options.path}' has unknown type.`);
            if (filePreviewResult.text == null) throw new Error(`File '${options.path}' is empty.`);

            // Parse text, identify delimiters, and produce string value records.
            const csvParseTool = await loadTool<CSVParseTool>(this.toolConfigs, 'csv-parse');
            const parseTextResult = await csvParseTool.parseText(filePreviewResult.text, ORDERED_VALUE_DELIMITER_IDS);

            // Infer and cast values for each parsed record.
            const inferenceSummary = this.engineUtilities.inferDataTypes(parseTextResult.parsedRecords);

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
                size: filePreviewResult.bytes.length,
                text: filePreviewResult.text,
                valueDelimiterId: parseTextResult.valueDelimiterId
            } as PreviewConfig;
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }
    // Retrieves all records from a CSV object node using streaming and chunked processing
    async retrieveRecords(
        options: RetrieveRecordsOptions,
        chunk: (typeId: RetrievalTypeId, records: ParsingRecord[]) => void,
        complete: (result: RetrieveRecordsSummary) => void
    ): Promise<void> {
        this.abortController = new AbortController();
        try {
            const csvParseTool = await loadTool<CSVParseTool>(this.toolConfigs, 'csv-parse');
            const parseStreamOptions = { delimiter: options.valueDelimiterId, info: true, relax_column_count: true, relax_quotes: true };
            const url = `${URL_PREFIX}${options.path}`;
            const summary = await csvParseTool.parseStream(options, parseStreamOptions, url, this.abortController, chunk);
            complete(summary);
        } catch (error) {
            throw normalizeToError(error);
        } finally {
            this.abortController = undefined;
        }
    }
}

// Helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Construct folder node configuration.
function constructFolderNodeConfig(folderPath: string, name: string, childCount: number): ConnectionNodeConfig {
    return {
        childCount,
        childNodes: [],
        extension: undefined,
        folderPath,
        handle: undefined,
        id: nanoid(),
        label: name,
        lastModifiedAt: undefined,
        mimeType: undefined,
        name,
        size: undefined,
        typeId: 'folder'
    };
}

// Construct object (file) node configuration.
function constructObjectNodeConfig(folderPath: string, id: string, fullName: string, lastModifiedAt: number, size: number): ConnectionNodeConfig {
    const name = extractNameFromPath(fullName) ?? '';
    const extension = extractExtensionFromPath(fullName);
    const lastModifiedAtTimestamp = lastModifiedAt;
    const mimeType = lookupMimeTypeForExtension(extension);
    return {
        childCount: undefined,
        childNodes: [],
        extension,
        folderPath,
        handle: undefined,
        id,
        label: fullName,
        lastModifiedAt: lastModifiedAtTimestamp,
        mimeType,
        name,
        size,
        typeId: 'object'
    };
}
