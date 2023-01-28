# Data Positioning Application Emulator Data Connector

This repository contains the Application Emulator data connector.

## Installation

The Data Positioning Engine automatically downloads the connector associated with a given connection at runtime.

## Repository Management Commands

The following commands are available for repository management. For implementation details, see the [Grunt](https://gruntjs.com/) configuration file (gruntfile.js).

| Name                            | Key Code    | Notes                                                                                                                                                                                                                      |
| ------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build                           | cmd+shift+b | Type-check, compile and minify for production. Output in '/dist' directory.                                                                                                                                                |
| Identify Licenses               | cmd+shift+i | Identify licenses for all dependencies.                                                                                                                                                                                    |
| Lint                            | cmd+shift+l | Run [ESLint](https://eslint.org/) against the local repository.                                                                                                                                                            |
| Publish to NPM                  | cmd+shift+n | Publish to [npm](https://www.npmjs.com/). Requires prior synchronisation. Use the command line command 'npm publish' when publishing for the first time.                                                                   |
| Release                         | cmd+shift+r | Synchronise the local repository with the GitHub repository and publish to [npm](https://www.npmjs.com/).                                                                                                                  |
| Synchronise with GitHub         | cmd+shift+s | Synchronise the local repository with the GitHub repository.                                                                                                                                                               |
| Update Application Dependencies | cmd+shift+u | Install the latest published release of the [Engine Support](https://github.com/DataPositioning/datapos-engine-support) repository and the [Operations](https://github.com/DataPositioning/datapos-operations) repository. |

## Issues

1. Updating to the latest version of Rollup (v3.0.0 or later) generates plugin dependency errors. Appear to be in '@rollup/plugin-commonjs' and 'rollup-plugin-terser'. Staying with latest version 2 release (2.79.1) for time being. Maybe we should move to Vite?
