// ── External Dependencies & Registrations
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

// ── DPUse Framework
import type { AuditObjectContentOptions, ConnectorActionName, DeclaredColumnConfig, FindObjectOptions } from '@dpuse/dpuse-shared';
import type { PreviewObjectOptions, RetrieveRecordsOptions } from '@dpuse/dpuse-shared';

// ── Local Framework
import config from '~/config.json';
import { Connector } from '@/index';
import { name as packageName } from '~/package.json';

// ── Types ────────────────────────────────────────────────────────────────────────────────────────────────────────────

type FetchMock = Mock<(url: string, init: { signal: AbortSignal }) => Promise<unknown>>;

interface Operation {
    name: string;
    holdUntil?: (fetchMock: FetchMock, release: Promise<void>) => Promise<void>; // Only for operations that can be aborted. Settles once the held request has started.
    start: (connector: Connector) => Promise<unknown>;
}
type AbortableOperation = Required<Operation>;

// ── Mocks ────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Tools are loaded at run time from the engine, so each test supplies the tool it needs, or an 'Error' to make its load
// fail. The shared preview, retrieve and audit functions have their own tests in dpuse-shared, so here they only record
// what the connector hands them.
const tools = vi.hoisted((): { byName: Record<string, unknown> } => ({ byName: {} }));
const shared = vi.hoisted(() => ({ auditObjectContentWithParser: vi.fn(), buildPreviewObjectResult: vi.fn(), retrieveRecordsWithParser: vi.fn() }));
vi.mock('@dpuse/dpuse-shared', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    ...shared,
    loadTool: vi.fn((_toolConfigs: unknown, name: string) => {
        const tool = tools.byName[name];
        return tool instanceof Error ? Promise.reject(tool) : Promise.resolve(tool);
    })
}));

// ── Constants ────────────────────────────────────────────────────────────────────────────────────────────────────────

const INDEX_URL = 'https://sample-data-eu.dpuse.app/applicationIndex.json';
const URL_PREFIX = 'https://sample-data-eu.dpuse.app/application';
const OBJECT_PATH = '/HR/Workforce/engagements.csv';

// The Data Resource beside 'engagements.csv', and the columns it states. Any other table has no resource.
const ENGAGEMENTS_RESOURCE_URL = `${URL_PREFIX}/HR/Workforce/engagements.resource.json`;
const ENGAGEMENTS_RESOURCE = {
    dialect: { delimiter: ',', header: true },
    encoding: 'utf-8',
    path: 'engagements.csv',
    schema: {
        fields: [
            { name: 'employmentId', title: 'Employment ID', type: 'string' },
            { name: 'hireDate', title: 'Hire date', type: 'date' }
        ]
    }
};
const ENGAGEMENT_COLUMN_CONFIGS: DeclaredColumnConfig[] = [
    { dataSubtypeId: 'plain', dataTypeId: 'string', label: 'Employment ID', name: 'employmentId' },
    { dataSubtypeId: 'date', dataTypeId: 'temporal', label: 'Hire date', name: 'hireDate' }
];

// A small stand-in for the published application index. Some entries have no label, to test the fall back to the name.
const APP_INDEX = {
    '': [
        { childCount: 1, id: 'hrId', label: 'Human Resources', name: 'HR', typeId: 'folder' },
        { id: 'locationsId', label: 'Locations', lastModifiedAt: 1_700_000_000_000, mimeType: 'text/csv', name: 'locations.csv', size: 778, typeId: 'object' }
    ],
    '/HR': [{ childCount: 2, id: 'workforceId', name: 'Workforce', typeId: 'folder' }],
    '/HR/Workforce': [
        { id: 'engagementsId', lastModifiedAt: 1_700_000_000_000, mimeType: 'text/csv', name: 'engagements.csv', size: 1000, typeId: 'object' },
        { id: 'readmeId', label: 'Read Me', lastModifiedAt: 1_700_000_000_000, mimeType: 'text/markdown', name: 'README.md', size: 100, typeId: 'object' }
    ]
};

const CONNECTOR_UTILITIES = {
    constructColumnAuditor: () => ({ auditRecords: vi.fn(), completeAudit: () => [{ id: 'a' }] }),
    inferDataTypes: () => ({ columnConfigs: [{ id: 'a' }], hasHeaders: true, typedRecords: [['typed']] })
};

// Every action a connector may implement. Typed as a record of 'ConnectorActionName', so the file stops compiling when
// dpuse-shared adds an action until it is listed here.
const CONNECTOR_ACTION_NAMES = Object.keys({
    abortOperation: true,
    auditObjectContent: true,
    closeStore: true,
    createObject: true,
    describeConnection: true,
    dropObject: true,
    findObject: true,
    getInfo: true,
    getReadableStream: true,
    getRecord: true,
    listNodes: true,
    loadObjectRecords: true,
    openStore: true,
    previewObject: true,
    queryRecords: true,
    removeRecords: true,
    retrieveChunks: true,
    retrieveRecords: true,
    upsertRecords: true
} satisfies Record<ConnectorActionName, true>);

// The actions that do work, in the order a user meets them. 'holdUntil', on the ones that create an abort controller,
// makes the action's request wait for 'release' and then succeed: a fetched object for the actions that fetch, a file
// preview for 'previewObject', which reads through the file previewer tool. Previews and audits fetch the table's resource first, so
// the promise it returns says when the held request has actually started.
const OPERATIONS: Operation[] = [
    {
        name: 'listNodes',
        start: (connector) => connector.listNodes({ folderPath: '' })
    },
    {
        name: 'findObject',
        start: (connector) => connector.findObject(buildFindOptions('engagementsId'))
    },
    {
        name: 'getReadableStream',
        holdUntil: holdFetchUntil,
        start: (connector) => connector.getReadableStream({ id: '', path: OBJECT_PATH })
    },
    {
        name: 'previewObject',
        holdUntil: (_fetchMock, release) => {
            const started = Promise.withResolvers<undefined>();
            tools.byName['file-previewer'] = {
                previewFile: async () => {
                    started.resolve(undefined);
                    await release;
                    return {};
                }
            };
            return started.promise;
        },
        start: (connector) => connector.previewObject(buildPreviewOptions())
    },
    {
        name: 'retrieveRecords',
        holdUntil: holdFetchUntil,
        start: (connector) => connector.retrieveRecords(buildRetrieveOptions(), vi.fn(), vi.fn())
    },
    {
        name: 'auditObjectContent',
        holdUntil: holdFetchUntil,
        start: (connector) => connector.auditObjectContent(buildAuditOptions(), vi.fn())
    }
];
const ABORTABLE_OPERATIONS = OPERATIONS.filter((operation): operation is AbortableOperation => operation.holdUntil !== undefined);

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Connector', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        tools.byName = {};
        for (const mock of Object.values(shared)) mock.mockReset();
    });

    // The app reads 'config.json' to decide which actions it can ask the connector for.
    describe('config', () => {
        it('lists exactly the actions the connector implements', () => {
            const connector = createConnector() as unknown as Record<string, unknown>;
            const implementedActionNames = CONNECTOR_ACTION_NAMES.filter((actionName) => typeof connector[actionName] === 'function');

            expect(new Set(config.actionNames)).toEqual(new Set(implementedActionNames));
        });

        it('is identified by the package name, without its scope', () => {
            expect(`@dpuse/${config.id}`).toBe(packageName);
        });
    });

    describe('abortOperation', () => {
        it('does nothing when no operation is running', () => {
            expect(() => {
                createConnector().abortOperation();
            }).not.toThrow();
        });

        it.each(ABORTABLE_OPERATIONS)('stops a running $name', async ({ start }) => {
            stubWaitingRequests();
            const connector = createConnector();

            const operation = start(connector);
            connector.abortOperation();

            await expect(operation).rejects.toThrow('Aborted.');
        });

        // The connector keeps only the latest operation's abort controller. An earlier operation that ends must leave it
        // in place, or the later one could no longer be aborted.
        it.each(ABORTABLE_OPERATIONS)('can still stop a later operation after $name ends', async ({ holdUntil, start }) => {
            const fetchMock = stubWaitingRequests();
            const release = Promise.withResolvers<undefined>();
            const started = holdUntil(fetchMock, release.promise);
            const connector = createConnector();

            const earlierOperation = start(connector);
            await started;
            const laterOperation = connector.getReadableStream({ id: '', path: OBJECT_PATH });
            release.resolve(undefined);
            await earlierOperation;
            connector.abortOperation();

            await expect(laterOperation).rejects.toThrow('Aborted.');
        });
    });

    // A request can fail with a value that is not an 'Error'. The app expects an 'Error', so each action converts it.
    describe('failures', () => {
        it.each(OPERATIONS)('passes on a failure in $name as an Error', async ({ start }) => {
            const failure = 'Network down.';
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));
            tools.byName['file-previewer'] = { previewFile: vi.fn().mockRejectedValue(failure) };

            await expect(start(createConnector())).rejects.toEqual(new Error(failure));
        });
    });

    describe('listNodes', () => {
        it('lists the folders and files at the root, from the published index', async () => {
            const fetchMock = stubIndexFetch();

            const result = await createConnector().listNodes({ folderPath: '' });

            expect(fetchMock).toHaveBeenCalledWith(INDEX_URL, expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }));
            expect(result).toEqual({
                connectionNodeConfigs: [
                    {
                        childCount: 1,
                        description: '',
                        extension: undefined,
                        folderPath: '',
                        icon: null,
                        iconDark: null,
                        id: 'hrId',
                        label: 'Human Resources',
                        lastModifiedAt: undefined,
                        mimeType: undefined,
                        name: 'HR',
                        size: undefined,
                        typeId: 'folder'
                    },
                    {
                        childCount: undefined,
                        description: '',
                        extension: 'csv',
                        folderPath: '',
                        icon: null,
                        iconDark: null,
                        id: 'locationsId',
                        label: 'Locations',
                        lastModifiedAt: 1_700_000_000_000,
                        mimeType: 'text/csv',
                        name: 'locations',
                        size: 778,
                        typeId: 'object'
                    }
                ],
                cursor: undefined,
                isMore: false,
                totalCount: 2
            });
        });

        it('falls back to the name for an entry the index gives no label', async () => {
            stubIndexFetch();
            const connector = createConnector();

            const folderResult = await connector.listNodes({ folderPath: '/HR' });
            const objectResult = await connector.listNodes({ folderPath: '/HR/Workforce' });

            expect(folderResult.connectionNodeConfigs).toContainEqual(expect.objectContaining({ id: 'workforceId', label: 'Workforce', name: 'Workforce' }));
            expect(objectResult.connectionNodeConfigs).toContainEqual(expect.objectContaining({ id: 'engagementsId', label: 'engagements.csv', name: 'engagements' }));
        });

        it("takes a file's MIME type from the index", async () => {
            stubIndexFetch();

            const result = await createConnector().listNodes({ folderPath: '/HR/Workforce' });

            expect(result.connectionNodeConfigs).toContainEqual(
                expect.objectContaining({ id: 'readmeId', extension: 'md', folderPath: '/HR/Workforce', mimeType: 'text/markdown' })
            );
        });

        it('loads the index once for a connector, however many folders it lists', async () => {
            const fetchMock = stubIndexFetch();
            const connector = createConnector();

            await connector.listNodes({ folderPath: '' });
            await connector.listNodes({ folderPath: '/HR' });

            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('shares one index fetch between calls made while it is running', async () => {
            const fetchMock = stubIndexFetch();
            const connector = createConnector();

            await Promise.all([connector.listNodes({ folderPath: '' }), connector.listNodes({ folderPath: '/HR' })]);

            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('fails clearly when the index cannot be fetched, and tries again on the next call', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(buildNotFoundResponse()).mockResolvedValue(Response.json(APP_INDEX)));
            const connector = createConnector();

            await expect(connector.listNodes({ folderPath: '' })).rejects.toThrow('Failed to fetch the application index.');
            const retryResult = await connector.listNodes({ folderPath: '' });
            expect(retryResult.totalCount).toBe(2);
        });

        it('says how long it waited when the index request times out', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('The operation was aborted due to timeout.', 'TimeoutError')));

            await expect(createConnector().listNodes({ folderPath: '' })).rejects.toThrow('Failed to fetch the application index within 30 seconds.');
        });

        it('lists nothing for a folder that does not exist', async () => {
            stubIndexFetch();

            const result = await createConnector().listNodes({ folderPath: '/missing' });

            expect(result.connectionNodeConfigs).toEqual([]);
            expect(result.totalCount).toBe(0);
        });
    });

    describe('findObject', () => {
        it('returns the folder holding an object', async () => {
            stubIndexFetch();

            expect(await createConnector().findObject(buildFindOptions('engagementsId'))).toEqual({ path: '/HR/Workforce' });
        });

        it('rejects an object that does not exist', async () => {
            stubIndexFetch();

            await expect(createConnector().findObject(buildFindOptions('missing'))).rejects.toThrow("Object 'missing' not found.");
        });

        it('finds only files, not a folder with the same id', async () => {
            stubIndexFetch();

            await expect(createConnector().findObject(buildFindOptions('hrId'))).rejects.toThrow("Object 'hrId' not found.");
        });
    });

    describe('getReadableStream', () => {
        it('fetches the object and returns its body', async () => {
            const body = new ReadableStream<Uint8Array>();
            const fetchMock = vi.fn().mockResolvedValue({ ok: true, body });
            vi.stubGlobal('fetch', fetchMock);
            const connector = createConnector();

            expect(await connector.getReadableStream({ id: '', path: OBJECT_PATH })).toBe(body);
            expect(fetchMock).toHaveBeenCalledWith(`${URL_PREFIX}${OBJECT_PATH}`, expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }));
        });

        it('encodes the path, so a name with a space can be fetched', async () => {
            const fetchMock = vi.fn().mockResolvedValue({ ok: true, body: new ReadableStream<Uint8Array>() });
            vi.stubGlobal('fetch', fetchMock);

            await createConnector().getReadableStream({ id: '', path: '/Type Samples/people.csv' });
            expect(fetchMock).toHaveBeenCalledWith(`${URL_PREFIX}/Type%20Samples/people.csv`, expect.anything());
        });

        it('fails when the response has no body', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: null }));

            await expect(createConnector().getReadableStream({ id: '', path: OBJECT_PATH })).rejects.toThrow('Readable streams are not supported in this runtime.');
        });

        it('fails when the fetch is not successful', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildNotFoundResponse()));

            await expect(createConnector().getReadableStream({ id: '', path: OBJECT_PATH })).rejects.toThrow(`Failed to fetch '${OBJECT_PATH}' file.`);
        });
    });

    describe('previewObject', () => {
        // A table is read like a database's, so a format, encoding or delimiter in the options is not used.
        it('previews the table as its resource says, with the columns it states and the parser chosen', async () => {
            const fetchMock = stubResourceFetch();
            const filePreview = { bytes: new Uint8Array(4), dataFormatId: 'dtv', text: 'a,b\n' };
            const previewFile = vi.fn().mockResolvedValue(filePreview);
            tools.byName['file-previewer'] = { previewFile };
            const previewObjectResult = { dataFormatId: 'dtv' };
            shared.buildPreviewObjectResult.mockResolvedValue(previewObjectResult);
            const options = buildPreviewOptions({
                chunkSize: 4096,
                dataFormatId: 'json',
                encodingId: 'utf-16le',
                mimeType: 'text/csv',
                parserId: 'dpuse-tool-adaltas-csv-parser',
                valueDelimiterId: ';'
            });
            const connector = createConnector();

            expect(await connector.previewObject(options)).toBe(previewObjectResult);
            expect(fetchMock).toHaveBeenCalledWith(ENGAGEMENTS_RESOURCE_URL, expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }));
            expect(previewFile).toHaveBeenCalledWith(`${URL_PREFIX}${OBJECT_PATH}`, expect.any(AbortSignal), 4096, 'text/csv', undefined, {
                dataFormatId: 'dtv',
                encodingId: 'utf-8'
            });
            expect(shared.buildPreviewObjectResult).toHaveBeenCalledWith(
                expect.objectContaining({
                    declaredColumnConfigs: ENGAGEMENT_COLUMN_CONFIGS,
                    declaredReadingConfig: { dataFormatId: 'dtv', encodingId: 'utf-8', hasHeaders: true, valueDelimiterId: ',' },
                    filePreview,
                    parserId: 'dpuse-tool-adaltas-csv-parser',
                    toolConfigs: []
                })
            );
        });

        it('reads a table without a resource as the user chose, and leaves its types to inference', async () => {
            stubResourceFetch();
            const previewFile = vi.fn().mockResolvedValue({});
            tools.byName['file-previewer'] = { previewFile };

            await createConnector().previewObject(buildPreviewOptions({ dataFormatId: 'dtv', encodingId: 'utf-16le', path: '/HR/Workforce/README.md', valueDelimiterId: ';' }));

            expect(previewFile).toHaveBeenCalledWith(expect.any(String), expect.any(AbortSignal), undefined, undefined, undefined, { dataFormatId: 'dtv', encodingId: 'utf-16le' });
            expect(shared.buildPreviewObjectResult).toHaveBeenCalledWith(
                expect.objectContaining({ declaredColumnConfigs: undefined, declaredReadingConfig: undefined, valueDelimiterId: ';' })
            );
        });

        it('fetches the resource of a table whose name has a space', async () => {
            const fetchMock = stubResourceFetch();
            tools.byName['file-previewer'] = { previewFile: vi.fn().mockResolvedValue({}) };

            await createConnector().previewObject(buildPreviewOptions({ path: '/Type Samples/people.csv' }));

            expect(fetchMock).toHaveBeenCalledWith(`${URL_PREFIX}/Type%20Samples/people.resource.json`, expect.anything());
        });

        it('fails when the resource cannot be fetched, rather than reading the table without it', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503, statusText: 'Service Unavailable' })));
            tools.byName['file-previewer'] = { previewFile: vi.fn().mockResolvedValue({}) };

            await expect(createConnector().previewObject(buildPreviewOptions())).rejects.toThrow("Failed to fetch '/HR/Workforce/engagements.resource.json' resource.");
            expect(shared.buildPreviewObjectResult).not.toHaveBeenCalled();
        });

        // The file previewer encodes the URL itself, so the connector must hand it the path as it is, or a name with a space
        // would be encoded twice.
        it('hands the file previewer the path unencoded', async () => {
            stubResourceFetch();
            const previewFile = vi.fn().mockResolvedValue({});
            tools.byName['file-previewer'] = { previewFile };

            await createConnector().previewObject(buildPreviewOptions({ path: '/Type Samples/people.csv' }));

            expect(previewFile).toHaveBeenCalledWith(`${URL_PREFIX}/Type Samples/people.csv`, expect.any(AbortSignal), undefined, undefined, undefined, expect.anything());
        });

        it('fails when the file previewer tool cannot be loaded', async () => {
            stubResourceFetch();
            tools.byName['file-previewer'] = new Error('Failed to load the file previewer.');

            await expect(createConnector().previewObject(buildPreviewOptions())).rejects.toThrow('Failed to load the file previewer.');
            expect(shared.buildPreviewObjectResult).not.toHaveBeenCalled();
        });
    });

    describe('retrieveRecords', () => {
        it('fetches the object, reads it as its preview did with the parser that read it, and reports the summary', async () => {
            const body = new ReadableStream<Uint8Array>();
            const fetchMock = stubObjectFetch({ ok: true, body });
            const summary = { recordCount: 3 };
            shared.retrieveRecordsWithParser.mockResolvedValue(summary);
            // Loading into a store, the engine's 'chunk' returns a promise so the read waits for each batch to be stored.
            // The parser must receive that same function for the wait to work.
            const chunk = vi.fn(() => Promise.resolve());
            const complete = vi.fn();
            const options = buildRetrieveOptions({ parserId: 'dpuse-tool-adaltas-csv-parser' });
            const connector = createConnector();

            await connector.retrieveRecords(options, chunk, complete);

            expect(fetchMock).toHaveBeenCalledWith(`${URL_PREFIX}${OBJECT_PATH}`, expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }));
            expect(shared.retrieveRecordsWithParser).toHaveBeenCalledWith({
                chunk,
                options,
                signal: expect.any(AbortSignal) as AbortSignal,
                stream: body,
                toolConfigs: []
            });
            expect(complete).toHaveBeenCalledWith(summary);
        });

        it('fails when the object cannot be fetched', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildNotFoundResponse()));

            await expect(createConnector().retrieveRecords(buildRetrieveOptions(), vi.fn(), vi.fn())).rejects.toThrow(`Failed to fetch '${OBJECT_PATH}' file.`);
            expect(shared.retrieveRecordsWithParser).not.toHaveBeenCalled();
        });

        it('passes on a failure to read the records, without reporting the read as complete', async () => {
            stubObjectFetch({ ok: true, body: new ReadableStream<Uint8Array>() });
            shared.retrieveRecordsWithParser.mockRejectedValue(new Error('Bad CSV.'));
            const complete = vi.fn();

            await expect(createConnector().retrieveRecords(buildRetrieveOptions(), vi.fn(), complete)).rejects.toThrow('Bad CSV.');
            expect(complete).not.toHaveBeenCalled();
        });
    });

    describe('auditObjectContent', () => {
        it('fetches the object and audits it as its preview read it, with the columns its resource states', async () => {
            const body = new ReadableStream<Uint8Array>();
            stubObjectFetch({ ok: true, body });
            const auditResult = { contentAuditConfig: { recordCount: 2 }, hasHeaders: true };
            shared.auditObjectContentWithParser.mockResolvedValue(auditResult);
            const chunk = vi.fn();
            const options = buildAuditOptions({ dataFormatId: 'json', encodingId: 'utf-16le', hasHeaders: undefined, valueDelimiterId: ';' });
            const connector = createConnector();

            expect(await connector.auditObjectContent(options, chunk)).toBe(auditResult);
            expect(shared.auditObjectContentWithParser).toHaveBeenCalledWith(
                expect.objectContaining({
                    constructColumnAuditor: CONNECTOR_UTILITIES.constructColumnAuditor,
                    declaredColumnConfigs: ENGAGEMENT_COLUMN_CONFIGS,
                    onProgress: chunk,
                    options,
                    stream: body,
                    toolConfigs: []
                })
            );
        });

        it('passes on a failure to read the content', async () => {
            stubObjectFetch({ ok: true, body: new ReadableStream<Uint8Array>() });
            shared.auditObjectContentWithParser.mockRejectedValue(new Error('Bad CSV.'));

            await expect(createConnector().auditObjectContent(buildAuditOptions(), vi.fn())).rejects.toThrow('Bad CSV.');
        });
    });
});

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function createConnector(): Connector {
    return new Connector(CONNECTOR_UTILITIES as never, []);
}

function buildAuditOptions(overrides: Partial<AuditObjectContentOptions> = {}): AuditObjectContentOptions {
    return {
        byteLimit: undefined,
        chunkSize: undefined,
        dataFormatId: 'dtv',
        encodingId: 'utf-8',
        hasHeaders: undefined,
        parserId: undefined,
        path: OBJECT_PATH,
        stopSignal: undefined,
        supportsTransferableStreams: false,
        valueDelimiterId: ',',
        ...overrides
    };
}

function buildFindOptions(nodeId: string): FindObjectOptions {
    return { nodeId, storeId: undefined };
}

function buildPreviewOptions(overrides: Partial<PreviewObjectOptions> = {}): PreviewObjectOptions {
    return {
        chunkSize: undefined,
        dataFormatId: undefined,
        encodingId: undefined,
        extension: undefined,
        mimeType: undefined,
        parserId: undefined,
        path: OBJECT_PATH,
        valueDelimiterId: undefined,
        ...overrides
    };
}

function buildRetrieveOptions(overrides: Partial<RetrieveRecordsOptions> = {}): RetrieveRecordsOptions {
    return { chunkSize: undefined, dataFormatId: 'dtv', encodingId: 'utf-8', parserId: undefined, path: OBJECT_PATH, valueDelimiterId: ',', ...overrides };
}

// The response the bucket sends for a file it does not hold.
function buildNotFoundResponse(): Response {
    return new Response(null, { status: 404, statusText: 'Not Found' });
}

// Serves the index, and rejects any other request.
function stubIndexFetch(): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn((url: string) => (url === INDEX_URL ? Promise.resolve(Response.json(APP_INDEX)) : Promise.reject(new Error('Unexpected fetch.'))));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

// Serves the tables' resources, and rejects any other request.
function stubResourceFetch(): FetchMock {
    const fetchMock: FetchMock = vi.fn((url: string) => (isResourceUrl(url) ? Promise.resolve(buildResourceResponse(url)) : Promise.reject(new Error('Unexpected fetch.'))));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

// Serves the tables' resources, and the response given for any other request.
function stubObjectFetch(response: unknown): FetchMock {
    const fetchMock: FetchMock = vi.fn((url: string) => Promise.resolve(isResourceUrl(url) ? buildResourceResponse(url) : response));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function isResourceUrl(url: string): boolean {
    return url.endsWith('.resource.json');
}

// The bucket's response for a table's resource: the resource beside 'engagements.csv', and not found for any other table.
function buildResourceResponse(url: string): Response {
    return url === ENGAGEMENTS_RESOURCE_URL ? Response.json(ENGAGEMENTS_RESOURCE) : buildNotFoundResponse();
}

// Stands in for a request that is still running: it settles only by failing, once the signal is aborted. A signal
// aborted before the request starts fails it at once, as 'fetch' does.
function waitForAbort(signal: AbortSignal): Promise<never> {
    return new Promise((_resolve, reject) => {
        if (signal.aborted) reject(new Error('Aborted.'));
        signal.addEventListener('abort', () => {
            reject(new Error('Aborted.'));
        });
    });
}

// Makes every fetch, and every file preview, run until it is aborted. A table's resource is still served at once, because
// previews and audits fetch it first.
function stubWaitingRequests(): FetchMock {
    const fetchMock: FetchMock = vi.fn((url: string, init: { signal: AbortSignal }) =>
        isResourceUrl(url) ? Promise.resolve(buildResourceResponse(url)) : waitForAbort(init.signal)
    );
    vi.stubGlobal('fetch', fetchMock);
    tools.byName['file-previewer'] = { previewFile: (_url: string, signal: AbortSignal) => waitForAbort(signal) };
    return fetchMock;
}

// Makes the next fetch of an object wait for 'release' and then succeed. Every other request runs as before.
function holdFetchUntil(fetchMock: FetchMock, release: Promise<void>): Promise<void> {
    const runRequest = fetchMock.getMockImplementation();
    const started = Promise.withResolvers<undefined>();
    let isHolding = true;
    fetchMock.mockImplementation(async (url, init) => {
        if (!isHolding || isResourceUrl(url)) return runRequest?.(url, init);
        isHolding = false;
        started.resolve(undefined);
        await release;
        return { ok: true, body: new ReadableStream<Uint8Array>() };
    });
    return started.promise;
}
