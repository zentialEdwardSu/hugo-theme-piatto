import Swup from 'swup';
import SwupHeadPlugin from '@swup/head-plugin';
import SwupA11yPlugin from '@swup/a11y-plugin';

const containers = ['#content', '.primary-nav'];

export function isPageUrl(href, base = window.location.href, siteRoot = '/') {
    try {
        const url = new URL(href, base);
        const current = new URL(base);
        const root = new URL(siteRoot, base).pathname.replace(/\/$/, '');
        if (!['http:', 'https:'].includes(url.protocol) || url.origin !== current.origin) return false;
        if (root && url.pathname !== root && !url.pathname.startsWith(`${root}/`)) return false;
        // Extensionless Hugo routes and explicit HTML files are pages.
        return !/\.[^/]+$/.test(url.pathname) || /\.html?$/i.test(url.pathname);
    } catch {
        return false;
    }
}

export function initializeNavigation({ mount, unmount }) {
    if (document.body.dataset.clientRouting === 'false') return null;
    if (!containers.every((selector) => document.querySelector(selector))) return null;

    const siteRoot = document.body.dataset.siteRoot || '/';
    const swup = new Swup({
        containers,
        animationSelector: '#content',
        animateHistoryBrowsing: false,
        cache: document.body.dataset.routingCache !== 'false',
        timeout: 10_000,
        linkSelector: 'a[href]:not([download]):not([target]):not([rel~="external"]), a[href][target="_self"]:not([download]):not([rel~="external"])',
        ignoreVisit: (url, { el } = {}) => Boolean(el?.closest('[data-no-swup]'))
            || !isPageUrl(url, window.location.href, siteRoot),
        plugins: [
            new SwupHeadPlugin({ awaitAssets: true, persistTags: '[data-piatto-persist]' }),
            new SwupA11yPlugin({ announcements: { visit: '{title}', url: '{url}' } }),
        ],
    });

    swup.hooks.on('visit:start', (visit) => {
        // Keep the old page visible while the response is in flight.
        visit.animation.wait = true;
        document.getElementById('content')?.setAttribute('aria-busy', 'true');
    });
    swup.hooks.replace('fetch:request', async (visit, args, request) => {
        try {
            const response = await request(visit, args);
            const type = response.headers.get('content-type') || '';
            if (!response.ok || !/^(text\/html|application\/xhtml\+xml)\b/i.test(type)
                || !isPageUrl(response.url, window.location.href, siteRoot)) {
                throw new Error(`Unable to navigate to ${args.url}: ${response.status} ${type}`);
            }
            return response;
        } catch (error) {
            if (visit !== swup.visit) throw new DOMException('Visit superseded', 'AbortError');
            throw error;
        }
    });
    // Validate before any head/container hooks run. Resolve failed loads through
    // Swup's explicit ignore path: its internal page.then otherwise leaves an
    // unhandled rejection alongside the normal navigation failure handler.
    swup.hooks.replace('page:load', async (visit, args, load) => {
        try {
            const page = await load(visit, args);
            const next = new DOMParser().parseFromString(page.html, 'text/html');
            if (!containers.every((selector) => next.querySelector(selector))) {
                swup.cache.delete(page.url);
                throw new Error('The destination does not contain the Piatto page containers.');
            }
            return page;
        } catch {
            if (visit === swup.visit) {
                clearBusy();
                visit.ignore();
            }
            return { url: visit.to.url, html: ' ' };
        }
    });
    swup.hooks.before('content:replace', (visit) => {
        document.dispatchEvent(new CustomEvent('piatto:before-page-replace', {
            detail: { url: visit.to.url + visit.to.hash },
        }));
        unmount();
    }, { priority: -100 });
    // Mount before scrolling so math and content layout are ready for deep links.
    swup.hooks.on('content:replace', () => mount(), { priority: 100 });
    swup.hooks.on('page:view', (visit) => {
        document.dispatchEvent(new CustomEvent('piatto:page-load', {
            detail: { url: visit.to.url + visit.to.hash },
        }));
    });
    const clearBusy = () => document.getElementById('content')?.removeAttribute('aria-busy');
    swup.hooks.on('visit:end', clearBusy);
    swup.hooks.on('visit:abort', clearBusy);
    swup.hooks.before('visit:fail', clearBusy);
    return swup;
}
