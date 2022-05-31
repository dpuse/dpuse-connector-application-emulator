/**
 * @author Jonathan Terrell <terrell.jm@gmail.com>
 * @copyright 2022 Jonathan Terrell
 * @file dataposapp-connector-data-sample-files/gruntfile.js
 * @license ISC
 */

const { getConnectorConfig } = require('../../../dataposapp-engine-main/src/gruntComponentHelpers.js');
const config = require('./src/config.json');
const env = require('./.env.json');
const pkg = require('./package.json');

module.exports = (grunt) => {
    // Initialise configuration.
    grunt.initConfig({
        bump: {
            options: {
                commitFiles: ['-a'],
                commitMessage: '<%if(grunt.config("commitMessage")){%><%=grunt.config("commitMessage")%><%}else{%>Release v%VERSION%<%}%>',
                pushTo: 'origin',
                updateConfigs: ['pkg']
            }
        },

        pkg,

        run: {
            audit: { args: ['npm', 'audit'], cmd: 'npx' },
            copyToFirebase: { args: ['cp', 'dist/*', 'gs://dataposapp-v00-dev-alpha.appspot.com/components/connectors/data/'], cmd: 'gsutil' },
            identifyLicensesUsingLicenseChecker: { args: ['license-checker', '--production', '--json', '--out', 'LICENSES.json'], cmd: 'npx' },
            identifyLicensesUsingNLF: { args: ['nlf', '-d'], cmd: 'npx' },
            lint: { args: ['eslint', 'src/index.ts'], cmd: 'npx' },
            outdated: { args: ['npm', 'outdated'], cmd: 'npx' },
            publish: { args: ['publish'], cmd: 'npx' },
            rollup_cjs: { args: ['rollup', '-c', 'rollup.config-cjs.js', '--environment', 'BUILD:production'], cmd: 'npx' },
            rollup_es: { args: ['rollup', '-c', 'rollup.config-es.js', '--environment', 'BUILD:production'], cmd: 'npx' },
            test: { args: ['WARNING: No tests implemented.'], cmd: 'echo' }
        }
    });

    // ...
    grunt.task.registerTask('updateFirestore', 'Updates Firestore', async function () {
        try {
            const done = this.async();

            const fetchModule = await import('node-fetch');

            // Sign in to firebase.
            const signInResponse = await fetchModule.default(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`, {
                body: JSON.stringify({
                    email: env.FIREBASE_EMAIL_ADDRESS,
                    password: env.FIREBASE_PASSWORD,
                    returnSecureToken: true
                }),
                headers: {
                    Referer: `${env.FIREBASE_PROJECT_ID}.web.app`
                },
                method: 'POST'
            });
            const signInResult = await signInResponse.json();

            // Upsert connector record in application service database (firestore).
            const upsertResponse = await fetchModule.default(`https://europe-west1-${env.FIREBASE_PROJECT_ID}.cloudfunctions.net/api/components`, {
                body: JSON.stringify(getConnectorConfig(config, grunt.config.data.pkg.version)),
                headers: {
                    Authorization: signInResult.idToken,
                    'Content-Type': 'application/json'
                },
                method: 'POST'
            });
            if (!upsertResponse.ok) console.log(upsertResponse.status, upsertResponse.statusText, await upsertResponse.text());

            done();
        } catch (error) {
            console.log(error);
            done(false);
        }
    });

    // Load external tasks.
    grunt.loadNpmTasks('grunt-bump');
    grunt.loadNpmTasks('grunt-run');

    // Register local tasks.
    grunt.registerTask('audit', ['run:audit']); // cmd+shift+a.
    grunt.registerTask('build', ['run:rollup_cjs', 'run:rollup_es', 'run:copyToFirebase', 'updateFirestore']); // cmd+shift+b.
    grunt.registerTask('identifyLicenses', ['run:identifyLicensesUsingLicenseChecker', 'run:identifyLicensesUsingNLF']); // cmd+shift+i.
    grunt.registerTask('lint', ['run:lint']); // cmd+shift+l.
    grunt.registerTask('outdated', ['run:outdated']); // cmd+shift+o.
    grunt.registerTask('publish', ['run:publish']); // cmd+shift+u.
    grunt.registerTask('release', ['bump', 'run:rollup_cjs', 'run:rollup_es', 'run:copyToFirebase', 'updateFirestore']); // cmd+shift+r.
    grunt.registerTask('synchronise', ['bump']); // cmd+shift+s.
    grunt.registerTask('test', ['run:test']); // cmd+shift+t.
};
