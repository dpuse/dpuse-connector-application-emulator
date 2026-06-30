# DPUse Application Emulator Connector

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
<span><!-- OWASP_BADGES_START -->
[![OWASP](https://img.shields.io/badge/OWASP-passed-4CAF50)](https://dpuse.github.io/dpuse-connector-application-emulator/dependency-check-reports/dependency-check-report.html)

<!-- OWASP_BADGES_END --></span>

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

| Name                             | Type | Installed | Latest  | Latest Released        | Deps | Document                                                                                  |
| :------------------------------- | :--- | :-------: | :-----: | :--------------------- | ---: | :---------------------------------------------------------------------------------------- |
| @dpuse/dpuse-shared              | MIT  |  0.3.595  | 0.3.595 | this month: 2026-03-23 |    0 | [LICENSE](https://raw.githubusercontent.com/dpuse/dpuse-shared/main/LICENSE)              |
| @dpuse/dpuse-tool-csv-parse      | MIT  |  0.0.137  | 0.0.137 | this month: 2026-03-23 |    2 | [LICENSE](https://raw.githubusercontent.com/dpuse/dpuse-tool-csv-parse/main/LICENSE)      |
| @dpuse/dpuse-tool-file-operators | MIT  |  0.0.17   | 0.0.17  | this month: 2026-03-25 |    3 | [LICENSE](https://raw.githubusercontent.com/dpuse/dpuse-tool-file-operators/main/LICENSE) |
| @dpuse/dpuse-tool-rust-csv-core  | MIT  |  0.1.20   | 0.1.20  | this month: 2026-03-25 |    1 | [LICENSE](https://raw.githubusercontent.com/dpuse/dpuse-tool-rust-csv-core/main/LICENSE)  |
| nanoid                           | MIT  |   5.1.7   |  5.1.7  | this month: 2026-03-15 |    0 | [LICENSE](https://raw.githubusercontent.com/ai/nanoid/main/LICENSE)                       |

<!-- DEPENDENCY_LICENSES_END -->

**Installed dependencies are kept up-to-date with latest releases.**

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
