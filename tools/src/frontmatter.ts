import { readFile } from 'node:fs/promises';
import TOML from '@iarna/toml';
import YAML from 'yaml';
import type { FrontMatterDocument } from './types.js';
import { writeAtomic } from './utils.js';

export function parseFrontMatter(raw: string): FrontMatterDocument {
    const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const delimiter = normalized.startsWith('---\n') ? '---'
        : normalized.startsWith('+++\n') ? '+++'
            : undefined;
    if (!delimiter) throw new Error('Expected YAML (---) or TOML (+++) front matter.');
    const newlineIndex = normalized.indexOf('\n');
    const closing = normalized.indexOf(`\n${delimiter}`, newlineIndex);
    if (closing < 0) throw new Error(`Unclosed ${delimiter} front matter.`);
    const frontMatter = normalized.slice(newlineIndex + 1, closing);
    const closingEnd = normalized.indexOf('\n', closing + delimiter.length + 1);
    const body = closingEnd < 0 ? '' : normalized.slice(closingEnd + 1);
    const data = delimiter === '---' ? YAML.parse(frontMatter) : TOML.parse(frontMatter);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Front matter must be an object.');
    return {
        data: data as Record<string, unknown>,
        body,
        format: delimiter === '---' ? 'yaml' : 'toml',
        raw: frontMatter,
        delimiter,
    };
}

export async function readFrontMatter(filePath: string): Promise<FrontMatterDocument> {
    return parseFrontMatter(await readFile(filePath, 'utf8'));
}

function scalar(value: string | boolean | number, format: 'yaml' | 'toml'): string {
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    return format === 'yaml' ? JSON.stringify(value) : JSON.stringify(value);
}

export function setFrontMatterValue(document: FrontMatterDocument, key: string, value: string | boolean | number): string {
    const separator = document.format === 'yaml' ? ':' : '=';
    const expression = new RegExp(`^(\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*${separator})[^\\n]*(.*)$`, 'mi');
    const replacement = `$1 ${scalar(value, document.format)}$2`;
    const raw = expression.test(document.raw)
        ? document.raw.replace(expression, replacement)
        : `${document.raw.replace(/\s*$/, '')}\n${key} ${separator} ${scalar(value, document.format)}`;
    return `${document.delimiter}\n${raw}\n${document.delimiter}\n${document.body}`;
}

export async function updateFrontMatterValue(filePath: string, key: string, value: string | boolean | number): Promise<void> {
    const document = await readFrontMatter(filePath);
    await writeAtomic(filePath, setFrontMatterValue(document, key, value));
}

export function createYamlFrontMatter(data: Record<string, unknown>, body = ''): string {
    return `---\n${YAML.stringify(data, { lineWidth: 0 })}---\n${body}`;
}
