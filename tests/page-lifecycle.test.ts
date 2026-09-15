// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@chenglou/pretext', () => ({ prepare: vi.fn(() => ({})), layout: vi.fn(() => ({ height: 100 })) }));
let mountPage: () => Promise<boolean>;
let unmountPage: () => void;
let fixtureNumber = 0;
const disconnect = vi.fn();
const observe = vi.fn();
const mediaAdd = vi.fn();
const mediaRemove = vi.fn();

beforeAll(async () => {
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: mediaAdd, removeEventListener: mediaRemove } as unknown as MediaQueryList));
    ({ mountPage, unmountPage } = await import('../assets/js/main.js'));
});

beforeEach(() => {
    fixtureNumber++;
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
    vi.stubGlobal('ResizeObserver', class { observe = observe; disconnect = disconnect; });
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('fetch', vi.fn());
    document.documentElement.className = 'dark';
    document.body.innerHTML = `<nav class="primary-nav">
        <button data-collapse-toggle="navbar-default" aria-expanded="false"></button>
        <div id="navbar-default" class="primary-nav__panel"><input id="darkmode-toggle" type="checkbox"></div>
        </nav><main id="content"><h1>Page</h1><button id="back-to-top"></button>
        <div class="post-content"><pre><code>const a = 1;</code></pre></div></main>`;
});

afterEach(() => {
    unmountPage();
    document.head.querySelectorAll('[data-piatto-persist]').forEach((script) => script.remove());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    disconnect.mockClear();
    observe.mockClear();
    mediaAdd.mockClear();
    mediaRemove.mockClear();
});

function searchFixture() {
    document.getElementById('content')!.innerHTML = `<h1>Search</h1>
        <input id="searchInput" data-search-index="/blog/index-${fixtureNumber}.json">
        <ul id="searchResults"></ul><div id="hidegroup" class="hidden"></div>
        <p id="noResultsMessage" class="hidden">No matching posts found.</p><span id="resultCount"></span>`;
    (window as any).Fuse = class {
        search(term: string) {
            return [{ item: { title: term, permalink: '/blog/articles/result/', description: 'Description' } }];
        }
    };
    return document.getElementById('searchInput') as HTMLInputElement;
}

describe('page lifecycle', () => {
    it('updates the back-to-top state after scrolling and removes its listener on unmount', async () => {
        vi.stubGlobal('scrollY', 0);
        await mountPage();
        const button = document.getElementById('back-to-top')!;
        expect(button.classList.contains('is-visible')).toBe(false);
        vi.stubGlobal('scrollY', window.innerHeight + 1);
        window.dispatchEvent(new Event('scroll'));
        await vi.waitFor(() => expect(button.classList.contains('is-visible')).toBe(true));
        button.click();
        expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
        vi.stubGlobal('scrollY', 0);
        window.dispatchEvent(new Event('scroll'));
        await vi.waitFor(() => expect(button.classList.contains('is-visible')).toBe(false));
        unmountPage();
        button.click();
        expect(window.scrollTo).toHaveBeenCalledTimes(1);
    });

    it('mounts repeatedly without duplicating menu, theme or code-copy handlers', async () => {
        const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
        for (let i = 0; i < 3; i++) await mountPage();
        expect(document.querySelectorAll('.copy-button')).toHaveLength(1);
        document.querySelector<HTMLButtonElement>('[data-collapse-toggle]')!.click();
        expect(document.getElementById('navbar-default')!.classList.contains('is-open')).toBe(true);
        expect(document.querySelector('[data-collapse-toggle]')!.getAttribute('aria-expanded')).toBe('true');
        document.querySelector<HTMLButtonElement>('[data-collapse-toggle]')!.click();
        expect(document.getElementById('navbar-default')!.classList.contains('is-open')).toBe(false);
        expect(document.querySelector('[data-collapse-toggle]')!.getAttribute('aria-expanded')).toBe('false');
        const toggle = document.getElementById('darkmode-toggle') as HTMLInputElement;
        expect(toggle.checked).toBe(true);
        toggle.click();
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        document.querySelector<HTMLButtonElement>('.copy-button')!.click();
        await vi.waitFor(() => expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith('const a = 1;'));
        unmountPage();
        expect(document.querySelector('.copy-button')).toBeNull();
    });

    it('does not update copy UI after its page is removed', async () => {
        let finish!: () => void;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText: () => new Promise<void>((resolve) => { finish = resolve; }),
        } });
        await mountPage();
        const button = document.querySelector<HTMLButtonElement>('.copy-button')!;
        button.click();
        unmountPage();
        finish();
        await Promise.resolve();
        await Promise.resolve();
        expect(button.dataset.copyState).toBe('idle');
    });

    it('disconnects title observers and cancels font-ready work on an old page', async () => {
        let fontsReady!: () => void;
        Object.defineProperty(document, 'fonts', { configurable: true, value: {
            ready: new Promise<void>((resolve) => { fontsReady = resolve; }),
        } });
        document.getElementById('content')!.innerHTML = '<div data-fit-title><h3 data-fit-title-text>Article</h3></div>';
        await mountPage();
        expect(observe).toHaveBeenCalledOnce();
        unmountPage();
        expect(disconnect).toHaveBeenCalledOnce();
        expect(mediaRemove).toHaveBeenCalledOnce();
        const frame = vi.spyOn(window, 'requestAnimationFrame');
        fontsReady();
        await Promise.resolve();
        expect(frame).not.toHaveBeenCalled();
    });

    it('initializes search after entering from an article and ignores stale queries', async () => {
        await mountPage();
        const input = searchFixture();
        let finish!: (value: Response) => void;
        vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
        await mountPage();
        input.value = 'older';
        input.dispatchEvent(new Event('input'));
        input.value = 'latest';
        input.dispatchEvent(new Event('input'));
        finish(new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
        await vi.waitFor(() => expect(document.querySelector('#searchResults a')?.textContent).toContain('latest'));
        expect(document.querySelector('#searchResults a')?.getAttribute('href')).toBe('/blog/articles/result/');
        expect(fetch).toHaveBeenCalledExactlyOnceWith(`/blog/index-${fixtureNumber}.json`);
        unmountPage();
        const focus = vi.spyOn(input, 'focus');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', ctrlKey: true }));
        expect(focus).not.toHaveBeenCalled();
        await mountPage();
        expect(input.value).toBe('latest');
        expect(document.querySelector('#searchResults a')?.textContent).toContain('latest');
        input.value = 'again';
        input.dispatchEvent(new Event('input'));
        await vi.waitFor(() => expect(document.querySelector('#searchResults a')?.textContent).toContain('again'));
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('does not populate search results after leaving the page', async () => {
        const input = searchFixture();
        let finish!: (value: Response) => void;
        vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
        await mountPage();
        input.value = 'query';
        input.dispatchEvent(new Event('input'));
        unmountPage();
        finish(new Response('[]'));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.querySelectorAll('#searchResults li')).toHaveLength(0);
    });

    it('loads math scripts in order once and renders each new math page', async () => {
        delete (window as any).katex;
        delete (window as any).renderMathInElement;
        document.getElementById('content')!.dataset.katex = 'true';
        const firstMount = mountPage();
        const core = document.querySelector<HTMLScriptElement>('script[src$="/katex.min.js"]')!;
        expect(core).not.toBeNull();
        expect(document.querySelector('script[src$="/auto-render.min.js"]')).toBeNull();
        (window as any).katex = {};
        core.dispatchEvent(new Event('load'));
        await vi.waitFor(() => expect(document.querySelector('script[src$="/auto-render.min.js"]')).not.toBeNull());
        (window as any).renderMathInElement = vi.fn();
        document.querySelector('script[src$="/auto-render.min.js"]')!.dispatchEvent(new Event('load'));
        await firstMount;
        await mountPage();
        expect((window as any).renderMathInElement).toHaveBeenCalledTimes(2);
        expect((window as any).renderMathInElement.mock.calls[0][0]).toBe(document.getElementById('content'));
        expect(document.querySelectorAll('script[data-piatto-persist]')).toHaveLength(2);
        delete (window as any).katex;
        delete (window as any).renderMathInElement;
    });
});
