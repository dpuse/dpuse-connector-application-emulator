/**
 * @author Jonathan Terrell <terrell.jm@gmail.com>
 * @copyright 2022 Jonathan Terrell
 * @file dataposapp-connector-data-application-emulator/src/index.ts
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
    ErrorData,
    SourceViewProperties
} from '@dataposapp/dataposapp-engine-main';
import { ConnectionEntryPreviewTypeId, ConnectionEntryTypeId } from '@dataposapp/dataposapp-engine-main';

// Vendor dependencies.
import type { CastingContext } from 'csv-parse/.';

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const defaultChunkSize = 4096;
// TODO: Salesforce and SAP SuccessFactors data needs to be combined into a single organisation.
const sapSuccessFactorsURLPrefix = 'https://firebasestorage.googleapis.com/v0/b/dataposapp-v00-dev-alpha.appspot.com/o/sandboxes%2FsapSuccessFactors';

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Data Connector
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

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
        throw new Error('Not implemented');
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
    const headers: HeadersInit = {
        Range: `bytes=0-${previewInterfaceSettings.chunkSize || defaultChunkSize}`
    };
    connector.abortController = new AbortController();
    const signal = connector.abortController.signal;
    // signal.addEventListener('abort', () => console.log('TRACE: Preview File Entry ABORTED!'), { once: true, signal }); // Don't need once and signal?
    const response = await fetch(`${sapSuccessFactorsURLPrefix}%2F${encodeURIComponent(sourceViewProperties.fileName)}?alt=media`, { headers, signal });
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

// #endregion
