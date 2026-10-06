// ── External Dependencies & Registrations
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Local Framework
import { Connector } from '@/index';

// ── Mocks ────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Tools are loaded at run time from the engine, so each test supplies the tool it needs.
const tools = vi.hoisted((): { byName: Record<string, unknown> } => ({ byName: {} }));
vi.mock('@dpuse/dpuse-shared', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    loadTool: vi.fn((_toolConfigs: unknown, name: string) => Promise.resolve(tools.byName[name]))
}));

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const INDEX_URL = 'https://sample-data-eu.dpuse.app/applicationIndex.json';
const URL_PREFIX = 'https://sample-data-eu.dpuse.app/application';
const OBJECT_PATH = '/hr/workforce/locations.csv';

// A small stand-in for the published application index.
const APPLICATION_INDEX = {
    '': [
        { childCount: 1, name: 'hr', typeId: 'folder' },
        { id: 'locationsId', lastModifiedAt: 1_700_000_000_000, name: 'locations.csv', size: 778, typeId: 'object' }
    ],
    '/hr': [{ childCount: 1, name: 'workforce', typeId: 'folder' }],
    '/hr/workforce': [{ id: 'engagementsId', lastModifiedAt: 1_700_000_000_000, name: 'engagements.csv', size: 1000, typeId: 'object' }]
};

// Serves the index, and rejects any other request.
function stubIndexFetch(): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn((url: string) => (url === INDEX_URL ? Promise.resolve(Response.json(APPLICATION_INDEX)) : Promise.reject(new Error('Unexpected fetch.'))));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function createConnector(): Connector {
    const connectorUtilities = { inferDataTypes: () => ({ columnConfigs: [{ id: 'a' }], hasHeaderRow: true, typedRecords: [['typed']] }) };
    return new Connector(connectorUtilities as never, []);
}

describe('Connector', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        tools.byName = {};
    });

    it('constructs with the static config and no active operation', () => {
        const connector = createConnector();
        expect(connector.config.id).toBe('dpuse-connector-application-emulator');
        expect(connector.abortController).toBeUndefined();
    });

    it('aborts a running operation and clears it, and does nothing when none is running', () => {
        const connector = createConnector();
        expect(() => {
            connector.abortOperation();
        }).not.toThrow();

        const abortController = new AbortController();
        connector.abortController = abortController;
        connector.abortOperation();
        expect(abortController.signal.aborted).toBe(true);
        expect(connector.abortController).toBeUndefined();
    });

    describe('listNodes', () => {
        it('lists the folders and files at the root, from the published index', async () => {
            const fetchMock = stubIndexFetch();

            const result = await createConnector().listNodes({ folderPath: '' });

            expect(fetchMock).toHaveBeenCalledWith(INDEX_URL);
            expect(result.connectionNodeConfigs).toContainEqual(expect.objectContaining({ name: 'hr', label: 'hr', typeId: 'folder', childCount: 1, folderPath: '' }));
            expect(result.connectionNodeConfigs).toContainEqual(
                expect.objectContaining({ id: 'locationsId', label: 'locations.csv', extension: 'csv', mimeType: 'text/csv', size: 778, typeId: 'object' })
            );
            expect(result.totalCount).toBe(result.connectionNodeConfigs.length);
            expect(result.isMore).toBe(false);
        });

        it('loads the index once for a connector, however many folders it lists', async () => {
            const fetchMock = stubIndexFetch();
            const connector = createConnector();

            await connector.listNodes({ folderPath: '' });
            await connector.listNodes({ folderPath: '/hr' });

            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('fails clearly when the index cannot be fetched, and tries again on the next call', async () => {
            const notFound = { ok: false, status: 404, statusText: 'Not Found', text: () => Promise.resolve(''), headers: new Headers() };
            const indexResponse = Response.json(APPLICATION_INDEX);
            vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(notFound).mockResolvedValue(indexResponse));
            const connector = createConnector();

            await expect(connector.listNodes({ folderPath: '' })).rejects.toThrow('Failed to fetch the application index.');
            const retryResult = await connector.listNodes({ folderPath: '' });
            expect(retryResult.totalCount).toBe(2);
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

            expect(await createConnector().findObject({ nodeId: 'engagementsId' } as never)).toEqual({ path: '/hr/workforce' });
        });

        it('rejects an object that does not exist', async () => {
            stubIndexFetch();

            await expect(createConnector().findObject({ nodeId: 'missing' } as never)).rejects.toThrow('Not found.');
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
            expect(connector.abortController).toBeUndefined();
        });

        it('fails when the response has no body', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: null }));

            await expect(createConnector().getReadableStream({ id: '', path: OBJECT_PATH })).rejects.toThrow('Readable streams are not supported in this runtime.');
        });

        it('fails when the fetch is not successful', async () => {
            const response = { ok: false, status: 404, statusText: 'Not Found', text: () => Promise.resolve(''), headers: new Headers() };
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

            await expect(createConnector().getReadableStream({ id: '', path: OBJECT_PATH })).rejects.toThrow(`Failed to fetch '${OBJECT_PATH}' file.`);
        });
    });

    describe('previewObject', () => {
        it('previews the file, parses its text and infers its types', async () => {
            tools.byName['file-previewer'] = {
                previewFile: vi.fn().mockResolvedValue({
                    bytes: new Uint8Array(4),
                    dataFormatId: 'dtv',
                    encodingConfidenceLevel: 100,
                    encodingId: 'utf-8',
                    fileTypeConfig: undefined,
                    text: 'a\n1'
                })
            };
            tools.byName['adaltas-csv-parser'] = {
                parseText: vi.fn().mockResolvedValue({ parsedRecords: [['a'], ['1']], recordDelimiterId: '\n', valueDelimiterId: ',' })
            };

            const preview = await createConnector().previewObject({ path: OBJECT_PATH } as never);

            expect(preview).toEqual(
                expect.objectContaining({
                    columnConfigs: [{ id: 'a' }],
                    dataFormatId: 'dtv',
                    encodingId: 'utf-8',
                    hasHeaders: true,
                    inferenceRecords: [['typed']],
                    parsedRecords: [['a'], ['1']],
                    size: 4,
                    text: 'a\n1',
                    valueDelimiterId: ','
                })
            );
        });

        it('fails for a file of unknown type or with no text', async () => {
            const previewFile = vi.fn().mockResolvedValueOnce({ dataFormatId: undefined }).mockResolvedValueOnce({ dataFormatId: 'dtv', text: undefined });
            tools.byName['file-previewer'] = { previewFile };
            const connector = createConnector();

            await expect(connector.previewObject({ path: OBJECT_PATH } as never)).rejects.toThrow(`File '${OBJECT_PATH}' has unknown type.`);
            await expect(connector.previewObject({ path: OBJECT_PATH } as never)).rejects.toThrow(`File '${OBJECT_PATH}' is empty.`);
            expect(connector.abortController).toBeUndefined();
        });
    });

    describe('retrieveRecords', () => {
        it('streams the file through the CSV parser and reports its summary', async () => {
            const summary = { recordCount: 2 };
            const parseStream = vi.fn().mockResolvedValue(summary);
            tools.byName['adaltas-csv-parser'] = { parseStream };
            const chunk = vi.fn();
            const complete = vi.fn();

            await createConnector().retrieveRecords({ path: OBJECT_PATH, valueDelimiterId: ',' } as never, chunk, complete);

            expect(parseStream).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ delimiter: ',', info: true }),
                `${URL_PREFIX}${OBJECT_PATH}`,
                expect.any(AbortController),
                chunk
            );
            expect(complete).toHaveBeenCalledWith(summary);
        });

        it('passes on a parsing failure', async () => {
            tools.byName['adaltas-csv-parser'] = { parseStream: vi.fn().mockRejectedValue(new Error('Bad CSV.')) };
            const connector = createConnector();

            await expect(connector.retrieveRecords({ path: OBJECT_PATH } as never, vi.fn(), vi.fn())).rejects.toThrow('Bad CSV.');
            expect(connector.abortController).toBeUndefined();
        });
    });

    describe('auditObjectContent', () => {
        it('counts rows with the Rust parser, using transferable streams where supported', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: new ReadableStream<Uint8Array>() }));
            const processWithTransferableStream = vi.fn().mockResolvedValue({ processedRowCount: 10, durationMs: 5 });
            const processWithChunks = vi.fn().mockResolvedValue({ processedRowCount: 20 });
            tools.byName['rust-csv-core-parser'] = { processWithChunks, processWithTransferableStream };
            const connector = createConnector();
            const options = { parsingToolName: 'dpuse-tool-rust-csv-core-parser', path: OBJECT_PATH };

            expect(await connector.auditObjectContent({ ...options, supportsTransferableStreams: true } as never, vi.fn())).toEqual({ processedRowCount: 10, durationMs: 5 });
            expect(await connector.auditObjectContent({ ...options, supportsTransferableStreams: false } as never, vi.fn())).toEqual({ processedRowCount: 20, durationMs: 0 });
        });

        it('parses with the CSV parser otherwise', async () => {
            vi.spyOn(console, 'log').mockReturnValue();
            const parseStream = vi.fn().mockResolvedValue({});
            tools.byName['adaltas-csv-parser'] = { parseStream };

            const result = await createConnector().auditObjectContent({ parsingToolName: 'dpuse-tool-adaltas-csv-parser', path: OBJECT_PATH } as never, vi.fn());

            expect(parseStream).toHaveBeenCalledOnce();
            expect(result).toEqual({ processedRowCount: 0, durationMs: 0 });
        });

        it('passes on a failure and clears the operation', async () => {
            tools.byName['adaltas-csv-parser'] = { parseStream: vi.fn().mockRejectedValue(new Error('Bad CSV.')) };
            const connector = createConnector();

            await expect(connector.auditObjectContent({ path: OBJECT_PATH } as never, vi.fn())).rejects.toThrow('Bad CSV.');
            expect(connector.abortController).toBeUndefined();
        });
    });
});
