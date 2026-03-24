/**
 * ESLint configuration.
 */

/** Dependencies - Framework. */
import dpuse from '@dpuse/eslint-config-dpuse';

/** Exposures - Configuration. */
export default [
    ...dpuse,
    {
        rules: {
            '@typescript-eslint/no-confusing-void-expression': 'off',
            'sonarjs/void-use': 'off'
        }
    }
];
