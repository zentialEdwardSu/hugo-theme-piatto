// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { initializeNavigation, isPageUrl } from '../assets/js/navigation.js';

let router: NonNullable<ReturnType<typeof initializeNavigation>>;
let windowListeners: MockInstance<Window['addEventListener']>;
const mount = vi.fn();
const unmount = vi.fn();

function page(title = 'Next', body = '<h1>Next</h1>', nav = 'Next') {
    return `<!doctype html><html lang="zh-CN" dir="ltr"><head><title>${title}</title>
        <meta name="description" content="${title}"><link rel="canonical" href="https://example.org/${title}/">
        <script type="application/ld+json">{"name":"${title}"}</script></head><body>
        <header><nav class="primary-nav"><a aria-current="page" href="/next/">${nav}</a></nav></header>
        <main id="content">${body}</main><footer>Footer</footer></body></html>`;
}

function response(url: string, html = page(), status = 200, type = 'text/html') {
    const result = new Response(html, { status, headers: { 'Content-Type': type } });
    Object.defineProperty(result, 'url', { value: new URL(url, window.location.href).href });
    return result;
}

async function navigate(url: string) {
    const finished = new Promise<void>((resolve) => router.hooks.once('visit:end', () => resolve()));
    router.navigate(url, { animate: false });
    await finished;
}

beforeEach(() => {
    windowListeners = vi.spyOn(window, 'addEventListener');
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal('scrollTo', vi.fn());
    HTMLElement.prototype.scrollIntoView = vi.fn();
    // jsdom has no layout engine; Swup reads the rendered title via innerText.
    Object.defineProperty(HTMLTitleElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; } });
    window.history.replaceState({}, '', '/');
    document.documentElement.className = 'dark';
    document.head.innerHTML = '<title>Start</title><meta name="description" content="Start"><meta name="keywords" content="old">';
    document.body.innerHTML = '<header><nav class="primary-nav">Start</nav></header><main id="content"><h1>Start</h1></main><footer>Original footer</footer>';
    document.body.dataset.clientRouting = 'true';
    document.body.dataset.siteRoot = '/';
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(response(url))));
    router = initializeNavigation({ mount, unmount })!;
});

afterEach(() => {
    router?.destroy();
    for (const [type, listener, options] of windowListeners.mock.calls) {
        window.removeEventListener(type, listener, options);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mount.mockReset();
    unmount.mockReset();
});

describe('page navigation', () => {
    it('replaces content and navigation, updates metadata, and preserves the shell and theme', async () => {
        const header = document.querySelector('header');
        const footer = document.querySelector('footer');
        const events = vi.spyOn(document, 'dispatchEvent');
        await navigate('/next/');
        expect(document.querySelector('header')).toBe(header);
        expect(document.querySelector('footer')).toBe(footer);
        expect(document.querySelector('#content h1')?.textContent).toBe('Next');
        expect(document.querySelector('.primary-nav [aria-current]')?.textContent).toBe('Next');
        expect(document.title).toBe('Next');
        expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Next');
        expect(document.querySelector('meta[name="keywords"]')).toBeNull();
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain('/Next/');
        expect(document.querySelector('[type="application/ld+json"]')?.textContent).toContain('Next');
        expect(document.documentElement.lang).toBe('zh-CN');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.getElementById('content')?.hasAttribute('aria-busy')).toBe(false);
        expect(window.location.pathname).toBe('/next/');
        expect(mount).toHaveBeenCalledOnce();
        expect(unmount).toHaveBeenCalledOnce();
        expect(events.mock.calls.map(([event]) => event.type)).toContain('piatto:before-page-replace');
        expect(events.mock.calls.map(([event]) => event.type)).toContain('piatto:page-load');
        expect(router.options.animationSelector).toBe('#content');
    });

    it('accepts only site HTML links and preserves browser modifier, target and download behavior', async () => {
        const markup = [
            '<a href="https://elsewhere.test/">External</a>', '<a href="/next/" target="_blank">New tab</a>',
            '<a href="/next/" download>Download</a>', '<a href="/next/" data-no-swup>Skip</a>',
            '<a href="/file.pdf">PDF</a>', '<a href="mailto:me@example.org">Mail</a>',
            '<a href="/next/" rel="external">External relation</a>',
        ];
        document.getElementById('content')!.innerHTML = markup.join('');
        const preventNative = (event: Event) => event.preventDefault();
        document.addEventListener('click', preventNative);
        document.querySelectorAll('#content a').forEach((link) => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
        const link = document.createElement('a');
        link.href = '/next/';
        document.body.appendChild(link);
        for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
            link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...modifiers }));
        }
        document.removeEventListener('click', preventNative);
        expect(fetch).not.toHaveBeenCalled();
        expect(isPageUrl('/blog/articles/test/?q=1#heading', 'https://example.org/blog/', '/blog/')).toBe(true);
        expect(isPageUrl('/outside/', 'https://example.org/blog/', '/blog/')).toBe(false);
        expect(isPageUrl('/blogger/', 'https://example.org/blog/', '/blog/')).toBe(false);
        expect(isPageUrl('/blog/read.html', 'https://example.org/blog/', '/blog/')).toBe(true);
    });

    it('routes a normal link click and skips animations for reduced motion', async () => {
        vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
        document.getElementById('content')!.innerHTML = '<a href="/next/">Next</a>';
        const finished = new Promise<void>((resolve) => router.hooks.once('visit:end', () => resolve()));
        document.querySelector<HTMLAnchorElement>('#content a')!.click();
        await finished;
        expect(router.visit.animation.animate).toBe(false);
        expect(window.location.pathname).toBe('/next/');
    });

    it('keeps the latest destination when an older response arrives last', async () => {
        let resolveFirst!: (response: Response) => void;
        vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
        router.navigate('/slow/', { animate: false });
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        expect(document.querySelector('#content h1')?.textContent).toBe('Start');
        await navigate('/next/');
        resolveFirst(response('/slow/', page('Slow', '<h1>Slow</h1>')));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.querySelector('#content h1')?.textContent).toBe('Next');
        expect(window.location.pathname).toBe('/next/');
        expect(mount).toHaveBeenCalledOnce();
    });

    it('handles anchors without refetching and restores history without resetting scroll', async () => {
        document.getElementById('content')!.innerHTML = '<a href="#part">Part</a><h2 id="part">Part</h2>';
        document.querySelector<HTMLAnchorElement>('#content a')!.click();
        expect(fetch).not.toHaveBeenCalled();
        expect(window.location.hash).toBe('#part');
        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
        const state = { ...window.history.state };
        await navigate('/next/');
        vi.mocked(window.scrollTo).mockClear();
        const finished = new Promise<void>((resolve) => router.hooks.once('visit:end', () => resolve()));
        window.history.replaceState(state, '', '/#part');
        window.dispatchEvent(new PopStateEvent('popstate', { state }));
        await finished;
        expect(router.visit.history.popstate).toBe(true);
        expect(router.visit.animation.animate).toBe(false);
        expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('does not partially replace a page with missing containers', async () => {
        vi.mocked(fetch).mockResolvedValue(response('/broken/', '<html><head><title>Broken</title></head><body>Other app</body></html>'));
        const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        router.navigate('/broken/', { animate: false });
        await vi.waitFor(() => expect(back).toHaveBeenCalledOnce());
        expect(document.title).toBe('Start');
        expect(document.querySelector('#content h1')?.textContent).toBe('Start');
        expect(unmount).not.toHaveBeenCalled();
    });

    it.each([
        [404, 'text/html'], [503, 'text/html'], [200, 'application/pdf'],
    ])('falls back for HTTP %i / %s without replacing the document', async (status, type) => {
        vi.mocked(fetch).mockResolvedValue(response('/failure/', page(), status, type));
        const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
        router.navigate('/failure/', { animate: false });
        await vi.waitFor(() => expect(back).toHaveBeenCalledOnce());
        expect(document.title).toBe('Start');
        expect(mount).not.toHaveBeenCalled();
        expect(document.getElementById('content')?.hasAttribute('aria-busy')).toBe(false);
    });

    it('falls back on request timeout', async () => {
        router.options.timeout = 15;
        vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));
        const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
        router.navigate('/timeout/', { animate: false });
        await vi.waitFor(() => expect(back).toHaveBeenCalledOnce());
        expect(document.querySelector('#content h1')?.textContent).toBe('Start');
    });

    it('ignores a failed superseded request without triggering native navigation', async () => {
        let rejectFirst!: (error: Error) => void;
        vi.mocked(fetch).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }));
        const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
        router.navigate('/slow/', { animate: false });
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        await navigate('/next/');
        rejectFirst(new Error('Connection lost'));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(back).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe('/next/');
    });

    it('can be explicitly disabled', () => {
        router.destroy();
        document.body.dataset.clientRouting = 'false';
        expect(initializeNavigation({ mount, unmount })).toBeNull();
    });
});
