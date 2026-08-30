import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

interface SearchResult {
    item: {
        title: string;
        permalink: string;
    };
}

let uniqueSearchResults: (results: SearchResult[], limit: number) => SearchResult[];

beforeAll(async () => {
    vi.stubGlobal('window', {
        addEventListener: vi.fn(),
        matchMedia: () => ({ addEventListener: vi.fn(), matches: false }),
    });
    vi.stubGlobal('document', {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
    });

    ({ uniqueSearchResults } = await import('../assets/js/main.js'));
});

afterAll(() => {
    vi.unstubAllGlobals();
});

describe('uniqueSearchResults', () => {
    it('keeps the highest-ranked result for each article before applying the limit', () => {
        const results = [
            { item: { title: 'First title match', permalink: '/articles/first/' } },
            { item: { title: 'First content match', permalink: '/articles/first/' } },
            { item: { title: 'Second', permalink: '/articles/second/' } },
            { item: { title: 'Third', permalink: '/articles/third/' } },
        ];

        expect(uniqueSearchResults(results, 2)).toEqual([
            results[0],
            results[2],
        ]);
    });
});
