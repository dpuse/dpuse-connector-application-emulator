/**
 * @author Jonathan Terrell <terrell.jm@gmail.com>
 * @copyright 2022 Jonathan Terrell
 * @file dataposapp-connector-data-application-emulator/rollup.config-es.js
 * @license ISC
 */

import commonJS from '@rollup/plugin-commonjs'; // Required for sax parser.
import config from './src/config.json';
import json from '@rollup/plugin-json';
import nodePolyfills from 'rollup-plugin-polyfill-node'; // Required for sax parser.
import pkg from './package.json';
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

export default [
    {
        // external: ['chardet'], // TODO: Can be removed when engine main is published as an npm package.
        input: pkg.main,
        output: [
            {
                exports: 'auto',
                file: `./dist/${config.id}-es.js`,
                format: 'es'
            }
        ],
        plugins: [commonJS(), json(), nodePolyfills(), typescript(), terser({ output: { comments: false } })]
    }
];
