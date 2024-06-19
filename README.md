# DataPos - Application Emulator Connector

A TypeScript library that implements the Application Emulator connector. Emulates a hypothetical application such as SAP SuccessFactors or Salesforce for demonstration, evaluation and testing purposes. It adheres the DataPos Connector interface.

## Installation

The DataPos Operations library contains helper functions to upload connectors to the DataPos hosting platform. A developer account is required to access this functionality. Once uploaded, the DataPos engine will automatically retrieve the connector associated with a given connection at runtime.

## Repository Management Commands

The following list details the repository management commands implementation by this project. The commands are drawn from a common list of commands across all DataPos projects. For more details, please refer to the scripts section of the 'package.json' file in this project.

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
