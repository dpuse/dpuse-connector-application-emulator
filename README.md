# DPUse Application Emulator Connector

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A TypeScript library that implements the File Store Emulator connector. It provides easy access to a curated set of files for demonstration and evaluation purposes.

## Rust WebAssembly Helpers

The connector now ships with a lightweight Rust crate located in [rust/dpuse-connector-application-emulator-core](rust/dpuse-connector-application-emulator-core). It is compiled to WebAssembly with `wasm-pack` so TypeScript can call native Rust logic.

- Run `npm run build:rust` (requires the [`wasm-pack` CLI](https://rustwasm.github.io/wasm-pack/installer/)) whenever you change the Rust sources. The command rebuilds the package into [rust/dpuse-connector-application-emulator-core/pkg](rust/dpuse-connector-application-emulator-core/pkg).
- The async wrapper in [src/rustBridge.ts](src/rustBridge.ts) lazy-loads the generated bindings and surfaces helpers like `addNumbersWithRust()` and `checksumWithRust()`.
- `FileStoreEmulatorConnector` exposes `addUsingRust()` and `versionChecksumUsingRust()` so consumers can exercise the Rust-backed functionality without dealing with low-level WebAssembly plumbing.

## Installation

There’s no need to install this connector manually. Once released, it’s uploaded to the Data Positioning Engine cloud and becomes instantly available to all new instances of the browser app. A notification about the new version is also sent to all existing browser apps.

## Reports & Compliance

### Dependency Check Report

The OWASP Dependency Check Report identifies known vulnerabilities in project dependencies. It is generated automatically on each release using the npm package `owasp-dependency-check`. We also rely on GitHub Dependabot to continuously check for vulnerabilities across all dependencies.

[View the OWASP Dependency Check Report](https://dpuse.github.io/dpuse-connector-application-emulator/dependency-check-reports/dependency-check-report.html)

### Dependency Licenses

The following table lists top-level production and peer dependencies. All these dependencies (including transitive ones) have been recursively verified to use Apache-2.0, CC0-1.0, or MIT—commercially friendly licenses with minimal restrictions. Developers cloning this repository should independently verify dev and optional dependencies; users of the uploaded library are covered by these checks.

<!-- DEPENDENCY_LICENSES_START -->

| Dependency                                                                             | Version | License(s)   | Document                                                                          |
| :------------------------------------------------------------------------------------- | :-----: | :----------- | :-------------------------------------------------------------------------------- |
| [@borewit/text-codec](https://github.com/Borewit/text-codec)                           |  0.2.2  | MIT          | [LICENSE](licenses/downloads/@borewit/text-codec@0.2.2-LICENSE.txt)               |
| [@dpuse/dpuse-shared](https://github.com/dpuse/dpuse-shared)                           | 0.3.719 | MIT          | [LICENSE](licenses/downloads/@dpuse/dpuse-shared@0.3.719-LICENSE.txt)             |
| [@dpuse/dpuse-tool-csv-parse](https://github.com/dpuse/dpuse-tool-csv-parse)           | 0.0.143 | MIT          | [LICENSE](licenses/downloads/@dpuse/dpuse-tool-csv-parse@0.0.143-LICENSE.txt)     |
| [@dpuse/dpuse-tool-file-operators](https://github.com/dpuse/dpuse-tool-file-operators) | 0.0.30  | MIT          | [LICENSE](licenses/downloads/@dpuse/dpuse-tool-file-operators@0.0.30-LICENSE.txt) |
| [@dpuse/dpuse-tool-rust-csv-core](https://github.com/dpuse/dpuse-tool-rust-csv-core)   | 0.1.21  | MIT          | [LICENSE](licenses/downloads/@dpuse/dpuse-tool-rust-csv-core@0.1.21-LICENSE.txt)  |
| [@tokenizer/inflate](https://github.com/Borewit/tokenizer-inflate)                     |  0.4.1  | MIT          | [LICENSE](licenses/downloads/@tokenizer/inflate@0.4.1-LICENSE.txt)                |
| [@tokenizer/token](https://github.com/Borewit/tokenizer-token)                         |  0.3.0  | MIT          | [LICENSE](licenses/downloads/@tokenizer/token@0.3.0-LICENSE.txt)                  |
| [chardet](https://github.com/runk/node-chardet)                                        |  2.2.0  | MIT          | [LICENSE](licenses/downloads/chardet@2.2.0-LICENSE.txt)                           |
| [csv-parse](https://github.com/adaltas/node-csv)                                       |  6.2.1  | MIT          | [LICENSE](licenses/downloads/csv-parse@6.2.1-LICENSE.txt)                         |
| [debug](https://github.com/debug-js/debug)                                             |  4.4.3  | MIT          | [LICENSE](licenses/downloads/debug@4.4.3-LICENSE.txt)                             |
| [file-type](https://github.com/sindresorhus/file-type)                                 | 22.0.1  | MIT          | [LICENSE](licenses/downloads/file-type@22.0.1-LICENSE.txt)                        |
| [ieee754](https://github.com/feross/ieee754)                                           |  1.2.1  | BSD-3-Clause | [LICENSE](licenses/downloads/ieee754@1.2.1-LICENSE.txt)                           |
| [ms](https://github.com/vercel/ms)                                                     |  2.1.3  | MIT          | [LICENSE](licenses/downloads/ms@2.1.3-LICENSE.txt)                                |
| [nanoid](https://github.com/ai/nanoid)                                                 | 5.1.16  | MIT          | [LICENSE](licenses/downloads/nanoid@5.1.16-LICENSE.txt)                           |
| [strtok3](https://github.com/Borewit/strtok3)                                          | 10.3.5  | MIT          | [LICENSE](licenses/downloads/strtok3@10.3.5-LICENSE.txt)                          |
| [token-types](https://github.com/Borewit/token-types)                                  |  6.1.2  | MIT          | [LICENSE](licenses/downloads/token-types@6.1.2-LICENSE.txt)                       |
| [uint8array-extras](https://github.com/sindresorhus/uint8array-extras)                 |  1.5.0  | MIT          | [LICENSE](licenses/downloads/uint8array-extras@1.5.0-LICENSE.txt)                 |

<!-- DEPENDENCY_LICENSES_END -->

<!-- DEPENDENCY_TREE_START -->

- **[@dpuse/dpuse-shared](https://github.com/dpuse/dpuse-shared)** 0.3.719 — this month: 2026-06-29
- **[@dpuse/dpuse-tool-csv-parse](https://github.com/dpuse/dpuse-tool-csv-parse)** 0.0.143 — 2 months ago: 2026-04-21
    - **[@dpuse/dpuse-shared](https://github.com/dpuse/dpuse-shared)** 0.3.719 — this month: 2026-06-29
    - **[csv-parse](https://github.com/adaltas/node-csv)** 6.2.1 — 3 months ago: 2026-03-20 → **latest**: 7.0.0 — this month: 2026-06-14 ❗
- **[@dpuse/dpuse-tool-file-operators](https://github.com/dpuse/dpuse-tool-file-operators)** 0.0.30 — this month: 2026-06-30
    - **[@dpuse/dpuse-shared](https://github.com/dpuse/dpuse-shared)** 0.3.719 — this month: 2026-06-29
    - **[chardet](https://github.com/runk/node-chardet)** 2.2.0 — this month: 2026-06-20
    - **[file-type](https://github.com/sindresorhus/file-type)** 22.0.1 — 2 months ago: 2026-04-09
        - **[@tokenizer/inflate](https://github.com/Borewit/tokenizer-inflate)** 0.4.1 — 7 months ago: 2025-11-18 ⚠️
            - **[debug](https://github.com/debug-js/debug)** 4.4.3 — 9 months ago: 2025-09-13 ⚠️
                - **[ms](https://github.com/vercel/ms)** 2.1.3 — 66 months ago: 2020-12-08 ⚠️
            - **[token-types](https://github.com/Borewit/token-types)** 6.1.2 — 5 months ago: 2026-01-01
        - **[strtok3](https://github.com/Borewit/strtok3)** 10.3.5 — 3 months ago: 2026-03-21
            - **[@tokenizer/token](https://github.com/Borewit/tokenizer-token)** 0.3.0 — 59 months ago: 2021-07-12 ⚠️
        - **[token-types](https://github.com/Borewit/token-types)** 6.1.2 — 5 months ago: 2026-01-01
            - **[@borewit/text-codec](https://github.com/Borewit/text-codec)** 0.2.2 — 3 months ago: 2026-03-11
            - **[@tokenizer/token](https://github.com/Borewit/tokenizer-token)** 0.3.0 — 59 months ago: 2021-07-12 ⚠️
            - **[ieee754](https://github.com/feross/ieee754)** 1.2.1 — 68 months ago: 2020-10-27 ⚠️
        - **[uint8array-extras](https://github.com/sindresorhus/uint8array-extras)** 1.5.0 — 10 months ago: 2025-08-22 ⚠️
- **[@dpuse/dpuse-tool-rust-csv-core](https://github.com/dpuse/dpuse-tool-rust-csv-core)** 0.1.21 — 2 months ago: 2026-04-21
    - **[@dpuse/dpuse-shared](https://github.com/dpuse/dpuse-shared)** 0.3.719 — this month: 2026-06-29
- **[nanoid](https://github.com/ai/nanoid)** 5.1.16 — this month: 2026-06-24

<!-- DEPENDENCY_TREE_END -->

### Bundle Analysis Report

The Bundle Analysis Report provides a detailed breakdown of the bundle's composition and module sizes, helping to identify which modules contribute most to the final build. It is generated automatically on each release using the npm package `rollup-plugin-visualizer`.

[View the Bundle Analysis Report](https://dpuse.github.io/dpuse-connector-application-emulator/stats/index.html)

<!-- BUNDLE_START -->

|Chunk/Module/File|Composition|
|:------ |:-----------|
| dpuse-connector-application-emulator.es.js | 11.4 kB · gz 3.7 kB · br 3.2 kB |
| &nbsp;&nbsp;&nbsp;&nbsp;src | `███████████████░░░░░` 72.8% |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;index.ts | `█████████░░░░░░░░░░░` 43.9% |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;config.json | `█████░░░░░░░░░░░░░░░` 22.7% |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;applicationIndex.json | `█░░░░░░░░░░░░░░░░░░░` 6.1% |
| &nbsp;&nbsp;&nbsp;&nbsp;@dpuse/dpuse-shared | `█████░░░░░░░░░░░░░░░` 24.5% |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;dist/dpuse-shared-errors.es.js | `██░░░░░░░░░░░░░░░░░░` 11.3% |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;dist/dpuse-shared-utilities.es.js | `█░░░░░░░░░░░░░░░░░░░` 5.0% |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;dist/dpuse-shared-componentDataView.es.js | `█░░░░░░░░░░░░░░░░░░░` 4.5% |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;dist/dpuse-shared-componentModuleTool.es.js | `█░░░░░░░░░░░░░░░░░░░` 2.7% |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;dist/dpuse-shared-locale.es.js | `░░░░░░░░░░░░░░░░░░░░` 1.0% |
| &nbsp;&nbsp;&nbsp;&nbsp;nanoid | `█░░░░░░░░░░░░░░░░░░░` 2.7% |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;index.browser.js | `░░░░░░░░░░░░░░░░░░░░` 1.6% |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;url-alphabet/index.js | `░░░░░░░░░░░░░░░░░░░░` 1.1% |

<!-- BUNDLE_END -->

## Repository Management Commands

The following list details the repository management commands implementation by this project. For more details, please refer to the scripts section of the 'package.json' file in this project.

| Name                 | VSCode Shortcuts | Notes                                                                                                           |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| audit                | alt+ctrl+shift+a | Audit the project's dependencies for known security vulnerabilities.                                            |
| build                | alt+ctrl+shift+b | Type-check, compile and minify for production. Output in '/dist' directory.                                     |
| build:rust           |                  | Compile the Rust helper crate to WebAssembly via `wasm-pack`. Requires the `wasm-pack` CLI in your PATH.        |
| buildConnectorConfig |                  |                                                                                                                 |
| bumpVersion          | alt+ctrl+shift+v |                                                                                                                 |
| check                | alt+ctrl+shift+c | List the dependencies in the project that are outdated.                                                         |
| document             | alt+ctrl+shift+d | Identify the licenses of the project's dependencies.                                                            |
| format               | alt+ctrl+shift+f | Enforce formatting style rules.                                                                                 |
| lint                 | alt+ctrl+shift+l | Check the code for potential errors and enforces coding styles.                                                 |
| publishToNPM         | alt+ctrl+shift+p | ❌ Not implemented.                                                                                             |
| release              | alt+ctrl+shift+r | Synchronise local repository with the main GitHub repository and upload connector to Data Positioning platform. |
| syncWithGitHub       | alt+ctrl+shift+s | Synchronise local repository with the main GitHub repository.                                                   |
| updateDependencies   | alt+ctrl+shift+l | Install the latest version of all Data Positioning dependencies.                                                |

## Compliance

The following badge reflects FOSSA's assessment of this repository's open-source license compliance.

## License

[MIT](./LICENSE) © 2026 Data Positioning Pty Ltd
