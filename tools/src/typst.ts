import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { toHtml } from 'hast-util-to-html';
import { toText } from 'hast-util-to-text';
import postcss from 'postcss';
import prefixSelector from 'postcss-prefix-selector';
import type { PiattoConfig, TypstManifest } from './types.js';
import type { PostRecord } from './posts.js';
import { discoverPosts } from './posts.js';
import { exists, hashTree, sha256, writeAtomic } from './utils.js';

interface HastNode {
    type: string;
    tagName?: string;
    value?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
}

interface GeneratedAsset {
    name: string;
    content: Buffer;
}

const compilerVersion = 'typst.ts-node-compiler@0.8.0-rc3';
let compiler: NodeCompiler | undefined;
let compilerKey = '';

function getCompiler(config: PiattoConfig): NodeCompiler {
    const key = JSON.stringify([config.siteRoot, config.typst.fontPaths]);
    if (!compiler || key !== compilerKey) {
        compiler = NodeCompiler.create({
            workspace: config.siteRoot,
            fontArgs: config.typst.fontPaths.length ? [{ fontPaths: config.typst.fontPaths }] : undefined,
        });
        compilerKey = key;
    }
    return compiler;
}

function diagnosticText(instance: NodeCompiler, error: unknown): string {
    try {
        return JSON.stringify(instance.fetchDiagnostics(error as never), null, 2);
    } catch {
        return String(error);
    }
}

function safeUrl(value: string, image: boolean): boolean {
    const normalized = value.trim().toLowerCase();
    if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) return false;
    if (normalized.startsWith('data:')) return image && /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(value);
    return /^(?:https?:|mailto:|tel:|#|\/|\.\.?\/)/i.test(value) || !/^[a-z][a-z\d+.-]*:/i.test(value);
}

function assetExtension(mime: string): string {
    const extensions: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
    };
    return extensions[mime.toLowerCase()] ?? 'bin';
}

function sanitizeTree(root: HastNode, assetPrefix: string): { headings: TypstManifest['headings']; assets: GeneratedAsset[] } {
    const blocked = new Set(['script', 'iframe', 'object', 'embed', 'base', 'link', 'form', 'input']);
    const headings: TypstManifest['headings'] = [];
    const assets: GeneratedAsset[] = [];
    const ids = new Map<string, number>();

    const uniqueId = (text: string): string => {
        const base = text.normalize('NFKC').toLocaleLowerCase()
            .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
            .replace(/^-|-$/g, '') || 'section';
        const count = ids.get(base) ?? 0;
        ids.set(base, count + 1);
        return count ? `${base}-${count + 1}` : base;
    };

    const visit = (node: HastNode): HastNode | undefined => {
        if (node.type === 'element' && node.tagName && blocked.has(node.tagName.toLowerCase())) return undefined;
        if (node.properties) {
            for (const key of Object.keys(node.properties)) {
                if (/^on/i.test(key)) delete node.properties[key];
            }
            for (const key of ['href', 'src']) {
                const raw = node.properties[key];
                if (typeof raw !== 'string') continue;
                const isImage = key === 'src' && node.tagName === 'img';
                if (!safeUrl(raw, isImage)) {
                    delete node.properties[key];
                    continue;
                }
                const data = /^data:(image\/(?:png|jpe?g|gif|webp|svg\+xml));base64,(.+)$/is.exec(raw);
                if (data) {
                    const content = Buffer.from(data[2], 'base64');
                    const name = `${sha256(content).slice(0, 20)}.${assetExtension(data[1])}`;
                    if (!assets.some((asset) => asset.name === name)) assets.push({ name, content });
                    node.properties[key] = `${assetPrefix}/assets/${name}`;
                }
            }
        }
        if (node.children) node.children = node.children.map(visit).filter((child): child is HastNode => Boolean(child));
        if (node.type === 'element' && node.tagName && /^h[1-6]$/.test(node.tagName)) {
            node.properties ??= {};
            const text = toText(node as never).trim();
            const id = typeof node.properties.id === 'string' && node.properties.id ? node.properties.id : uniqueId(text);
            node.properties.id = id;
            headings.push({ depth: Number(node.tagName.slice(1)), id, text });
        }
        return node;
    };

    visit(root);
    return { headings, assets };
}

function findElement(root: HastNode, tagName: string): HastNode | undefined {
    if (root.type === 'element' && root.tagName === tagName) return root;
    for (const child of root.children ?? []) {
        const found = findElement(child, tagName);
        if (found) return found;
    }
    return undefined;
}

function collectStyle(root: HastNode): string {
    const head = findElement(root, 'head');
    return (head?.children ?? [])
        .filter((node) => node.tagName === 'style')
        .flatMap((node) => node.children ?? [])
        .filter((node) => node.type === 'text')
        .map((node) => node.value ?? '')
        .join('\n');
}

async function scopeCss(css: string): Promise<string> {
    if (!css.trim()) return '';
    const result = await postcss([
        prefixSelector({
            prefix: '.typst-content',
            transform(prefix, selector, prefixedSelector) {
                if (selector === 'html' || selector === 'body' || selector === ':root') return prefix;
                if (selector.startsWith(prefix)) return selector;
                return prefixedSelector;
            },
        }),
    ]).process(css, { from: undefined });
    return result.css;
}

function countWords(text: string): number {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    return Array.from(segmenter.segment(text)).filter((segment) => segment.isWordLike).length;
}

function makeToc(headings: TypstManifest['headings']): string {
    if (!headings.length) return '';
    return `<nav class="typst-toc"><ol>${headings.map((heading) => `<li class="typst-toc-level-${heading.depth}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`).join('')}</ol></nav>`;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

async function replaceGeneratedDirectory(target: string, stage: string): Promise<void> {
    const backup = `${target}.${process.pid}.old`;
    await rm(backup, { recursive: true, force: true });
    if (await exists(target)) await rename(target, backup);
    try {
        await rename(stage, target);
        await rm(backup, { recursive: true, force: true });
    } catch (error) {
        if (await exists(backup)) await rename(backup, target);
        throw error;
    }
}

export async function compileTypstPost(config: PiattoConfig, post: PostRecord, options: { force?: boolean; write?: boolean } = {}): Promise<'built' | 'skipped'> {
    const entry = path.join(post.bundle, config.typst.entry);
    if (!(await exists(entry))) throw new Error(`${post.slug}: missing ${config.typst.entry}`);
    const generated = path.join(post.bundle, config.typst.generatedDir);
    const sourceHash = sha256(`${await hashTree(post.bundle, generated)}\n${compilerVersion}`);
    const manifestPath = path.join(generated, 'manifest.json');
    if (!options.force && await exists(manifestPath)) {
        try {
            const current = JSON.parse(await readFile(manifestPath, 'utf8')) as TypstManifest;
            if (current.sourceHash === sourceHash) return 'skipped';
        } catch {
            // A malformed manifest is rebuilt below.
        }
    }

    const instance = getCompiler(config);
    const compiled = instance.compileHtml({
        mainFilePath: entry,
        inputs: { 'piatto-frontmatter': JSON.stringify(post.data) },
        resetRead: true,
    });
    if (!compiled.result) {
        compiled.printDiagnostics();
        throw new Error(`${post.slug}: Typst compilation failed`);
    }
    const warnings = compiled.takeWarnings();
    if (warnings) console.warn(`${post.slug}: Typst warnings\n${diagnosticText(instance, warnings)}`);
    const rendered = instance.tryHtml(compiled.result);
    if (!rendered.result) {
        rendered.printDiagnostics();
        throw new Error(`${post.slug}: Typst HTML export failed`);
    }

    const root = rendered.result.hast() as HastNode;
    const body = findElement(root, 'body');
    if (!body) throw new Error(`${post.slug}: Typst output has no body element`);
    const { headings, assets } = sanitizeTree(body, config.typst.generatedDir.replaceAll('\\', '/'));
    const wrapper: HastNode = {
        type: 'element',
        tagName: 'article',
        properties: { className: ['typst-content'] },
        children: body.children ?? [],
    };
    const plainText = toText(wrapper as never).replace(/\s+/g, ' ').trim();
    const wordCount = countWords(plainText);
    const description = typeof post.data.description === 'string' ? post.data.description.trim() : '';
    const manifest: TypstManifest = {
        version: 1,
        compiler: compilerVersion,
        sourceHash,
        generatedAt: new Date().toISOString(),
        summary: description || `${plainText.slice(0, 177)}${plainText.length > 177 ? '…' : ''}`,
        plainText,
        wordCount,
        readingTime: Math.max(1, Math.ceil(wordCount / config.typst.wordsPerMinute)),
        headings,
        assets: assets.map((asset) => `assets/${asset.name}`),
    };

    if (options.write === false) return 'built';
    const stage = `${generated}.${process.pid}.tmp`;
    await rm(stage, { recursive: true, force: true });
    await mkdir(path.join(stage, 'assets'), { recursive: true });
    const compilerCss = collectStyle(root);
    const articleCssPath = path.join(post.bundle, 'typst.css');
    const articleCss = await exists(articleCssPath) ? await readFile(articleCssPath, 'utf8') : '';
    const style = await scopeCss([compilerCss, articleCss].filter(Boolean).join('\n'));
    await Promise.all([
        writeAtomic(path.join(stage, 'body.html'), toHtml(wrapper as never)),
        writeAtomic(path.join(stage, 'toc.html'), makeToc(headings)),
        writeAtomic(path.join(stage, 'style.css'), style),
        writeAtomic(path.join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
        ...assets.map((asset) => writeAtomic(path.join(stage, 'assets', asset.name), asset.content)),
    ]);
    await replaceGeneratedDirectory(generated, stage);
    instance.evictCache(30);
    return 'built';
}

export async function buildTypst(config: PiattoConfig, selected: string[] = [], options: { force?: boolean; write?: boolean } = {}): Promise<{ built: number; skipped: number }> {
    const posts = (await discoverPosts(config)).filter((post) => post.data.typst === true && (!selected.length || selected.includes(post.slug)));
    if (selected.length) {
        const found = new Set(posts.map((post) => post.slug));
        const missing = selected.filter((slug) => !found.has(slug));
        if (missing.length) throw new Error(`Typst post not found: ${missing.join(', ')}`);
    }
    let built = 0;
    let skipped = 0;
    for (const post of posts) {
        const result = await compileTypstPost(config, post, options);
        if (result === 'built') built += 1;
        else skipped += 1;
    }
    return { built, skipped };
}

export async function cleanTypst(config: PiattoConfig): Promise<number> {
    let cleaned = 0;
    for (const post of await discoverPosts(config)) {
        const generated = path.join(post.bundle, config.typst.generatedDir);
        if (await exists(generated)) {
            await rm(generated, { recursive: true, force: true });
            cleaned += 1;
        }
    }
    return cleaned;
}
