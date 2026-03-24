# DPUse - Application Emulator Connector

<span><!-- OWASP_BADGES_START -->
[![OWASP](https://img.shields.io/badge/OWASP-passed-4CAF50)](https://dpuse.github.io/@dpuse/dpuse-connector-application-emulator/dependency-check-reports/dependency-check-report.html)

<!-- OWASP_BADGES_END --></span>

A TypeScript library that implements the Application Emulator connector. Emulates a hypothetical application such as SAP SuccessFactors or Salesforce for demonstration, evaluation and testing purposes. It adheres the DPUse Connector interface.

## Installation

Use the git clone command to create a local copy.

```
git clone https://github.com/data-positioning/dpuse-connector-application-emulator.git
```

## Uploading

The DPUse Operations library contains helper functions to upload connectors to the DPUse hosting platform. A developer account is required to access this functionality. Once uploaded, the DPUse engine will automatically retrieve the connector associated with a given connection at runtime.

## Repository Management Commands

The following list details the repository management commands implementation by this project. The commands are drawn from a common list of commands across all DPUse projects. For more details, please refer to the scripts section of the 'package.json' file in this project.

| Name               | Key Code Trigger | Notes                                                                                                                                        |
| ------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| audit              | alt+ctrl+shift+a | Audit the project's dependencies for known security vulnerabilities.                                                                         |
| build              | alt+ctrl+shift+b | Type-check, compile and minify for production. Output in '/dist' directory.                                                                  |
| bumpVersion        |                  | Increment the version number. Referenced by 'syncWithGitHub'.                                                                                |
| check              | alt+ctrl+shift+c | List the dependencies in the project that are outdated. Lists dependences that require updating via the 'npm install [name]@latest' command. |
| deploy             | alt+ctrl+shift+d | NOT implemented.                                                                                                                             |
| document           | alt+ctrl+shift+o | Identify the licenses of the project's dependencies.                                                                                         |
| format             | alt+ctrl+shift+f | NOT implemented.                                                                                                                             |
| lint               | alt+ctrl+shift+l | Check the code for potential errors and enforces coding styles.                                                                              |
| publishToNPM       | alt+ctrl+shift+n | NOT implemented.                                                                                                                             |
| release            | alt+ctrl+shift+r | Synchronise the local repository with the main GitHub repository and upload connector to Data Positioning platform.                          |
| syncWithGitHub     | alt+ctrl+shift+s | Synchronise the local repository with the main GitHub repository.                                                                            |
| test               | alt+ctrl+shift+l | NOT implemented.                                                                                                                             |
| test:e2e           |                  | NOT implemented.                                                                                                                             |
| test:unit          |                  | NOT implemented.                                                                                                                             |
| updateDependencies | alt+ctrl+shift+l | Install the latest version of Data Positioning dependencies.                                                                                 |
| updateEngine       |                  | NOT implemented.                                                                                                                             |
| updateOperations   |                  | Referenced by 'updateDependencies'.                                                                                                          |
| updateShareCore    |                  | Referenced by 'updateDependencies'.                                                                                                          |
| uploadConnector    |                  | Referenced by 'release'.                                                                                                                     |
| uploadPresentor    |                  | NOT implemented.                                                                                                                             |

<!-- DEPENDENCY_LICENSES_START -->

| Name                | Type | Installed | Latest  | Latest Released        | Deps | Document                                                                     |
| :------------------ | :--- | :-------: | :-----: | :--------------------- | ---: | :--------------------------------------------------------------------------- |
| @dpuse/dpuse-shared | MIT  |  0.3.595  | 0.3.595 | this month: 2026-03-23 |    0 | [LICENSE](https://raw.githubusercontent.com/dpuse/dpuse-shared/main/LICENSE) |
| csv-parse           | MIT  |   6.2.1   |  6.2.1  | this month: 2026-03-20 |    0 | [LICENSE](https://raw.githubusercontent.com/adaltas/node-csv/master/LICENSE) |
| nanoid              | MIT  |   5.1.7   |  5.1.7  | this month: 2026-03-15 |    0 | [LICENSE](https://raw.githubusercontent.com/ai/nanoid/main/LICENSE)          |

<!-- DEPENDENCY_LICENSES_END -->
