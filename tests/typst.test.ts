import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../tools/src/config.js';
import { buildTypst } from '../tools/src/typst.js';
import { writeAtomic } from '../tools/src/utils.js';

const temporary: string[] = [];

afterEach(async () => {
    await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture() {
    const root = await mkdtemp(path.join(os.tmpdir(), 'piatto-typst-'));
    temporary.push(root);
    const bundle = path.join(root, 'content', 'articles', 'demo');
    await writeAtomic(path.join(root, 'piatto.config.toml'), '[site]\nroot = "."\ncontentDir = "content/articles"\n[typst]\nentry = "main.typ"\ngeneratedDir = "generated/typst"\nwordsPerMinute = 200\n');
    await writeAtomic(path.join(bundle, 'index.md'), '---\ntitle: Demo\ndate: 2026-08-28\ntypst: true\n---\n');
    await writeAtomic(path.join(bundle, 'main.typ'), '#html.elem("script")[unsafe]\n= Heading\n\nHello *Typst*.');
    return { config: await loadConfig(path.join(root, 'piatto.config.toml')), bundle };
}

describe('Typst HTML pipeline', () => {
    it('creates semantic, sanitized, cacheable page resources', async () => {
        const { config, bundle } = await fixture();
        expect(await buildTypst(config)).toEqual({ built: 1, skipped: 0 });
        const generated = path.join(bundle, 'generated', 'typst');
        const body = await readFile(path.join(generated, 'body.html'), 'utf8');
        const manifest = JSON.parse(await readFile(path.join(generated, 'manifest.json'), 'utf8'));
        expect(body).toContain('class="typst-content"');
        expect(body).toContain('id="heading"');
        expect(body).not.toContain('<script');
        expect(manifest.headings).toEqual([{ depth: 2, id: 'heading', text: 'Heading' }]);
        expect(manifest.wordCount).toBeGreaterThan(1);
        expect(await buildTypst(config)).toEqual({ built: 0, skipped: 1 });
    });
});
