// ── External Dependencies & Registrations
import { describe, expect, it } from 'vitest';

// ── DPUse Framework
import type { ConnectorConstructor } from '@dpuse/dpuse-shared';

// ── Local Framework
import config from '~/config.json';

// ── Constants ────────────────────────────────────────────────────────────────────────────────────────────────────────

const BUNDLE_URL = new URL(`../dist/${config.id}.es.js`, import.meta.url);

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────────────────────────

// The engine loads the built bundle, not the source the other suites test, so this checks what is actually shipped. CI
// builds before it tests. Locally, run 'npm run build' first.
describe('built bundle', () => {
    it('exports a Connector with every action config.json lists', async () => {
        let bundle: { Connector: ConnectorConstructor };
        try {
            bundle = (await import(BUNDLE_URL.href)) as { Connector: ConnectorConstructor };
        } catch (error) {
            throw new Error("No bundle to test. Run 'npm run build' first.", { cause: error });
        }

        const connector = new bundle.Connector({} as never, []) as unknown as Record<string, unknown>;

        for (const actionName of config.actionNames) expect(typeof connector[actionName], actionName).toBe('function');
    });
});
