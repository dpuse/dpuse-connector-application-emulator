// Dependencies - Vendor
import { nanoid } from 'nanoid';
import type { Callback, CastingContext, Options, Parser } from 'csv-parse';

// Dependencies - Framework
import { AbortError, ConnectorError, FetchError, ListEntryTypeId, PreviewTypeId } from '@datapos/datapos-share-core';
import type { ConnectionConfig, ConnectorCallbackData, ConnectorConfig, DataConnector, DataConnectorFieldInfo, DataConnectorRecord } from '@datapos/datapos-share-core';
import type { DataViewConfig, PreviewInterface, ReadInterface, ReadInterfaceSettings } from '@datapos/datapos-share-core';
import { extractFileExtensionFromFilePath, lookupMimeTypeForFileExtension } from '@datapos/datapos-share-core';
import type { ListEntriesResult, ListEntriesSettings, ListEntryConfig, Preview } from '@datapos/datapos-share-core';

// Dependencies - Data
import applicationIndex from './applicationIndex.json';
import config from './config.json';
import { version } from '../package.json';

// Interfaces/Schemas/Types - Application Index
type ApplicationIndex = Record<string, { childCount?: number; lastModifiedAt?: number; name: string; size?: number; typeId: string }[]>;

// Constants
const CALLBACK_LIST_ENTRY_PREVIEW_ABORTED = 'List entry preview aborted.';
const CALLBACK_LIST_ENTRY_READ_ABORTED = 'List entry read aborted.';
const DEFAULT_LIST_ENTRY_PREVIEW_CHUNK_SIZE = 4096;
const DEFAULT_LIST_ENTRY_READ_CHUNK_SIZE = 1000;
const ERROR_LIST_ENTRIES_FAILED = 'List entries failed';
const ERROR_LIST_ENTRY_PREVIEW_FAILED = 'Preview list entry failed';
const ERROR_LIST_ENTRY_READ_FAILED = 'Read list entry failed';
const LIST_ENTRY_URL_PREFIX = 'https://datapos-resources.netlify.app/';

// Classes - Application Emulator Data Connector
export default class ApplicationEmulatorDataConnector implements DataConnector {
    abortController: AbortController | undefined;
    readonly config: ConnectorConfig;
    readonly connectionConfig: ConnectionConfig;

    constructor(connectionConfig: ConnectionConfig) {
        this.abortController = null;
        this.config = config as ConnectorConfig;
        this.config.version = version;
        this.connectionConfig = connectionConfig;
    }

    abort(): void {
        if (!this.abortController) return;
        this.abortController.abort();
        this.abortController = null;
    }

    getPreviewInterface(): PreviewInterface {
        return { connector: this, preview };
    }

    getReadInterface(): ReadInterface {
        return { connector: this, read };
    }

    async listEntries(settings: ListEntriesSettings): Promise<ListEntriesResult> {
        return new Promise((resolve, reject) => {
            try {
                const indexEntries = (applicationIndex as ApplicationIndex)[settings.folderPath];
                const listEntryConfigs: ListEntryConfig[] = [];
                for (const indexEntry of indexEntries) {
                    if (indexEntry.typeId === 'folder') {
                        listEntryConfigs.push(buildFolderEntryConfig(settings.folderPath, indexEntry.name, indexEntry.childCount));
                    } else {
                        listEntryConfigs.push(buildFileEntryConfig(settings.folderPath, indexEntry.name, indexEntry.lastModifiedAt, indexEntry.size));
                    }
                }
                resolve({ cursor: undefined, isMore: false, listEntryConfigs, totalCount: listEntryConfigs.length });
            } catch (error) {
                reject(constructErrorAndTidyUp(this, ERROR_LIST_ENTRIES_FAILED, 'listEntries.1', error));
            }
        });
    }
}

// Interfaces - Preview
const preview = (connector: DataConnector, sourceViewConfig: DataViewConfig, chunkSize?: number): Promise<{ error?: unknown; result?: Preview }> => {
    return new Promise((resolve, reject) => {
        try {
            // Create an abort controller. Get the signal for the abort controller and add an abort listener.
            connector.abortController = new AbortController();
            const signal = connector.abortController.signal;
            signal.addEventListener('abort', () =>
                reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_PREVIEW_FAILED, 'preview.5', new AbortError(CALLBACK_LIST_ENTRY_PREVIEW_ABORTED)))
            );

            // Fetch chunk from start of file.
            const url = `${LIST_ENTRY_URL_PREFIX}application${sourceViewConfig.folderPath}/${sourceViewConfig.fileName}`;
            const headers: HeadersInit = { Range: `bytes=0-${chunkSize || DEFAULT_LIST_ENTRY_PREVIEW_CHUNK_SIZE}` };
            fetch(encodeURI(url), { headers, signal })
                .then(async (response) => {
                    try {
                        if (response.ok) {
                            connector.abortController = null;
                            resolve({ result: { data: new Uint8Array(await response.arrayBuffer()), typeId: PreviewTypeId.Uint8Array } });
                        } else {
                            const error = new FetchError(`${response.status}${response.statusText ? ` - ${response.statusText}` : ''}`);
                            reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_PREVIEW_FAILED, 'preview.4', error));
                        }
                    } catch (error) {
                        reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_PREVIEW_FAILED, 'preview.3', error));
                    }
                })
                .catch((error) => reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_PREVIEW_FAILED, 'preview.2', error)));
        } catch (error) {
            reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_PREVIEW_FAILED, 'preview.1', error));
        }
    });
};

// Interfaces - Read
const read = (
    connector: DataConnector,
    sourceViewConfig: DataViewConfig,
    settings: ReadInterfaceSettings,
    csvParse: (options?: Options, callback?: Callback) => Parser,
    callback: (data: ConnectorCallbackData) => void
): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            callback({ typeId: 'start', properties: { sourceViewConfig, settings } });
            // Create an abort controller and get the signal. Add an abort listener to the signal.
            connector.abortController = new AbortController();
            const signal = connector.abortController.signal;
            signal.addEventListener(
                'abort',
                () => reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_READ_FAILED, 'read.8', new AbortError(CALLBACK_LIST_ENTRY_READ_ABORTED)))
                /*, { once: true, signal } TODO: Don't need once and signal? */
            );

            // Parser - Declare variables.
            let pendingRows: DataConnectorRecord[] = []; // Array to store rows of parsed field values and associated information.
            const fieldInfos: DataConnectorFieldInfo[] = []; // Array to store field information for a single row.

            // Parser - Create a parser object for CSV parsing.
            const parser = csvParse({
                cast: (value, context) => {
                    fieldInfos[context.index] = { isQuoted: context.quoting };
                    return value;
                },
                delimiter: sourceViewConfig.preview.valueDelimiterId,
                info: true,
                relax_column_count: true,
                relax_quotes: true
            });

            // Parser - Event listener for the 'readable' (data available) event.
            parser.on('readable', () => {
                try {
                    let data;
                    while ((data = parser.read() as { info: CastingContext; record: string[] }) !== null) {
                        signal.throwIfAborted(); // Check if the abort signal has been triggered.
                        pendingRows.push({ fieldInfos, fieldValues: data.record }); // Append the row of parsed values and associated information to the pending rows array.
                        if (pendingRows.length < DEFAULT_LIST_ENTRY_READ_CHUNK_SIZE) continue; // Continue with next iteration if the pending rows array is not yet full.
                        settings.chunk(pendingRows); // Pass the pending rows to the engine using the 'chunk' callback.
                        pendingRows = []; // Clear the pending rows array in preparation for the next batch of data.
                    }
                } catch (error) {
                    reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_READ_FAILED, 'read.7', error));
                }
            });

            // Parser - Event listener for the 'error' event.
            parser.on('error', (error) => reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_READ_FAILED, 'read.6', error)));

            // Parser - Event listener for the 'end' (end of data) event.
            parser.on('end', () => {
                try {
                    signal.throwIfAborted(); // Check if the abort signal has been triggered.
                    connector.abortController = null; // Clear the abort controller.
                    if (pendingRows.length > 0) {
                        settings.chunk(pendingRows);
                        pendingRows = [];
                    }
                    settings.complete({
                        byteCount: parser.info.bytes,
                        commentLineCount: parser.info.comment_lines,
                        emptyLineCount: parser.info.empty_lines,
                        invalidFieldLengthCount: parser.info.invalid_field_length,
                        lineCount: parser.info.lines,
                        recordCount: parser.info.records
                    });
                    resolve();
                } catch (error) {
                    reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_READ_FAILED, 'read.5', error));
                }
            });

            // Fetch, decode and forward the contents of the file to the parser.
            const fullFileName = `${sourceViewConfig.fileName}${sourceViewConfig.fileExtension ? `.${sourceViewConfig.fileExtension}` : ''}`;
            const url = `${LIST_ENTRY_URL_PREFIX}application${sourceViewConfig.folderPath}/${fullFileName}`;
            fetch(encodeURI(url), { signal })
                .then(async (response) => {
                    try {
                        const stream = response.body.pipeThrough(new TextDecoderStream(sourceViewConfig.preview.encodingId));
                        const decodedStreamReader = stream.getReader();
                        let result;
                        while (!(result = await decodedStreamReader.read()).done) {
                            signal.throwIfAborted(); // Check if the abort signal has been triggered.
                            // Write the decoded data to the parser and terminate if there is an error.
                            parser.write(result.value, (error) => {
                                if (error) reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_READ_FAILED, 'read.4', error));
                            });
                        }
                        parser.end(); // Signal no more data will be written.
                    } catch (error) {
                        reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_READ_FAILED, 'read.3', error));
                    }
                })
                .catch((error) => reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_READ_FAILED, 'read.2', error)));
            callback({ typeId: 'end', properties: { url } });
        } catch (error) {
            reject(constructErrorAndTidyUp(connector, ERROR_LIST_ENTRY_READ_FAILED, 'read.1', error));
        }
    });
};

// Utilities - Build Folder Entry Configuration
const buildFolderEntryConfig = (folderPath: string, name: string, childCount: number): ListEntryConfig => {
    return {
        childCount,
        folderPath,
        encodingId: undefined,
        extension: undefined,
        handle: undefined,
        id: nanoid(),
        label: name,
        lastModifiedAt: undefined,
        mimeType: undefined,
        name,
        size: undefined,
        typeId: ListEntryTypeId.Folder
    };
};

// Utilities - Build File Entry Configuration
const buildFileEntryConfig = (folderPath: string, fullName: string, lastModifiedAt: number, size: number): ListEntryConfig => {
    const extension = extractFileExtensionFromFilePath(fullName);
    return {
        childCount: undefined,
        folderPath,
        encodingId: undefined,
        extension,
        handle: undefined,
        id: nanoid(),
        label: fullName,
        lastModifiedAt,
        mimeType: lookupMimeTypeForFileExtension(extension),
        name: fullName,
        size,
        typeId: ListEntryTypeId.File
    };
};

// Utilities - Construct Error and Tidy Up
const constructErrorAndTidyUp = (connector: DataConnector, message: string, context: string, error: unknown): unknown => {
    connector.abortController = null;
    const connectorError = new ConnectorError(`${message} at '${config.id}.${context}'.`, error);
    return connectorError;
};
