import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addMaterialIcons, materialIconProxySettings, materialIconUrl, validateMaterialIconName } from '../tools/src/icons.js';
import type { PiattoConfig } from '../tools/src/types.js';
import { writeAtomic } from '../tools/src/utils.js';

const temporary: string[] = [];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M0 0"/></svg>';

afterEach(async () => {
    await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture(): Promise<PiattoConfig> {
    const root = await mkdtemp(path.join(os.tmpdir(), 'piatto-icons-'));
    temporary.push(root);
    return {
        configPath: path.join(root, 'piatto.config.toml'),
        configDir: root,
        packageRoot: path.join(root, 'theme'),
        siteRoot: root,
        contentRoot: path.join(root, 'content', 'articles'),
        site: { root: '.', contentDir: 'content/articles', hugoArgs: [] },
        typst: { entry: 'main.typ', generatedDir: 'generated/typst', fontPaths: [], wordsPerMinute: 220 },
    };
}

describe('Material Symbol downloads', () => {
    it('downloads each missing icon once and skips locally available icons', async () => {
        const config = await fixture();
        await writeAtomic(path.join(config.configDir, 'assets', 'icons', 'material', 'menu.svg'), svg);
        const request = vi.fn(async (_url: string, _options: unknown) => ({ ok: true, status: 200, statusText: 'OK', text: async () => svg }));

        const result = await addMaterialIcons(config, ['menu', 'arrow_back', 'arrow_back'], {
            environment: {},
            request,
        });

        expect(result.added).toEqual(['arrow_back']);
        expect(result.skipped).toEqual(['menu']);
        expect(request).toHaveBeenCalledOnce();
        expect(request.mock.calls[0][0]).toBe(materialIconUrl('arrow_back'));
        expect(await readFile(path.join(result.directory, 'arrow_back.svg'), 'utf8')).toBe(`${svg}\n`);
    });

    it('recognizes icons already supplied by the installed theme', async () => {
        const config = await fixture();
        await writeAtomic(path.join(config.packageRoot, 'assets', 'icons', 'material', 'warning.svg'), svg);
        const request = vi.fn();

        const result = await addMaterialIcons(config, ['warning'], { environment: {}, request });

        expect(result).toMatchObject({ added: [], skipped: ['warning'] });
        expect(request).not.toHaveBeenCalled();
    });

    it('does not write a file when the source is missing or is not SVG', async () => {
        const config = await fixture();
        const notFound = vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found', text: async () => '' }));
        await expect(addMaterialIcons(config, ['not_a_real_symbol'], { environment: {}, request: notFound }))
            .rejects.toThrow('was not found');

        const invalid = vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => '<html>no</html>' }));
        await expect(addMaterialIcons(config, ['also_missing'], { environment: {}, request: invalid }))
            .rejects.toThrow('did not return a valid SVG');
    });

    it('validates names and resolves standard proxy environment variables', () => {
        expect(validateMaterialIconName('  arrow_back  ')).toBe('arrow_back');
        expect(() => validateMaterialIconName('../menu')).toThrow('Invalid Material Symbol name');
        expect(() => validateMaterialIconName('Arrow-Back')).toThrow('Invalid Material Symbol name');
        expect(materialIconProxySettings({
            HTTP_PROXY: 'http://fallback:8080',
            HTTPS_PROXY: 'http://secure:8080',
            NO_PROXY: 'localhost,.example.com',
        })).toEqual({
            httpProxy: 'http://fallback:8080',
            httpsProxy: 'http://secure:8080',
            noProxy: 'localhost,.example.com',
        });
        expect(materialIconProxySettings({ HTTP_PROXY: 'http://fallback:8080' }).httpsProxy).toBe('http://fallback:8080');
    });

    it('rejects an invalid explicit proxy before making a request', async () => {
        const config = await fixture();
        const request = vi.fn();

        await expect(addMaterialIcons(config, ['arrow_back'], {
            environment: { HTTPS_PROXY: 'http://environment:8080' },
            proxy: 'file:///not-a-proxy',
            request,
        })).rejects.toThrow('must use an http:// or https:// URL');
        expect(request).not.toHaveBeenCalled();
    });
});
