import config from './src/config.json';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve('src/index.ts'),
            name: 'DataposFileStoreEmulatorDataConnector',
            formats: ['es'],
            fileName: (format) => `${config.id}-${format}.js`
        },
        target: 'ESNext'
    },
    plugins: [dts({ outDir: 'dist/types' })]
});
