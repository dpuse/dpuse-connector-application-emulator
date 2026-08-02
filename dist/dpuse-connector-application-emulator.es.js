//#region node_modules/nanoid/url-alphabet/index.js
var e = (e = 21) => {
	let t = "", n = crypto.getRandomValues(new Uint8Array(e |= 0));
	for (; e--;) t += "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict"[n[e] & 63];
	return t;
}, t = 2048, n = class extends Error {
	data;
	locator;
	constructor(e, t, n, r) {
		super(e, r), this.name = "DPUseError", this.data = n, this.locator = t;
	}
}, r = class extends n {
	constructor(e, t, n, r) {
		super(e, t, n, r), this.name = "ConnectorError";
	}
}, i = class extends n {
	constructor(e, t, n, r) {
		super(e, t, n, r), this.name = "FetchError";
	}
};
async function a(e, t, n) {
	let r = ` - ${e.statusText}`, a = `${t} Response status '${String(e.status)}${e.statusText ? r : ""}' received.`, c;
	try {
		c = await e.text();
	} catch (e) {
		c = `<body unavailable: ${o(e).message}>`;
	}
	return new i(a, n, { body: s(c) });
}
function o(e) {
	if (e instanceof Error) return e;
	if (typeof e == "string") return Error(e);
	if (typeof e == "number" || typeof e == "boolean" || typeof e == "bigint") return Error(String(e));
	if (typeof e == "symbol") return Error(e.description ?? "Unknown error");
	if (typeof e == "object") try {
		return Error(JSON.stringify(e));
	} catch {
		return /* @__PURE__ */ Error("Unknown error");
	}
	return /* @__PURE__ */ Error("Unknown error");
}
function s(e) {
	if (e != null && e !== "") return e.length > t ? `${e.slice(0, t)}... [truncated]` : e;
}
//#endregion
//#region node_modules/@dpuse/dpuse-shared/dist/dpuse-shared-utilities.es.js
function c(e) {
	if (e) {
		let t = e.lastIndexOf("/") + 1, n = e.lastIndexOf(".");
		return n <= t || n === -1 ? e : e.slice(0, Math.max(0, n));
	}
}
function l(e) {
	if (e) {
		let t = e.lastIndexOf("/") + 1, n = e.lastIndexOf(".");
		if (n <= t) return;
		if (n !== -1) return e.slice(Math.max(0, n + 1));
	}
}
function u(e) {
	switch (e) {
		case "csv": return "text/csv";
		case "tab":
		case "tsv": return "text/tab-separated-values";
		case "xls": return "application/vnd.ms-excel";
		case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
		default: return "application/octet-stream";
	}
}
//#endregion
//#region node_modules/@dpuse/dpuse-shared/dist/dpuse-shared-componentModuleTool.es.js
async function d(e, t) {
	let n = `dpuse-tool-${t}`, r = e.find((e) => e.id === n);
	if (!r) throw Error(`Connector could not load unknown tool '${t}'.`);
	return new (await (import(
		/* @vite-ignore */
		`https://engine-eu.dpuse.app/tools/${t}_v${r.version}/${n}.es.js`
))).Tool();
}
//#endregion
//#region node_modules/@dpuse/dpuse-shared/dist/dpuse-shared-locale.es.js
function f(e) {
	return new Map(Object.entries(e));
}
//#endregion
//#region node_modules/@dpuse/dpuse-shared/dist/dpuse-shared-componentDataView.es.js
f({ en: "Data Positioning Events" }), f({ en: "Delimited Text" }), f({ en: "JSON" }), f({ en: "SPSS" }), f({ en: "XLSX" }), f({ en: "XML" });
var p = [
	",",
	";",
	"	",
	"|",
	" ",
	":",
	"_",
	"!",
	"0x1F",
	"0x1E"
];
f({ en: "Newline" }), f({ en: "Carriage Return" }), f({ en: "Carriage Return/Newline" }), f({ en: "Colon" }), f({ en: "Comma" }), f({ en: "Exclamation Mark" }), f({ en: "Record Separator" }), f({ en: "Semicolon" }), f({ en: "Space" }), f({ en: "Tab" }), f({ en: "Underscore" }), f({ en: "Unit Separator" }), f({ en: "Vertical Bar" });
//#endregion
//#region src/applicationIndex.json
var m = {
	"": [
		{
			childCount: 1,
			name: "hr",
			typeId: "folder"
		},
		{
			id: "1aQFl9vnAFyw-alk9PzQo",
			lastModifiedAt: 1784710155746.4736,
			name: "locations.csv",
			size: 778,
			typeId: "object"
		},
		{
			id: "NDj4FOOntnZxHCaz0b4nh",
			lastModifiedAt: 1784709377538.4497,
			name: "organisations.csv",
			size: 61,
			typeId: "object"
		},
		{
			id: "Z0BWvSy-BT7AJCXMrufMg",
			lastModifiedAt: 1784710155744.9368,
			name: "people.csv",
			size: 1941943,
			typeId: "object"
		}
	],
	"/hr": [{
		childCount: 1,
		name: "workforce",
		typeId: "folder"
	}],
	"/hr/workforce": [{
		id: "khIHY0fayGnfj1aieZT0g",
		lastModifiedAt: 1784710155746.209,
		name: "engagements.csv",
		size: 1358065,
		typeId: "object"
	}]
}, h = {
	id: "dpuse-connector-application-emulator",
	label: { en: "Application Emulator" },
	description: { en: "The Application Emulator Connector is a read-only connector that provides access to a sample dataset simulating a hypothetical application such as Salesforce or SAP. It is intended for demonstration, evaluation, and testing, and is freely available to all users." },
	actionNames: [
		"abortOperation",
		"auditObjectContent",
		"findObject",
		"getReadableStream",
		"listNodes",
		"previewObject",
		"retrieveRecords"
	],
	category: null,
	categoryId: "application",
	firstCreatedAt: null,
	implementations: { default: {
		authMethodId: "none",
		maxConnectionCount: 1
	} },
	icon: "<svg viewBox=\"0 0 333 263\"><path fill=\"#3b82f6\" d=\"M128.947 122.88c6.104 0 11.053 4.949 11.053 11.053v117.894c0 6.105-4.949 11.053-11.053 11.053H70c-38.66 0-70-31.339-70-70 0-38.659 31.34-70 70-70z\" transform-origin=\"70px 192.88px\"/><rect width=\"39.121\" height=\"145.706\" x=\"100.844\" fill=\"#3b82f6\" paint-order=\"fill\" rx=\"7.057\" ry=\"7.057\"/><path fill=\"#ca8a04\" d=\"M171.053 140.001c-6.104 0-11.053-4.949-11.053-11.053V11.054C160 4.949 164.949.001 171.053.001H230c38.66 0 70 31.34 70 70s-31.34 70-70 70z\" transform-origin=\"230px 70.001px\"/><rect width=\"39.121\" height=\"145.706\" x=\"-199.16\" y=\"-262.88\" fill=\"#ca8a04\" paint-order=\"fill\" rx=\"7.057\" ry=\"7.057\" transform=\"scale(-1)\"/><path fill=\"#0d9488\" d=\"M276 263c-31.481 0-57-25.52-57-57v-49.046a7.953 7.953 0 0 1 7.952-7.954h98.095a7.954 7.954 0 0 1 7.953 7.954V206c0 31.48-25.521 57-57 57\" transform-origin=\"276px 206px\"/></svg>",
	iconDark: null,
	lastUpdatedAt: null,
	status: null,
	statusId: "beta",
	typeId: "connector",
	usage: null,
	usageId: "source",
	vendorAccountURL: null,
	vendorDocumentationURL: null,
	vendorHomeURL: null,
	version: "0.0.50"
}, g = "https://sample-data-eu.dpuse.app/application", _ = class {
	abortController;
	config;
	connectorUtilities;
	toolConfigs;
	constructor(e, t) {
		this.abortController = void 0, this.config = h, this.connectorUtilities = e, this.toolConfigs = t;
	}
	abortOperation() {
		this.abortController &&= (this.abortController.abort(), void 0);
	}
	async auditObjectContent(e, t) {
		this.abortController = new AbortController();
		try {
			if (e.parsingToolName === "dpuse-tool-rust-csv-core") {
				let n = await this.getReadableStream({
					id: "",
					path: e.path
				}), r = await d(this.toolConfigs, "rust-csv-core"), i = {
					delimiter: ",",
					hasHeaders: !0
				}, a = e.supportsTransferableStreams ? await r.processWithTransferableStream(n, i, t) : await r.processWithChunks(n, i, t);
				return {
					processedRowCount: a.processedRowCount,
					durationMs: a.durationMs ?? 0
				};
			}
			let n = await d(this.toolConfigs, "csv-parse"), r = {
				delimiter: e.valueDelimiterId,
				relax_column_count: !0,
				relax_quotes: !0
			}, i = `${g}${e.path}`, a = await n.parseStream(e, r, i, this.abortController, (e) => {
				console.log(e);
			});
			return console.log("summary", a), {
				processedRowCount: 0,
				durationMs: 0
			};
		} catch (e) {
			throw o(e);
		} finally {
			this.abortController = void 0;
		}
	}
	findObject(e) {
		let t = m;
		for (let n in t) if (Object.hasOwn(t, n) && t[n]?.find((t) => t.typeId === "object" && t.id === e.nodeId)) return Promise.resolve({
			path: n,
			object: void 0
		});
		return Promise.reject(/* @__PURE__ */ Error("Not found."));
	}
	async getReadableStream(e) {
		let { signal: t } = this.abortController = new AbortController();
		try {
			let n = await fetch(`${g}${e.path}`, { signal: t });
			if (!n.ok) throw await a(n, `Failed to fetch '${e.path}' file.`, "dpuse-connector-file-store-emulator|Connector|getReadableStream");
			if (n.body == null) throw new r("Readable streams are not supported in this runtime.", "dpuse-connector-file-store-emulator|Connector|getReadableStream.unsupported");
			return await Promise.resolve(n.body);
		} catch (e) {
			throw o(e);
		} finally {
			this.abortController = void 0;
		}
	}
	listNodes(e) {
		let t = m[e.folderPath] ?? [], n = [];
		for (let r of t) r.typeId === "folder" ? n.push(v(e.folderPath, r.name, r.childCount)) : n.push(y(e.folderPath, r.id, r.name, r.lastModifiedAt, r.size));
		return Promise.resolve({
			cursor: void 0,
			isMore: !1,
			connectionNodeConfigs: n,
			totalCount: n.length
		});
	}
	async previewObject(e) {
		let { signal: t } = this.abortController = new AbortController();
		try {
			let n = Date.now(), r = performance.now(), i = await (await d(this.toolConfigs, "file-operators")).previewFile(`${g}${e.path}`, t, e.chunkSize);
			if (i.dataFormatId == null) throw Error(`File '${e.path}' has unknown type.`);
			if (i.text == null) throw Error(`File '${e.path}' is empty.`);
			let a = await (await d(this.toolConfigs, "csv-parse")).parseText(i.text, p), o = this.connectorUtilities.inferDataTypes(a.parsedRecords);
			return {
				asAt: n,
				columnConfigs: o.columnConfigs,
				dataFormatId: i.dataFormatId,
				duration: performance.now() - r,
				encodingId: i.encodingId,
				encodingConfidenceLevel: i.encodingConfidenceLevel,
				fileType: i.fileTypeConfig,
				hasHeaders: o.hasHeaderRow,
				recordDelimiterId: a.recordDelimiterId,
				parsedRecords: a.parsedRecords,
				inferenceRecords: o.typedRecords,
				size: i.bytes.length,
				text: i.text,
				valueDelimiterId: a.valueDelimiterId
			};
		} catch (e) {
			throw o(e);
		} finally {
			this.abortController = void 0;
		}
	}
	async retrieveRecords(e, t, n) {
		this.abortController = new AbortController();
		try {
			let r = await d(this.toolConfigs, "csv-parse"), i = {
				delimiter: e.valueDelimiterId,
				info: !0,
				relax_column_count: !0,
				relax_quotes: !0
			}, a = `${g}${e.path}`;
			n(await r.parseStream(e, i, a, this.abortController, t));
		} catch (e) {
			throw o(e);
		} finally {
			this.abortController = void 0;
		}
	}
};
function v(t, n, r) {
	return {
		childCount: r,
		childNodes: [],
		extension: void 0,
		folderPath: t,
		handle: void 0,
		id: e(),
		label: n,
		lastModifiedAt: void 0,
		mimeType: void 0,
		name: n,
		size: void 0,
		typeId: "folder"
	};
}
function y(e, t, n, r, i) {
	let a = c(n) ?? "", o = l(n);
	return {
		childCount: void 0,
		childNodes: [],
		extension: o,
		folderPath: e,
		handle: void 0,
		id: t,
		label: n,
		lastModifiedAt: r,
		mimeType: u(o),
		name: a,
		size: i,
		typeId: "object"
	};
}
//#endregion
export { _ as Connector };

//# sourceMappingURL=dpuse-connector-application-emulator.es.js.map