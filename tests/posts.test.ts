import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../tools/src/config.js';
import { createPost, discoverPosts, renamePost, setDraft, validatePosts } from '../tools/src/posts.js';
import { writeAtomic } from '../tools/src/utils.js';

const temporary: string[] = [];

afterEach(async () => {
    await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture() {
    const root = await mkdtemp(path.join(os.tmpdir(), 'piatto-posts-'));
    temporary.push(root);
    const configPath = path.join(root, 'piatto.config.toml');
    await writeAtomic(configPath, '[site]\nroot = "."\ncontentDir = "content/articles"\n[typst]\nentry = "main.typ"\ngeneratedDir = "generated/typst"\n');
    return loadConfig(configPath);
}

describe('post lifecycle', () => {
    it('creates, validates, publishes, and renames a Typst bundle', async () => {
        const config = await fixture();
        await createPost(config, { title: '测试 Post', type: 'typst' });
        await createPost(config, { title: 'Linking Post' });
        const linking = path.join(config.contentRoot, 'linking-post', 'index.md');
        await writeAtomic(linking, `${await readFile(linking, 'utf8')}See /articles/测试-post/.\n`);
        expect(await validatePosts(config)).toEqual([]);
        await setDraft(config, '测试-post', false);
        await renamePost(config, '测试-post', 'renamed-post', true);
        const posts = await discoverPosts(config);
        const renamed = posts.find((post) => post.slug === 'renamed-post');
        expect(posts).toHaveLength(2);
        expect(renamed?.data.draft).toBe(false);
        expect(await readFile(path.join(renamed!.bundle, 'main.typ'), 'utf8')).toContain('piatto-frontmatter');
        expect(await readFile(linking, 'utf8')).toContain('/articles/renamed-post/');
    });
});
