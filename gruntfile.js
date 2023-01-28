/**
 * @author Jonathan Terrell <terrell.jm@gmail.com>
 * @copyright 2023 Jonathan Terrell
 * @file datapos-connector-data-application-emulator/gruntfile.js
 * @license ISC
 */

// Application Dependencies
const { uploadConnector } = require('@datapos/datapos-operations/connectorHelpers');
const config = require('./src/config.json');
const env = require('./.env.json');
const pkg = require('./package.json');

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = (grunt) => {
    // Initialise configuration.
    grunt.initConfig({
        bump: { options: { commitFiles: ['-a'], commitMessage: 'Release v%VERSION%', pushTo: 'origin', updateConfigs: ['pkg'] } },
        gitadd: { task: { options: { all: true } } },
        pkg,
        run: {
            copyToFirebase: { args: ['cp', 'dist/datapos-*', 'gs://datapos-v00-dev-alpha.appspot.com/plugins/connectors/data/'], cmd: 'gsutil' },
            identifyLicensesUsingLicenseChecker: { args: ['license-checker', '--production', '--json', '--out', 'LICENSES.json'], cmd: 'npx' },
            identifyLicensesUsingNLF: { args: ['nlf', '-d'], cmd: 'npx' },
            lint: { args: ['eslint', 'src/index.ts'], cmd: 'npx' },
            outdated: { args: ['npm', 'outdated'], cmd: 'npx' },
            rollup_cjs: { args: ['rollup', '-c', 'rollup.config-cjs.js', '--environment', 'BUILD:production'], cmd: 'npx' },
            rollup_iife: { args: ['rollup', '-c', 'rollup.config-iife.js', '--environment', 'BUILD:production'], cmd: 'npx' },
            rollup_es: { args: ['rollup', '-c', 'rollup.config-es.js', '--environment', 'BUILD:production'], cmd: 'npx' },
            rollup_umd: { args: ['rollup', '-c', 'rollup.config-umd.js', '--environment', 'BUILD:production'], cmd: 'npx' },
            updateEngineSupport: { args: ['install', '@datapos/datapos-engine-support@latest'], cmd: 'npm' },
            updateOperations: { args: ['install', '--save-dev', '@datapos/datapos-operations@latest'], cmd: 'npm' }
        }
    });

    // Load external tasks.
    grunt.loadNpmTasks('grunt-bump');
    grunt.loadNpmTasks('grunt-git');
    grunt.loadNpmTasks('grunt-run');

    // Register upload connector task.
    grunt.registerTask('uploadConnector', 'Upload Connector', async function () {
        const done = this.async();
        try {
            const settings = {
                firebaseAPIKey: env.FIREBASE_API_KEY,
                firebaseEmailAddress: env.FIREBASE_EMAIL_ADDRESS,
                firebasePassword: env.FIREBASE_PASSWORD,
                firebaseProjectId: env.FIREBASE_PROJECT_ID,
                sanityAPIToken: env.SANITY_API_TOKEN,
                sanityAPIVersion: env.SANITY_API_VERSION,
                sanityDataSetName: env.SANITY_DATASET_NAME,
                sanityProjectId: env.SANITY_PROJECT_ID
            };
            const status = await uploadConnector(grunt, config, await import('node-fetch'), settings);
            done(status);
        } catch (error) {
            console.log(error);
            done(false);
        }
    });

    // Register standard repository management tasks.
    grunt.registerTask('forceOn', () => grunt.option('force', true));
    grunt.registerTask('forceOff', () => grunt.option('force', false));
    grunt.registerTask('build', ['run:rollup_es']); // cmd+shift+b.
    grunt.registerTask('identifyLicenses', ['run:identifyLicensesUsingLicenseChecker', 'run:identifyLicensesUsingNLF']); // cmd+shift+i.
    grunt.registerTask('lint', ['run:lint']); // cmd+shift+l.
    grunt.registerTask('release', ['gitadd', 'bump', 'run:rollup_es', 'run:copyToFirebase', 'uploadConnector']); // cmd+shift+r.
    grunt.registerTask('synchronise', ['gitadd', 'bump']); // cmd+shift+s.
    grunt.registerTask('updateApplicationDependencies', ['forceOn', 'run:outdated', 'run:updateEngineSupport', 'run:updateOperations']); // cmd+shift+u.

    grunt.registerTask('test', ['uploadConnector']); // cmd+shift+t.
};
