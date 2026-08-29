import { mkdir, readFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { PiattoConfig } from './types.js';
import { createYamlFrontMatter, readFrontMatter, updateFrontMatterValue } from './frontmatter.js';
import { assertInside, exists, slugify, walkFiles, writeAtomic } from './utils.js';

export interface NewPostOptions {
    title?: string;
    slug?: string;
    description?: string;
    tags?: string;
    categories?: string;
    date?: string;
    type?: 'markdown' | 'typst';
    draft?: boolean;
}

export interface PostRecord {
    slug: string;
    bundle: string;
    indexPath: string;
    data: Record<string, unknown>;
}

async function ask(prompt: string): Promise<string> {
    const input = createInterface({ input: stdin, output: stdout });
    try {
        return (await input.question(prompt)).trim();
    } finally {
        input.close();
    }
}

export async function discoverPosts(config: PiattoConfig): Promise<PostRecord[]> {
    const indexes = await walkFiles(config.contentRoot, (filePath) => path.basename(filePath).toLowerCase() === 'index.md');
    const records: PostRecord[] = [];
    for (const indexPath of indexes) {
        const document = await readFrontMatter(indexPath);
        records.push({
            slug: path.relative(config.contentRoot, path.dirname(indexPath)).split(path.sep).join('/'),
            bundle: path.dirname(indexPath),
            indexPath,
            data: document.data,
        });
    }
    return records.sort((a, b) => a.slug.localeCompare(b.slug));
}

function csv(value?: string): string[] {
    return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

export async function createPost(config: PiattoConfig, options: NewPostOptions): Promise<string> {
    const title = options.title ?? (stdin.isTTY ? await ask('Title: ') : '');
    if (!title) throw new Error('A title is required. Pass --title when running non-interactively.');
    const kind = options.type ?? 'markdown';
    const slug = options.slug ? slugify(options.slug) : slugify(title);
    const bundle = path.resolve(config.contentRoot, slug);
    assertInside(config.contentRoot, bundle);
    if (await exists(bundle)) throw new Error(`Post already exists: ${slug}`);

    await mkdir(path.join(bundle, 'images'), { recursive: true });
    const frontMatter: Record<string, unknown> = {
        title,
        description: options.description ?? '',
        date: options.date ?? new Date().toISOString().slice(0, 10),
        draft: options.draft ?? true,
        tags: csv(options.tags),
        categories: csv(options.categories),
        withToc: true,
    };
    if (kind === 'typst') frontMatter.typst = true;
    await writeAtomic(path.join(bundle, 'index.md'), createYamlFrontMatter(frontMatter, kind === 'markdown' ? '\n' : ''));
    if (kind === 'typst') {
        const starter = `// Hugo front matter is available through sys.inputs.\n#let meta = json(bytes(sys.inputs.at("piatto-frontmatter")))\n\n= ${title}\n\nStart writing here.\n`;
        await writeAtomic(path.join(bundle, config.typst.entry), starter);
    }
    return bundle;
}

export async function validatePosts(config: PiattoConfig, selected: string[] = []): Promise<string[]> {
    const problems: string[] = [];
    const posts = await discoverPosts(config);
    const wanted = new Set(selected);
    for (const post of posts) {
        if (wanted.size && !wanted.has(post.slug)) continue;
        if (typeof post.data.title !== 'string' || !post.data.title.trim()) problems.push(`${post.slug}: title is required`);
        if (!post.data.date) problems.push(`${post.slug}: date is required`);
        if (post.data.tags !== undefined && !Array.isArray(post.data.tags)) problems.push(`${post.slug}: tags must be an array`);
        if (post.data.categories !== undefined && !Array.isArray(post.data.categories)) problems.push(`${post.slug}: categories must be an array`);
        if (post.data.typst === true && !(await exists(path.join(post.bundle, config.typst.entry)))) {
            problems.push(`${post.slug}: typst is enabled but ${config.typst.entry} is missing`);
        }
    }
    for (const slug of selected) {
        if (!posts.some((post) => post.slug === slug)) problems.push(`${slug}: post not found`);
    }
    return problems;
}

export async function setDraft(config: PiattoConfig, slug: string, draft: boolean): Promise<void> {
    const indexPath = path.resolve(config.contentRoot, slug, 'index.md');
    assertInside(config.contentRoot, indexPath);
    if (!(await exists(indexPath))) throw new Error(`Post not found: ${slug}`);
    await updateFrontMatterValue(indexPath, 'draft', draft);
}

export async function renamePost(config: PiattoConfig, from: string, to: string, updateLinks = false): Promise<void> {
    const source = path.resolve(config.contentRoot, from);
    const targetSlug = slugify(to);
    const target = path.resolve(config.contentRoot, targetSlug);
    assertInside(config.contentRoot, source);
    assertInside(config.contentRoot, target);
    if (!(await exists(path.join(source, 'index.md')))) throw new Error(`Post not found: ${from}`);
    if (await exists(target)) throw new Error(`Target already exists: ${targetSlug}`);
    await rename(source, target);

    const normalizedFrom = from.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
    const section = path.basename(config.site.contentDir.replaceAll('\\', '/'));
    const replacements = [
        [`/${normalizedFrom}/`, `/${targetSlug}/`],
        [`/${section}/${normalizedFrom}/`, `/${section}/${targetSlug}/`],
    ] as const;
    const references: string[] = [];
    for (const file of await walkFiles(config.contentRoot, (filePath) => /\.(md|typ)$/i.test(filePath))) {
        const content = await readFile(file, 'utf8');
        if (!replacements.some(([oldPath]) => content.includes(oldPath))) continue;
        references.push(path.relative(config.siteRoot, file));
        if (updateLinks) {
            const updated = replacements.reduce((result, [oldPath, newPath]) => result.replaceAll(oldPath, newPath), content);
            await writeAtomic(file, updated);
        }
    }
    if (references.length && !updateLinks) {
        console.warn(`Renamed post, but found references to its previous URL:\n${references.map((item) => `  ${item}`).join('\n')}`);
    }
}

export async function initSite(root: string, configText: string): Promise<void> {
    const configPath = path.join(root, 'piatto.config.toml');
    if (!(await exists(configPath))) await writeAtomic(configPath, configText);
    await mkdir(path.join(root, 'content', 'articles'), { recursive: true });
    await mkdir(path.join(root, 'data'), { recursive: true });
}

export async function listDirectoryNames(directory: string): Promise<string[]> {
    if (!(await exists(directory))) return [];
    return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}
