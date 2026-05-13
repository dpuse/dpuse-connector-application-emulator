// External Dependencies
import dts from 'vite-plugin-dts';
import Sonda from 'sonda/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import wasm from 'vite-plugin-wasm';
import { defineConfig, type PluginOption } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Data
import config from './config.json';

// Initialisation
const wasmPlugin = wasm() as PluginOption;

// Configuration
export default defineConfig({
    base: '',
    build: {
        lib: {
            entry: fileURLToPath(new URL('src/index.ts', import.meta.url)),
            fileName: (format) => `${config.id}.${format}.js`,
            formats: ['es']
        },
        rollupOptions: {
            plugins: [
                Sonda({ filename: 'index', format: 'html', gzip: true, brotli: true, open: false, outputDir: './bundle-analysis-reports/sonda' }),
                visualizer({ filename: './bundle-analysis-reports/rollup-visualiser/index.html', open: false, gzipSize: true, brotliSize: true })
            ]
        },
        sourcemap: true,
        target: 'ESNext'
    },
    plugins: [dts({ outDir: 'dist/types' }), wasmPlugin],
    resolve: {
        alias: {
            '~': fileURLToPath(new URL('./', import.meta.url)),
            '@': fileURLToPath(new URL('src', import.meta.url))
        }
    }
});
