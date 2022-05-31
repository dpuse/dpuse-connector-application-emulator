/**
 * @author Jonathan Terrell <terrell.jm@gmail.com>
 * @copyright 2022 Jonathan Terrell
 * @file dataposapp-connector-data-application-emulator/src/index.ts
 * @license ISC
 *
 * Salesforce Developer Site   :
 * Salesforce Developer Console:
 * Salesforce API Documentation: https://help.sap.com/doc/a7c08a422cc14e1eaaffee83610a981d/2205/en-US/SF_HCM_OData_API_DEV.pdf
 */

// Connector asset dependencies.
import config from './config.json';
import env from '../.env.json';
import { version } from '../package.json';

// Engine component dependencies.
import {
    ConnectionItem,
    ConnectionDescription,
    ConnectionElement,
    ConnectionElementPreview,
    ConnectionElementPreviewTypeId,
    ConnectionElementsPage,
    ConnectionElementTypeId,
    convertODataTypeToDataType,
    DataConnector,
    DataConnectorPreviewInterface,
    DataConnectorPreviewInterfaceSettings,
    DataConnectorReadInterface,
    DataStorageTypeId,
    DataType,
    DataUsageTypeId,
    ErrorData,
    FileElement,
    ObjectType,
    SourceViewProperties,
    Progress
} from '../../../../dataposapp-engine-main/src';

// Vendor dependencies.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import sax from '../node_modules/sax/lib/sax.js';
import type { SAXParser } from 'sax';

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

interface Property {
    label?: string;
    maxLength?: number;
    nullable: boolean;
    required: boolean;
    type?: string;
    visible: boolean;
}

interface PendingItem {
    label?: string;
    longDescription?: string;
    properties: Record<string, Property>;
    summary?: string;
    tags: string[];
}

// const defaultChunkSize = 4096;

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

    async describe(
        accountId: string | undefined,
        sessionAccessToken: string | undefined,
        connectionElementId: string | undefined,
        progressCallback: (progress: Progress) => void
    ): Promise<ConnectionDescription> {
        switch (this.connectionItem.implementationId) {
            case 'apiKey':
                return await describeAPIKeyConnection(progressCallback);
            case 'oAuth2':
                return await describeOAuth2Connection(progressCallback);
            // case 'emulator':
            //     throw new Error('Emulator does not support describe method.');
            default:
                throw new Error('Unknown implementation identifier.');
        }
    }

    getPreviewInterface(): DataConnectorPreviewInterface {
        // return { connector: this, previewFileElement };
        throw new Error('Not implemented');
    }

    getReadInterface(): DataConnectorReadInterface {
        throw new Error('Not implemented');
    }

    async listPageOfElementsForDirectoryPath(accountId: string, sessionAccessToken: string, directory: string): Promise<ConnectionElementsPage> {
        switch (this.connectionItem.implementationId) {
            case 'apiKey':
                return await listPageOfElementsForDirectoryPathUsingAPIKey(directory);
            case 'oAuth2':
                return await listPageOfElementsForDirectoryPathUsingOAuth2(directory);
            // case 'emulator':
            //     return await listPageOfElementsForDirectoryPathUsingEmulator(directory);
            default:
                throw new Error('Unknown implementation identifier.');
        }
    }
}

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Describe - OAuth2 Connection
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const describeOAuth2Connection = (progressCallback: (progress: Progress) => void): Promise<ConnectionDescription> => {
    return Promise.resolve({} as ConnectionDescription);
};

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Describe - APIKey Connection
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const describeAPIKeyConnection = async (progressCallback: (progress: Progress) => void): Promise<ConnectionDescription> => {
    const headers: HeadersInit = {
        APIKey: env.SAP_SUCCESS_FACTORS_API_KEY,
        'Content-Type': 'application/xml'
    };
    const response = await fetch(env.SAP_SUCCESS_FACTORS_DESCRIBE_URL_PREFIX, { headers, method: 'GET' });
    if (!response.ok) {
        const data: ErrorData = {
            body: { context: 'describeAPIKeyConnection', message: await response.text() },
            statusCode: response.status,
            statusText: response.statusText
        };
        throw new Error('Unable to describe connection.|' + JSON.stringify(data));
    }
    return await buildDescription(await response.text(), progressCallback);
};

const buildDescription = (text: string, progressCallback: (progress: Progress) => void): Promise<ConnectionDescription> => {
    return new Promise((resolve, reject) => {
        try {
            const connectionDescription: ConnectionDescription = { objectTypes: {}, fileElements: {} };

            const pendingEntityMap: Record<string, PendingItem> = {};
            let pendingItem: PendingItem = undefined;
            let pendingName: string = undefined;
            let pendingText: string = undefined;

            const parser = (sax as { parser: (strict: boolean) => SAXParser }).parser(true);
            parser.onerror = (error) => reject(error);
            parser.onopentag = (node) => {
                switch (node.name) {
                    case 'EntitySet':
                        pendingName = node.attributes.Name as string;
                        pendingItem = { label: node.attributes['sap:label'] as string, properties: {}, tags: [] };
                        pendingEntityMap[pendingName] = pendingItem;
                        break;
                    case 'AssociationSet':
                        break;
                    case 'FunctionImport':
                        break;
                    case 'EntityType':
                        pendingName = node.attributes.Name as string;
                        pendingItem = pendingEntityMap[pendingName];
                        if (!pendingItem) console.log('MISSING ENTITY', pendingName);
                        break;
                    case 'ComplexType':
                        pendingName = node.attributes.Name as string;
                        pendingItem = { label: node.attributes['sap:label'] as string, properties: {}, tags: [] };
                        break;
                    case 'Association':
                        break;
                    case 'Property':
                        if (!pendingItem) break;
                        pendingItem.properties[node.attributes.Name as string] = {
                            label: node.attributes['sap:label'] as string,
                            maxLength: Number(node.attributes['MaxLength'] as string),
                            nullable: node.attributes['Nullable'] === 'true',
                            required: node.attributes['sap:required'] === 'true',
                            type: node.attributes['Type'] as string,
                            visible: node.attributes['sap:visible'] === 'true'
                        };
                        break;
                }
            };
            parser.ontext = (text) => (pendingText = text);
            parser.onclosetag = (name) => {
                switch (name) {
                    case 'EntitySet':
                        pendingItem = undefined;
                        pendingName = undefined;
                        break;
                    case 'AssociationSet':
                        break;
                    case 'FunctionImport':
                        break;
                    case 'EntityType':
                        if (!pendingItem) break;
                        const fileElement = { fields: {}, folderIds: [] } as FileElement;
                        fileElement.description = pendingItem.longDescription;
                        for (const [key, value] of Object.entries(pendingItem.properties)) {
                            fileElement.fields[key] = {
                                dataType: determineDataType(value.type, value.maxLength),
                                isIgnored: false,
                                label: value.label
                            };
                        }
                        for (const tag of pendingItem.tags) fileElement.folderIds.push(tag);
                        fileElement.label = pendingItem.label;
                        fileElement.summary = pendingItem.summary;
                        connectionDescription.fileElements[pendingName] = fileElement;
                        delete pendingEntityMap[pendingName];
                        progressCallback({ id: 'File', value: pendingName });
                        pendingItem = undefined;
                        pendingName = undefined;
                        break;
                    case 'ComplexType':
                        if (!pendingItem) break;
                        const objectType = { fields: {}, folderIds: [] } as ObjectType;
                        objectType.description = pendingItem.longDescription;
                        for (const [key, value] of Object.entries(pendingItem.properties)) {
                            objectType.fields[key] = {
                                dataType: determineDataType(value.type, value.maxLength),
                                isIgnored: false,
                                label: value.label
                            };
                        }
                        for (const tag of pendingItem.tags) objectType.folderIds.push(tag);
                        objectType.label = pendingItem.label;
                        objectType.summary = pendingItem.summary;
                        connectionDescription.objectTypes[pendingName] = objectType;
                        pendingItem = undefined;
                        pendingName = undefined;
                        break;
                    case 'Association':
                        break;
                    case 'Summary':
                        if (!pendingItem) break;
                        pendingItem.summary = pendingText;
                        break;
                    case 'LongDescription':
                        if (!pendingItem) break;
                        pendingItem.longDescription = pendingText;
                        break;
                    case 'sap:tag':
                        if (!pendingItem) break;
                        pendingItem.tags.push(pendingText);
                        break;
                }
            };
            parser.onend = () => resolve(connectionDescription);
            parser.write(text).close();
        } catch (error) {
            reject(error);
        }
    });
};

const determineDataType = (type: string, maximumLength: number | undefined): DataType => {
    if (type.startsWith('SFOData.')) {
        return { objectName: type.substring(8), storageTypeId: DataStorageTypeId.Object, usageTypeId: DataUsageTypeId.Object };
    }
    return convertODataTypeToDataType(type, maximumLength);
};

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region List Page of Elements for Directory Path - Using Emulator
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// const listPageOfElementsForDirectoryPathUsingEmulator = (directoryPath: string): Promise<ConnectionElementsPage> => {
//     return new Promise((resolve, reject) => {
//         try {
//             const elements: ConnectionElement[] = [];
//             switch (directoryPath) {
//                 default:
//                     elements.push(buildObjectItem('', 'empEmployment', 'Emp Employment', 2147));
//                     elements.push(buildObjectItem('', 'empJob', 'Emp Job', 5733));
//                     elements.push(buildObjectItem('', 'perGlobalInfoGBR', 'Per Information Global - GBR', 861));
//                     elements.push(buildObjectItem('', 'perGlobalInfoUSA', 'Per Information Global - USA', 51));
//                     elements.push(buildObjectItem('', 'perPerson', 'Per Person', 2147));
//                     elements.push(buildObjectItem('', 'perPersonal', 'Per Personal', 2174));
//                     break;
//             }
//             resolve({ cursor: undefined, isMore: false, elements });
//         } catch (error) {
//             reject(error);
//         }
//     });
// };

// const buildObjectItem = (directoryPath: string, name: string, label: string, size: number): ConnectionElement => ({
//     _id: undefined,
//     childElementCount: undefined,
//     directoryPath,
//     encodingId: undefined,
//     extension: 'csv',
//     id: name,
//     insertedId: undefined,
//     label,
//     lastModifiedAt: undefined,
//     mimeType: undefined,
//     name: `${name}.csv`,
//     referenceId: undefined,
//     size,
//     typeId: ConnectionElementTypeId.File
// });

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region List Page of Elements for Directory Path - Using OAuth2
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const listPageOfElementsForDirectoryPathUsingOAuth2 = (directoryPath: string): Promise<ConnectionElementsPage> => {
    return new Promise((resolve, reject) => {
        try {
            const elements: ConnectionElement[] = [];
            resolve({ cursor: undefined, isMore: false, elements });
        } catch (error) {
            reject(error);
        }
    });
};

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region List Page of Elements for Directory Path - Using APIKey
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const listPageOfElementsForDirectoryPathUsingAPIKey = (directoryPath: string): Promise<ConnectionElementsPage> => {
    return new Promise((resolve, reject) => {
        try {
            const elements: ConnectionElement[] = [];
            resolve({ cursor: undefined, isMore: false, elements });
        } catch (error) {
            reject(error);
        }
    });
};

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Preview File Element
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// const previewFileElement = async (
//     connector: DataConnector,
//     sourceViewProperties: SourceViewProperties,
//     accountId: string | undefined,
//     sessionAccessToken: string | undefined,
//     previewInterfaceSettings: DataConnectorPreviewInterfaceSettings,
//     connectionElement: ConnectionElement
// ): Promise<ConnectionElementPreview> => {
//     const headers: HeadersInit = {
//         Range: `bytes=0-${previewInterfaceSettings.chunkSize || defaultChunkSize}`
//     };

//     const response = await fetch(`${env.SAP_SUCCESS_FACTORS_URL_PREFIX}%2F${encodeURIComponent(connectionElement.name)}?alt=media`, { headers });
//     if (!response.ok) {
//         const data: ErrorData = {
//             body: { context: 'previewFileElement', message: await response.text() },
//             statusCode: response.status,
//             statusText: response.statusText
//         };
//         throw new Error('Unable to preview element.|' + JSON.stringify(data));
//     }
//     const arrayBuffer = await response.arrayBuffer();
//     const uint8Array = new Uint8Array(arrayBuffer);
//     return { data: uint8Array, typeId: ConnectionElementPreviewTypeId.Uint8Array };
// };

// #endregion

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// #region Read File Element
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// #endregion
