import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { piatto: 'tools/src/cli.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    outDir: 'dist',
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
});
