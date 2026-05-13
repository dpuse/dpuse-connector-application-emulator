// DPUse Framework
import dpuse from '@dpuse/eslint-config-dpuse';

// ESLint Configuration
export default [
    ...dpuse,
    {
        rules: {
            '@typescript-eslint/no-confusing-void-expression': 'off'
        }
    }
];
