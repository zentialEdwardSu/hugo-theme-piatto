import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TOML from '@iarna/toml';
import type { PiattoConfig } from './types.js';
import { exists } from './utils.js';

interface RawConfig {
    site?: { root?: string; contentDir?: string; hugoArgs?: string[] };
    typst?: { entry?: string; generatedDir?: string; fontPaths?: string[]; wordsPerMinute?: number };
}

async function findConfig(start: string): Promise<string> {
    let current = path.resolve(start);
    while (true) {
        const candidate = path.join(current, 'piatto.config.toml');
        if (await exists(candidate)) return candidate;
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    throw new Error('Unable to find piatto.config.toml. Run `piatto init` from the site root.');
}

function stringArray(value: unknown, field: string): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error(`${field} must be an array of strings.`);
    }
    return value;
}

export async function loadConfig(explicitPath?: string): Promise<PiattoConfig> {
    const configPath = explicitPath ? path.resolve(explicitPath) : await findConfig(process.cwd());
    const configDir = path.dirname(configPath);
    const parsed = TOML.parse(await readFile(configPath, 'utf8')) as RawConfig;
    const root = parsed.site?.root ?? '.';
    const contentDir = parsed.site?.contentDir ?? 'content/articles';
    const siteRoot = path.resolve(configDir, root);
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const wordsPerMinute = parsed.typst?.wordsPerMinute ?? 220;
    if (!Number.isInteger(wordsPerMinute) || wordsPerMinute <= 0) {
        throw new Error('typst.wordsPerMinute must be a positive integer.');
    }

    return {
        configPath,
        configDir,
        packageRoot,
        siteRoot,
        contentRoot: path.resolve(siteRoot, contentDir),
        site: {
            root,
            contentDir,
            hugoArgs: stringArray(parsed.site?.hugoArgs, 'site.hugoArgs'),
        },
        typst: {
            entry: parsed.typst?.entry ?? 'main.typ',
            generatedDir: parsed.typst?.generatedDir ?? 'generated/typst',
            fontPaths: stringArray(parsed.typst?.fontPaths, 'typst.fontPaths').map((fontPath) => path.resolve(configDir, fontPath)),
            wordsPerMinute,
        },
    };
}

export const defaultConfig = `[site]\nroot = "."\ncontentDir = "content/articles"\nhugoArgs = ["--gc"]\n\n[typst]\nentry = "main.typ"\ngeneratedDir = "generated/typst"\nfontPaths = []\nwordsPerMinute = 220\n`;
