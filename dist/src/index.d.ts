/**
 * @author Jonathan Terrell <terrell.jm@gmail.com>
 * @copyright 2022 Jonathan Terrell
 * @file datapos-connector-data-application-emulator/src/index.ts
 * @license ISC
 */
import type { ConnectionEntry, ConnectionEntriesPage, ConnectionItem, DataConnector, DataConnectorPreviewInterface, DataConnectorReadInterface } from '@datapos/datapos-engine';
/**
 * Encapsulates the Application Emulator data connector.
 */
export default class ApplicationEmulatorDataConnector implements DataConnector {
    abortController: AbortController;
    readonly connectionItem: ConnectionItem;
    readonly id: string;
    readonly version: string;
    constructor(connectionItem: ConnectionItem);
    /**
     * Abort current processing.
     */
    abort(): void;
    /**
     * Get the preview interface.
     * @returns The preview interface.
     */
    getPreviewInterface(): DataConnectorPreviewInterface;
    /**
     * Get the read interface.
     * @returns The read interface.
     */
    getReadInterface(): DataConnectorReadInterface;
    /**
     * Retrieve a page of entries for a given folder path.
     * @param accountId The identifier of the account to which the source belongs.
     * @param sessionAccessToken An active session access token.
     * @param parentConnectionEntry
     * @returns A page of entries.
     */
    retrieveEntries(accountId: string, sessionAccessToken: string, parentConnectionEntry: ConnectionEntry): Promise<ConnectionEntriesPage>;
}
