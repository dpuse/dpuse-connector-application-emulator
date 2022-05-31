/**
 * @author Jonathan Terrell <terrell.jm@gmail.com>
 * @copyright 2022 Jonathan Terrell
 * @file dataposapp-connector-data-application-emulator/src/index.ts
 * @license ISC
 */

// Connector asset dependencies.
import config from './config.json';
import env from '../.env.json';
import { version } from '../package.json';

// Engine component dependencies.
import {
    ConnectionItem,
    ConnectionElement,
    ConnectionElementPreview,
    ConnectionElementPreviewTypeId,
    ConnectionElementsPage,
    ConnectionElementTypeId,
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

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Data Connector
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

export default class SAPSuccessFactorsDataConnector implements DataConnector {
    connectionItem: ConnectionItem;
    id: string;
    isAborted: boolean;
    version: string;

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
        return { connector: this, previewFileElement };
    }

    getReadInterface(): DataConnectorReadInterface {
        throw new Error('Not implemented');
    }

    async listPageOfElementsForDirectoryPath(accountId: string, sessionAccessToken: string, directory: string): Promise<ConnectionElementsPage> {
        switch (this.connectionItem.implementationId) {
            case 'sapSuccessFactors':
                return await listPageOfElementsForDirectoryPathUsingSAPSuccessFactors(directory);
            default:
                throw new Error('Unknown implementation identifier.');
        }
    }
}

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region List Page of Elements for Directory Path - Using SAPSuccessFactors
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const listPageOfElementsForDirectoryPathUsingSAPSuccessFactors = (directoryPath: string): Promise<ConnectionElementsPage> => {
    return new Promise((resolve, reject) => {
        try {
            const elements: ConnectionElement[] = [];
            switch (directoryPath) {
                default:
                    elements.push(buildObjectItem('', 'empEmployment', 'Emp Employment', 2147));
                    elements.push(buildObjectItem('', 'empJob', 'Emp Job', 5733));
                    elements.push(buildObjectItem('', 'perGlobalInfoGBR', 'Per Information Global - GBR', 861));
                    elements.push(buildObjectItem('', 'perGlobalInfoUSA', 'Per Information Global - USA', 51));
                    elements.push(buildObjectItem('', 'perPerson', 'Per Person', 2147));
                    elements.push(buildObjectItem('', 'perPersonal', 'Per Personal', 2174));
                    break;
            }
            resolve({ cursor: undefined, isMore: false, elements });
        } catch (error) {
            reject(error);
        }
    });
};

const buildObjectItem = (directoryPath: string, name: string, label: string, size: number): ConnectionElement => ({
    _id: undefined,
    childElementCount: undefined,
    directoryPath,
    encodingId: undefined,
    extension: 'csv',
    id: name,
    insertedId: undefined,
    label,
    lastModifiedAt: undefined,
    mimeType: undefined,
    name: `${name}.csv`,
    referenceId: undefined,
    size,
    typeId: ConnectionElementTypeId.File
});

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Preview File Element
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const previewFileElement = async (
    connector: DataConnector,
    sourceViewProperties: SourceViewProperties,
    accountId: string | undefined,
    sessionAccessToken: string | undefined,
    previewInterfaceSettings: DataConnectorPreviewInterfaceSettings,
    connectionElement: ConnectionElement
): Promise<ConnectionElementPreview> => {
    const headers: HeadersInit = {
        Range: `bytes=0-${previewInterfaceSettings.chunkSize || defaultChunkSize}`
    };

    const response = await fetch(`${env.SAP_SUCCESS_FACTORS_URL_PREFIX}%2F${encodeURIComponent(connectionElement.name)}?alt=media`, { headers });
    if (!response.ok) {
        const data: ErrorData = {
            body: { context: 'previewFileElement', message: await response.text() },
            statusCode: response.status,
            statusText: response.statusText
        };
        throw new Error('Unable to preview element.|' + JSON.stringify(data));
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return { data: uint8Array, typeId: ConnectionElementPreviewTypeId.Uint8Array };
};

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Read File Element
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// #endregion
