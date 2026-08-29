import { describe, expect, it } from 'vitest';
import { parseFrontMatter, setFrontMatterValue } from '../tools/src/frontmatter.js';
import { slugify } from '../tools/src/utils.js';

describe('front matter', () => {
    it('parses CRLF YAML without consuming the body', () => {
        const document = parseFrontMatter('---\r\ntitle: Example\r\ndraft: true\r\n---\r\nBody\r\n');
        expect(document.data).toMatchObject({ title: 'Example', draft: true });
        expect(document.body).toBe('Body\n');
    });

    it('updates a scalar while retaining comments and content', () => {
        const document = parseFrontMatter('---\ntitle: Example # retained\ndraft: true\n---\nBody\n');
        const updated = setFrontMatterValue(document, 'draft', false);
        expect(updated).toContain('title: Example # retained');
        expect(updated).toContain('draft: false');
        expect(updated.endsWith('Body\n')).toBe(true);
    });

    it('supports TOML front matter', () => {
        const document = parseFrontMatter('+++\ntitle = "Example"\ndraft = true\n+++\nBody');
        expect(document.data.title).toBe('Example');
        expect(setFrontMatterValue(document, 'draft', false)).toContain('draft = false');
    });
});

describe('slugify', () => {
    it('creates Unicode-safe kebab-case slugs', () => {
        expect(slugify('你好，Piatto Theme')).toBe('你好-piatto-theme');
    });

    it('rejects empty slugs', () => {
        expect(() => slugify('!!!')).toThrow(/usable slug/);
    });
});
