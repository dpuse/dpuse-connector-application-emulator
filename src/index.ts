// Dependencies - Vendor
import type { CastingContext } from 'csv-parse';

// Dependencies - Framework
import { AbortError, ConnectorError, FetchError } from '@datapos/datapos-share-core';
import type {
    ConnectionConfig,
    Connector,
    ConnectorCallbackData,
    ConnectorConfig,
    ConnectorFieldInfo,
    ConnectorRecord,
    DataViewPreviewConfig,
    ItemConfig
} from '@datapos/datapos-share-core';
import { extractExtensionFromPath, extractNameFromPath, lookupMimeTypeForExtension } from '@datapos/datapos-share-core';
import type { ListItemsResult, ListItemsSettings } from '@datapos/datapos-share-core';
import type { PreviewInterface, PreviewInterfaceSettings, PreviewResult } from '@datapos/datapos-share-core';
import type { ReadInterface, ReadInterfaceSettings } from '@datapos/datapos-share-core';

// Dependencies - Data
import applicationIndex from './applicationIndex.json';
import config from './config.json';
import { version } from '../package.json';

// Interfaces/Schemas/Types - Application Index
type ApplicationIndex = Record<string, { childCount?: number; lastModifiedAt?: number; name: string; size?: number; typeId: string }[]>;

// Constants
const CALLBACK_PREVIEW_ABORTED = 'Connector preview aborted.';
const CALLBACK_READ_ABORTED = 'Connector read aborted.';
const DEFAULT_PREVIEW_CHUNK_SIZE = 4096;
const DEFAULT_READ_CHUNK_SIZE = 1000;
const ERROR_LIST_ITEMS_FAILED = 'Connector list items failed.';
const ERROR_PREVIEW_FAILED = 'Connector preview failed.';
const ERROR_READ_FAILED = 'Connector read failed.';
const URL_PREFIX = 'https://datapos-resources.netlify.app/';

// Classes - Application Emulator Connector
export default class ApplicationEmulatorConnector implements Connector {
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

    async listItems(callback: (data: ConnectorCallbackData) => void, settings: ListItemsSettings): Promise<ListItemsResult> {
        console.log('XXXX', callback);
        console.log('YYYY', settings);
        return new Promise((resolve, reject) => {
            try {
                const indexItems = (applicationIndex as ApplicationIndex)[settings.folderPath];
                const itemConfigs: ItemConfig[] = [];
                for (const indexItem of indexItems) {
                    if (indexItem.typeId === 'folder') {
                        itemConfigs.push(buildFolderItemConfig(settings.folderPath, indexItem.name, indexItem.childCount));
                    } else {
                        itemConfigs.push(buildObjectItemConfig(settings.folderPath, indexItem.name, indexItem.lastModifiedAt, indexItem.size));
                    }
                }
                resolve({ cursor: undefined, isMore: false, itemConfigs, totalCount: itemConfigs.length });
            } catch (error) {
                reject(constructErrorAndTidyUp(this, ERROR_LIST_ITEMS_FAILED, 'listItems.1', error));
            }
        });
    }
}

// Interfaces - Preview
const preview = (
    connector: Connector,
    callback: (data: ConnectorCallbackData) => void,
    itemConfig: ItemConfig,
    settings: PreviewInterfaceSettings
): Promise<{ error?: unknown; result?: PreviewResult }> => {
    return new Promise((resolve, reject) => {
        try {
            // Create an abort controller. Get the signal for the abort controller and add an abort listener.
            connector.abortController = new AbortController();
            const signal = connector.abortController.signal;
            signal.addEventListener('abort', () => reject(constructErrorAndTidyUp(connector, ERROR_PREVIEW_FAILED, 'preview.5', new AbortError(CALLBACK_PREVIEW_ABORTED))));

            // Fetch chunk from start of file.
            const url = `${URL_PREFIX}application${itemConfig.folderPath}${itemConfig.name}${itemConfig.extension ? `.${itemConfig.extension}` : ''}`;
            const headers: HeadersInit = { Range: `bytes=0-${settings.chunkSize || DEFAULT_PREVIEW_CHUNK_SIZE}` };
            fetch(encodeURI(url), { headers, signal })
                .then(async (response) => {
                    try {
                        if (response.ok) {
                            connector.abortController = null;
                            resolve({ result: { data: new Uint8Array(await response.arrayBuffer()), typeId: 'uint8Array' } });
                        } else {
                            const message = `Connector preview failed to fetch '${itemConfig.name}' table. Response status ${response.status}${response.statusText ? ` - ${response.statusText}` : ''} received.`;
                            const error = new FetchError(message, undefined, undefined, { body: await response.text() });
                            reject(constructErrorAndTidyUp(connector, ERROR_PREVIEW_FAILED, 'preview.4', error));
                        }
                    } catch (error) {
                        reject(constructErrorAndTidyUp(connector, ERROR_PREVIEW_FAILED, 'preview.3', error));
                    }
                })
                .catch((error) => reject(constructErrorAndTidyUp(connector, ERROR_PREVIEW_FAILED, 'preview.2', error)));
        } catch (error) {
            reject(constructErrorAndTidyUp(connector, ERROR_PREVIEW_FAILED, 'preview.1', error));
        }
    });
};

// Interfaces - Read
const read = (
    connector: Connector,
    callback: (data: ConnectorCallbackData) => void,
    itemConfig: ItemConfig,
    previewConfig: DataViewPreviewConfig,
    settings: ReadInterfaceSettings
): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            callback({ typeId: 'start', properties: { itemConfig, previewConfig, settings } });
            // Create an abort controller and get the signal. Add an abort listener to the signal.
            connector.abortController = new AbortController();
            const signal = connector.abortController.signal;
            signal.addEventListener(
                'abort',
                () => reject(constructErrorAndTidyUp(connector, ERROR_READ_FAILED, 'read.9', new AbortError(CALLBACK_READ_ABORTED)))
                /*, { once: true, signal } TODO: Don't need once and signal? */
            );

            // Parser - Declare variables.
            let pendingRows: ConnectorRecord[] = []; // Array to store rows of parsed field values and associated information.
            const fieldInfos: ConnectorFieldInfo[] = []; // Array to store field information for a single row.

            // Parser - Create a parser object for CSV parsing.
            const parser = settings.csvParse({
                cast: (value, context) => {
                    fieldInfos[context.index] = { isQuoted: context.quoting };
                    return value;
                },
                delimiter: previewConfig.valueDelimiterId,
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
                        // TODO: Do we need to clear 'fieldInfos' array for each record? Different number of values in a row?
                        pendingRows.push({ fieldInfos: { ...fieldInfos }, fieldValues: data.record }); // Append the row of parsed values and associated information to the pending rows array.
                        if (pendingRows.length < DEFAULT_READ_CHUNK_SIZE) continue; // Continue with next iteration if the pending rows array is not yet full.
                        settings.chunk(pendingRows); // Pass the pending rows to the engine using the 'chunk' callback.
                        pendingRows = []; // Clear the pending rows array in preparation for the next batch of data.
                    }
                } catch (error) {
                    reject(constructErrorAndTidyUp(connector, ERROR_READ_FAILED, 'read.8', error));
                }
            });

            // Parser - Event listener for the 'error' event.
            parser.on('error', (error) => reject(constructErrorAndTidyUp(connector, ERROR_READ_FAILED, 'read.7', error)));

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
                    callback({ typeId: 'end', properties: {} });
                } catch (error) {
                    reject(constructErrorAndTidyUp(connector, ERROR_READ_FAILED, 'read.6', error));
                }
            });

            // Fetch, decode and forward the contents of the file to the parser.
            const fullFileName = `${itemConfig.name}${itemConfig.extension ? `.${itemConfig.extension}` : ''}`;
            const url = `${URL_PREFIX}application${itemConfig.folderPath}${fullFileName}`;
            fetch(encodeURI(url), { signal })
                .then(async (response) => {
                    try {
                        if (response.ok) {
                            const stream = response.body.pipeThrough(new TextDecoderStream(previewConfig.encodingId));
                            const decodedStreamReader = stream.getReader();
                            let result;
                            while (!(result = await decodedStreamReader.read()).done) {
                                signal.throwIfAborted(); // Check if the abort signal has been triggered.
                                // Write the decoded data to the parser and terminate if there is an error.
                                parser.write(result.value, (error) => {
                                    if (error) reject(constructErrorAndTidyUp(connector, ERROR_READ_FAILED, 'read.5', error));
                                });
                            }
                            parser.end(); // Signal no more data will be written.
                        } else {
                            const message = `Connector read failed to fetch '${itemConfig.name}' table. Response status ${response.status}${response.statusText ? ` - ${response.statusText}` : ''} received.`;
                            const error = new FetchError(message, undefined, undefined, { body: await response.text() });
                            reject(constructErrorAndTidyUp(connector, ERROR_READ_FAILED, 'read.4', error));
                        }
                    } catch (error) {
                        reject(constructErrorAndTidyUp(connector, ERROR_READ_FAILED, 'read.3', error));
                    }
                })
                .catch((error) => reject(constructErrorAndTidyUp(connector, ERROR_READ_FAILED, 'read.2', error)));
        } catch (error) {
            reject(constructErrorAndTidyUp(connector, ERROR_READ_FAILED, 'read.1', error));
        }
    });
};

// Utilities - Build Folder Item Configuration
const buildFolderItemConfig = (folderPath: string, name: string, childCount: number): ItemConfig => {
    return { childCount, folderPath, label: name, name, typeId: 'folder' };
};

// Utilities - Build Object (File) Item Configuration
const buildObjectItemConfig = (folderPath: string, fullName: string, lastModifiedAt: number, size: number): ItemConfig => {
    const name = extractNameFromPath(fullName);
    const extension = extractExtensionFromPath(fullName);
    return { folderPath, extension, label: fullName, lastModifiedAt, mimeType: lookupMimeTypeForExtension(extension), name, size, typeId: 'object' };
};

// Utilities - Construct Error and Tidy Up
const constructErrorAndTidyUp = (connector: Connector, message: string, context: string, error: unknown): unknown => {
    connector.abortController = null;
    return new ConnectorError(message, `${config.id}.${context}`, undefined, undefined, error);
};
