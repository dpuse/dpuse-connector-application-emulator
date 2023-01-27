/**
 * @author Jonathan Terrell <terrell.jm@gmail.com>
 * @copyright 2023 Jonathan Terrell
 * @file datapos-connector-data-application-emulator/src/index.ts
 * @license ISC
 */

// Connector asset dependencies.
import config from './config.json';
import { version } from '../package.json';

// Engine component dependencies.
import type {
    ConnectionEntry,
    ConnectionEntryPreview,
    ConnectionEntriesPage,
    ConnectionItem,
    DataConnector,
    DataConnectorPreviewInterface,
    DataConnectorPreviewInterfaceSettings,
    DataConnectorReadInterface,
    DataConnectorReadInterfaceSettings,
    ErrorData,
    FieldInfos,
    SourceViewProperties
} from '@datapos/datapos-engine-support';
import { ConnectionEntryPreviewTypeId, ConnectionEntryTypeId } from '@datapos/datapos-engine-support';

// Vendor dependencies.
import type { CastingContext } from 'csv-parse/.';

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Declarations
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const defaultChunkSize = 4096;
// TODO: Salesforce and SAP SuccessFactors data needs to be combined into a single organisation.
const urlPrefix = 'https://firebasestorage.googleapis.com/v0/b/datapos-v00-dev-alpha.appspot.com/o/sandboxes%2FsapSuccessFactors';

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Data Connector
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Encapsulates the Application Emulator data connector.
 */
export default class ApplicationEmulatorDataConnector implements DataConnector {
    abortController: AbortController;
    readonly connectionItem: ConnectionItem;
    readonly id: string;
    readonly version: string;

    constructor(connectionItem: ConnectionItem) {
        this.abortController = undefined;
        this.connectionItem = connectionItem;
        this.id = config.id;
        this.version = version;
    }

    /**
     * Abort current processing.
     */
    abort(): void {
        if (!this.abortController) return;
        this.abortController.abort();
        this.abortController = undefined;
    }

    /**
     * Get the preview interface.
     * @returns The preview interface.
     */
    getPreviewInterface(): DataConnectorPreviewInterface {
        return { connector: this, previewFileEntry };
    }

    /**
     * Get the read interface.
     * @returns The read interface.
     */
    getReadInterface(): DataConnectorReadInterface {
        return { connector: this, readFileEntry };
    }

    /**
     * Retrieve a page of entries for a given folder path.
     * @param accountId The identifier of the account to which the source belongs.
     * @param sessionAccessToken An active session access token.
     * @param parentConnectionEntry
     * @returns A page of entries.
     */
    async retrieveEntries(accountId: string, sessionAccessToken: string, parentConnectionEntry: ConnectionEntry): Promise<ConnectionEntriesPage> {
        return await retrieveEntries(parentConnectionEntry);
    }
}

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Retrieve Entries
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Retrieve a page of entries for a given folder path.
 * @param parentConnectionEntry
 * @returns A page of entries.
 */
const retrieveEntries = (parentConnectionEntry: ConnectionEntry): Promise<ConnectionEntriesPage> => {
    return new Promise((resolve, reject) => {
        try {
            const entries: ConnectionEntry[] = [];
            switch (parentConnectionEntry.folderPath || '') {
                default:
                    entries.push(buildFileEntry('', 'empEmployment', 'Emp Employment', 2147));
                    entries.push(buildFileEntry('', 'empJob', 'Emp Job', 5733));
                    entries.push(buildFileEntry('', 'perGlobalInfoGBR', 'Per Information Global - GBR', 861));
                    entries.push(buildFileEntry('', 'perGlobalInfoUSA', 'Per Information Global - USA', 51));
                    entries.push(buildFileEntry('', 'perPerson', 'Per Person', 2147));
                    entries.push(buildFileEntry('', 'perPersonal', 'Per Personal', 2174));
                    break;
            }
            resolve({ cursor: undefined, isMore: false, entries, totalCount: entries.length });
        } catch (error) {
            reject(error);
        }
    });
};

const buildFileEntry = (folderPath: string, name: string, label: string, size: number): ConnectionEntry => ({
    childEntryCount: undefined,
    encodingId: undefined,
    extension: 'csv',
    folderPath,
    handle: undefined,
    id: name,
    label,
    lastModifiedAt: undefined,
    mimeType: undefined,
    name: `${name}.csv`,
    referenceId: undefined,
    size,
    typeId: ConnectionEntryTypeId.File
});

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Preview File Entry
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Preview a file entry.
 * @param connector This data connector.
 * @param sourceViewProperties The source view properties.
 * @param accountId The identifier of the account to which the source belongs.
 * @param sessionAccessToken An active session token.
 * @param previewInterfaceSettings The preview interface settings.
 * @returns A source file entry preview.
 */
const previewFileEntry = async (
    connector: DataConnector,
    sourceViewProperties: SourceViewProperties,
    accountId: string | undefined,
    sessionAccessToken: string | undefined,
    previewInterfaceSettings: DataConnectorPreviewInterfaceSettings
): Promise<ConnectionEntryPreview> => {
    connector.abortController = new AbortController();
    const signal = connector.abortController.signal;
    // TODO: signal.addEventListener('abort', () => console.log('TRACE: Preview File Entry ABORTED!'), { once: true, signal }); // Don't need once and signal?

    const headers: HeadersInit = {
        Range: `bytes=0-${previewInterfaceSettings.chunkSize || defaultChunkSize}`
    };
    const response = await fetch(`${urlPrefix}%2F${encodeURIComponent(sourceViewProperties.fileName)}?alt=media`, { headers, signal });
    connector.abortController = undefined;
    if (!response.ok) {
        const data: ErrorData = {
            body: { context: 'previewFileEntry', message: await response.text() },
            statusCode: response.status,
            statusText: response.statusText
        };
        throw new Error('Unable to preview entry.|' + JSON.stringify(data));
    }
    const uint8Array = new Uint8Array(await response.arrayBuffer());

    return { data: uint8Array, fields: undefined, typeId: ConnectionEntryPreviewTypeId.Uint8Array };
};

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Read File Entry
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Read a file entry.
 * @param connector This data connector.
 * @param sourceViewProperties The source view properties.
 * @param accountId The identifier of the account to which the source belongs.
 * @param sessionAccessToken An active session token.
 * @param readInterfaceSettings The read interface settings.
 * @param csvParse
 */
const readFileEntry = async (
    connector: DataConnector,
    sourceViewProperties: SourceViewProperties,
    accountId: string,
    sessionAccessToken: string,
    readInterfaceSettings: DataConnectorReadInterfaceSettings,
    csvParse: typeof import('csv-parse/browser/esm')
): Promise<void> => {
    connector.abortController = new AbortController();
    const signal = connector.abortController.signal;
    // TODO: signal.addEventListener('abort', () => console.log('TRACE: Read File Entry ABORTED!'), { once: true, signal }); // Don't need once and signal?

    const response = await fetch(`${urlPrefix}${encodeURIComponent(`${sourceViewProperties.folderPath}/${sourceViewProperties.fileName}`)}?alt=media`, { signal });

    let chunk: { fieldInfos: FieldInfos[]; fieldValues: string[] }[] = [];
    const fieldInfos: FieldInfos[] = [];
    const maxChunkSize = 1000;
    const parser = csvParse.parse({
        cast: (value, context) => {
            fieldInfos[context.index] = { isQuoted: context.quoting };
            return value;
        },
        delimiter: sourceViewProperties.preview.valueDelimiterId,
        info: true,
        relax_column_count: true,
        relax_quotes: true
    });
    parser.on('readable', () => {
        let data;
        while ((data = parser.read() as { info: CastingContext; record: string[] }) !== null) {
            signal.throwIfAborted();
            chunk.push({ fieldInfos, fieldValues: data.record });
            if (chunk.length < maxChunkSize) continue;
            readInterfaceSettings.chunk(chunk);
            chunk = [];
        }
    });
    parser.on('error', (error) => readInterfaceSettings.error(error));
    parser.on('end', () => {
        signal.throwIfAborted();
        connector.abortController = undefined;
        if (chunk.length > 0) {
            readInterfaceSettings.chunk(chunk);
            chunk = [];
        }
        readInterfaceSettings.complete({
            commentLineCount: parser.info.comment_lines,
            emptyLineCount: parser.info.empty_lines,
            lineCount: parser.info.lines,
            recordCount: parser.info.records
        });
    });

    // TODO: csvParse seems to have some support for encoding. Need to test if this can be used to replace TextDecoderStream?.
    const stream = response.body.pipeThrough(new TextDecoderStream(sourceViewProperties.preview.encodingId));
    const decodedStreamReader = stream.getReader();
    let result;
    while (!(result = await decodedStreamReader.read()).done) {
        signal.throwIfAborted();
        parser.write(result.value, (error) => {
            if (error) readInterfaceSettings.error(error);
        });
    }
    parser.end();
};
// #endregion
