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
import {
    ConnectionEntry,
    ConnectionEntryPreview,
    ConnectionEntryPreviewTypeId,
    ConnectionEntriesPage,
    ConnectionEntryTypeId,
    ConnectionItem,
    DataConnector,
    DataConnectorPreviewInterface,
    DataConnectorPreviewInterfaceSettings,
    DataConnectorReadInterface,
    ErrorData,
    SourceViewProperties
} from '../../../../dataposapp-engine-main/src';

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const defaultChunkSize = 4096;
const sapSuccessFactorsURLPrefix = 'https://firebasestorage.googleapis.com/v0/b/dataposapp-v00-dev-alpha.appspot.com/o/sandboxes%2FsapSuccessFactors';

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Data Connector
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

export default class ApplicationEmulatorDataConnector implements DataConnector {
    readonly connectionItem: ConnectionItem;
    readonly id: string;
    isAborted: boolean;
    readonly version: string;

    constructor(connectionItem: ConnectionItem) {
        this.connectionItem = connectionItem;
        this.id = config.id;
        this.isAborted = false;
        this.version = version;
    }

    abort(): void {
        this.isAborted = true;
    }

    getPreviewInterface(): DataConnectorPreviewInterface {
        return { connector: this, previewFileEntry };
    }

    getReadInterface(): DataConnectorReadInterface {
        throw new Error('Not implemented');
    }

    async listEntries(accountId: string, sessionAccessToken: string, directory: string): Promise<ConnectionEntriesPage> {
        return await listEntries(directory);
    }
}

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region List Entries
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const listEntries = (directoryPath: string): Promise<ConnectionEntriesPage> => {
    return new Promise((resolve, reject) => {
        try {
            const entries: ConnectionEntry[] = [];
            switch (directoryPath) {
                default:
                    entries.push(buildObjectItem('', 'empEmployment', 'Emp Employment', 2147));
                    entries.push(buildObjectItem('', 'empJob', 'Emp Job', 5733));
                    entries.push(buildObjectItem('', 'perGlobalInfoGBR', 'Per Information Global - GBR', 861));
                    entries.push(buildObjectItem('', 'perGlobalInfoUSA', 'Per Information Global - USA', 51));
                    entries.push(buildObjectItem('', 'perPerson', 'Per Person', 2147));
                    entries.push(buildObjectItem('', 'perPersonal', 'Per Personal', 2174));
                    break;
            }
            resolve({ cursor: undefined, isMore: false, entries });
        } catch (error) {
            reject(error);
        }
    });
};

const buildObjectItem = (folderPath: string, name: string, label: string, size: number): ConnectionEntry => ({
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

    const response = await fetch(`${sapSuccessFactorsURLPrefix}%2F${encodeURIComponent(sourceViewProperties.fileName)}?alt=media`, { headers });
    if (!response.ok) {
        const data: ErrorData = {
            body: { context: 'previewFileEntry', message: await response.text() },
            statusCode: response.status,
            statusText: response.statusText
        };
        throw new Error('Unable to preview entry.|' + JSON.stringify(data));
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return { data: uint8Array, typeId: ConnectionEntryPreviewTypeId.Uint8Array };
};

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Read File Entry
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// #endregion
