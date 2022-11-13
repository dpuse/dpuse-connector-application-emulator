/**
 * @author Jonathan Terrell <terrell.jm@gmail.com>
 * @copyright 2022 Jonathan Terrell
 * @file datapos-connector-data-file-store-emulator/rollup.config-cjs.js
 * @license ISC
 */

// TODO: Consider using 'rollup-plugin-esbuild' and 'rollup-plugin-dts' to build distribution. See https://blog.logrocket.com/using-rollup-package-library-typescript-javascript/.
// TODO: Not possible until rollup is upgraded (version3 or later).

// TODO: Upgrade syntax for JSON file imports. See: https://rollupjs.org/guide/en/#importing-packagejson.
// The latest syntax (line below) triggers a VSCode ESlint error, so temporarily using older 'require' syntax.
// import config from './src/config.json' assert { type: 'json' };
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const config = require('./src/config.json');

import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                exports: 'auto',
                file: `./dist/${config.id}-cjs.js`,
                format: 'cjs'
            }
        ],
        plugins: [nodeResolve(), commonjs(), json(), typescript(), terser({ output: { comments: false } })]
    }
];
