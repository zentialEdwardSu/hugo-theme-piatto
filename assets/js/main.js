import { layout, prepare } from '@chenglou/pretext';
import { createPageScope } from './page-scope.js';
import { initializeMath } from './math.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const copyResetTimers = new WeakMap();
const searchIndexes = new Map();
const searchQueries = new Map();

const copyStates = {
    idle: { icon: 'content-copy', label: 'Copy code' },
    copied: { icon: 'check', label: 'Copied' },
    failed: { icon: 'close', label: 'Copy failed' },
};

function scrollBehavior() {
    return reducedMotion.matches ? 'auto' : 'smooth';
}

function setCopyButtonState(button, state, scope) {
    if (!scope.active) return;
    const { icon, label } = copyStates[state];
    const template = document.getElementById(`material-icon-${icon}`);
    const resetTimer = copyResetTimers.get(button);

    if (resetTimer) {
        window.clearTimeout(resetTimer);
        copyResetTimers.delete(button);
    }

    if (template instanceof HTMLTemplateElement) {
        button.replaceChildren(template.content.cloneNode(true));
    } else {
        button.textContent = label;
    }

    button.dataset.copyState = state;
    button.dataset.tooltip = label;
    button.setAttribute('aria-label', label);

    if (state !== 'idle') {
        const timer = scope.timeout(() => setCopyButtonState(button, 'idle', scope), 2000);
        copyResetTimers.set(button, timer);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    const activeElement = document.activeElement;

    textArea.value = text;
    textArea.readOnly = true;
    textArea.setAttribute('aria-hidden', 'true');
    textArea.style.position = 'fixed';
    textArea.style.inset = '0 auto auto -9999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        if (!document.execCommand('copy')) {
            throw new Error('The browser rejected the copy command.');
        }
    } finally {
        textArea.remove();
        if (activeElement instanceof HTMLElement) {
            activeElement.focus();
        }
    }
}

async function copyCode(text) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
            // The fallback also works in non-secure contexts and older browsers.
        }
    }

    fallbackCopy(text);
}

function initializeCodeCopy(scope) {
    document.querySelectorAll(':where(.post-content, .typst-content) > pre').forEach((pre) => {
        if (pre.parentElement?.classList.contains('highlight')) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'highlight highlight--plain';
        pre.before(wrapper);
        wrapper.appendChild(pre);
    });

    document.querySelectorAll('.highlight').forEach((highlight) => {
        const code = highlight.querySelector('code[data-lang]')
            ?? highlight.querySelector('.lntd:last-child code')
            ?? highlight.querySelector('code');

        if (!code || highlight.querySelector('.copy-button')) {
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'copy-button';
        setCopyButtonState(button, 'idle', scope);

        scope.on(button, 'click', async () => {
            try {
                await copyCode(code.textContent ?? '');
                setCopyButtonState(button, 'copied', scope);
            } catch (error) {
                console.error('Failed to copy code:', error);
                setCopyButtonState(button, 'failed', scope);
            }
        });

        highlight.appendChild(button);
        scope.cleanup(() => button.remove());
    });
}

function initializeMenu(scope) {
    const menuButton = document.querySelector('[data-collapse-toggle="navbar-default"]');
    const menu = document.getElementById('navbar-default');

    if (!menuButton || !menu) {
        return;
    }

    scope.on(menuButton, 'click', () => {
        const willOpen = !menu.classList.contains('is-open');
        menu.classList.toggle('is-open', willOpen);
        menuButton.setAttribute('aria-expanded', String(willOpen));
    });
}

function initializeThemeToggle(scope) {
    const themeToggle = document.getElementById('darkmode-toggle');

    if (!themeToggle) {
        return;
    }

    const syncToggle = () => {
        const isDark = document.documentElement.classList.contains('dark');
        themeToggle.checked = isDark;
        themeToggle.setAttribute('aria-label', isDark ? 'Use light mode' : 'Use dark mode');
    };

    syncToggle();
    scope.on(themeToggle, 'change', () => {
        const theme = themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
        syncToggle();
    });
}

function initializeBackToTop(scope) {
    const button = document.getElementById('back-to-top');

    if (!button) {
        return;
    }

    let updateQueued = false;
    const updateVisibility = () => {
        const isVisible = window.scrollY > window.innerHeight;
        button.classList.toggle('is-visible', isVisible);
        updateQueued = false;
    };

    scope.on(window, 'scroll', () => {
        if (!updateQueued) {
            scope.frame(updateVisibility);
            updateQueued = true;
        }
    }, { passive: true });

    scope.on(button, 'click', () => {
        window.scrollTo({ top: 0, behavior: scrollBehavior() });
    });

    updateVisibility();
}

function initializeTableOfContents(scope) {
    const links = Array.from(document.querySelectorAll(
        '.article-single__toc-content :where(#TableOfContents, .typst-toc) a[href^="#"]',
    ));
    const entries = links.map((link) => {
        const targetId = link.getAttribute('href');

        if (!targetId) {
            return null;
        }

        let decodedId;
        try {
            decodedId = decodeURIComponent(targetId.slice(1));
        } catch {
            return null;
        }

        const target = document.getElementById(decodedId);
        return target ? { link, target } : null;
    }).filter(Boolean);

    if (entries.length === 0) {
        return;
    }

    let activeLink = null;
    let updateFrame = 0;

    const setActiveLink = (nextLink) => {
        if (activeLink === nextLink) {
            return;
        }

        if (activeLink) {
            activeLink.classList.remove('is-active');
            activeLink.removeAttribute('aria-current');
        }

        activeLink = nextLink;
        if (activeLink) {
            activeLink.classList.add('is-active');
            activeLink.setAttribute('aria-current', 'location');
        }
    };

    const updateActiveLink = () => {
        updateFrame = 0;
        const activationLine = Math.min(112, window.innerHeight * 0.25);
        let currentEntry = null;

        entries.forEach((entry) => {
            if (entry.target.getBoundingClientRect().top <= activationLine) {
                currentEntry = entry;
            }
        });

        setActiveLink(currentEntry?.link ?? null);
    };

    const queueActiveLinkUpdate = () => {
        if (updateFrame === 0) {
            updateFrame = scope.frame(updateActiveLink);
        }
    };

    // Native anchors (or Swup) own history and scrolling. Only observe position here.
    scope.on(window, 'scroll', queueActiveLinkUpdate, { passive: true });
    scope.on(window, 'resize', queueActiveLinkUpdate, { passive: true });
    scope.on(window, 'hashchange', queueActiveLinkUpdate);
    scope.on(window, 'popstate', queueActiveLinkUpdate);
    updateActiveLink();
}

function initializeArticleTitleFitting(scope) {
    const boxes = Array.from(document.querySelectorAll('[data-fit-title]'));
    if (boxes.length === 0) {
        return;
    }

    const desktop = window.matchMedia('(min-width: 48rem)');
    const baseSize = 100;
    const lineHeightRatio = 0.96;
    let frame = 0;
    let preparedTitles = [];

    const prepareTitles = () => {
        preparedTitles = boxes.map((box) => {
            const title = box.querySelector('[data-fit-title-text]');
            if (!title) {
                return null;
            }

            const style = window.getComputedStyle(title);
            const currentSize = Number.parseFloat(style.fontSize) || baseSize;
            const currentSpacing = Number.parseFloat(style.letterSpacing) || 0;
            const font = `${style.fontStyle} ${style.fontWeight} ${baseSize}px ${style.fontFamily}`;
            const prepared = prepare(title.textContent.trim(), font, {
                letterSpacing: currentSpacing * (baseSize / currentSize),
            });

            return { box, prepared, title };
        }).filter(Boolean);
    };

    const fitAll = () => {
        frame = 0;
        preparedTitles.forEach(({ box, prepared, title }) => {
            if (!desktop.matches) {
                title.style.removeProperty('--article-title-size');
                return;
            }

            const width = box.clientWidth;
            const height = Math.max(0, box.clientHeight - 4);
            if (width <= 0 || height <= 0) {
                return;
            }

            let low = Number.parseFloat(box.dataset.fitTitleMin) || 40;
            let high = Number.parseFloat(box.dataset.fitTitleMax) || 108;

            for (let index = 0; index < 12; index += 1) {
                const candidate = (low + high) / 2;
                const scaledWidth = width * (baseSize / candidate);
                const measured = layout(prepared, scaledWidth, baseSize * lineHeightRatio);
                const renderedHeight = measured.height * (candidate / baseSize);

                if (renderedHeight <= height) {
                    low = candidate;
                } else {
                    high = candidate;
                }
            }

            title.style.setProperty('--article-title-size', `${low.toFixed(2)}px`);

            // Pretext provides the fast primary fit. A loaded browser font can still
            // differ slightly in glyph overhang and word-boundary behavior, so only
            // titles that exceed the real box receive a small DOM-backed correction.
            if (title.scrollHeight > height) {
                let correctedLow = 20;
                let correctedHigh = low;

                for (let index = 0; index < 8; index += 1) {
                    const candidate = (correctedLow + correctedHigh) / 2;
                    title.style.setProperty('--article-title-size', `${candidate.toFixed(2)}px`);

                    if (title.scrollHeight <= height) {
                        correctedLow = candidate;
                    } else {
                        correctedHigh = candidate;
                    }
                }

                title.style.setProperty('--article-title-size', `${correctedLow.toFixed(2)}px`);
            }
        });
    };

    const queueFit = () => {
        if (frame !== 0) {
            return;
        }
        frame = scope.frame(fitAll);
    };

    const observer = new ResizeObserver(queueFit);
    boxes.forEach((box) => observer.observe(box));
    scope.cleanup(() => observer.disconnect());
    scope.on(desktop, 'change', queueFit);
    document.fonts.ready.then(() => {
        if (!scope.active) return;
        prepareTitles();
        queueFit();
    });
}

export function uniqueSearchResults(results, limit) {
    const seenPermalinks = new Set();
    const uniqueResults = [];

    for (const result of results) {
        const permalink = result.item.permalink;
        if (seenPermalinks.has(permalink)) continue;

        seenPermalinks.add(permalink);
        uniqueResults.push(result);
        if (uniqueResults.length === limit) break;
    }

    return uniqueResults;
}

function initializeSearch(scope) {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const searchSummary = document.getElementById('hidegroup');
    const noResults = document.getElementById('noResultsMessage');
    const resultCount = document.getElementById('resultCount');

    if (!searchInput || !searchResults || !searchSummary || !noResults || !resultCount) {
        return;
    }

    const indexURL = searchInput.dataset.searchIndex;
    if (!indexURL) return;
    let queryVersion = 0;
    const loadSearchIndex = () => {
        if (!searchIndexes.has(indexURL)) {
            const pending = fetch(indexURL)
                .then((response) => {
                    if (!response.ok) throw new Error(`Search index returned ${response.status}`);
                    return response.json();
                })
                .then((data) => new window.Fuse(data, {
                    shouldSort: true,
                    location: 0,
                    distance: 100,
                    threshold: 0.4,
                    minMatchCharLength: 2,
                    keys: ['title', 'permalink', 'description', 'content', 'section', 'categories', 'tags'],
                }));
            searchIndexes.set(indexURL, pending);
            pending.catch(() => searchIndexes.delete(indexURL));
        }
        return searchIndexes.get(indexURL);
    };

    const clearResults = () => {
        searchResults.replaceChildren();
        searchSummary.classList.add('hidden');
        noResults.classList.add('hidden');
    };

    const resultLink = (result) => {
        const link = document.createElement('a');
        link.href = result.permalink;

        const title = document.createElement('span');
        title.className = 'search-result__title';
        title.textContent = result.title;

        const description = document.createElement('span');
        description.className = 'search-result__description';
        description.textContent = result.description || '';

        link.append(title, description);
        return link;
    };

    const executeSearch = async (term) => {
        searchQueries.set(indexURL, term);
        const version = ++queryVersion;
        const query = term.trim();
        if (query.length < 2) {
            clearResults();
            return;
        }

        let searchIndex;
        try {
            searchIndex = await loadSearchIndex();
        } catch (error) {
            if (!scope.active || version !== queryVersion) return;
            clearResults();
            noResults.textContent = 'Search is temporarily unavailable.';
            noResults.classList.remove('hidden');
            console.error(error);
            return;
        }
        if (!scope.active || version !== queryVersion) return;
        noResults.textContent = 'No matching posts found.';
        noResults.classList.add('hidden');

        const results = uniqueSearchResults(searchIndex.search(query), 5);
        searchResults.replaceChildren();

        if (!results.length) {
            searchSummary.classList.add('hidden');
            noResults.classList.remove('hidden');
            return;
        }

        const fragment = document.createDocumentFragment();
        results.forEach(({ item }) => {
            const listItem = document.createElement('li');
            listItem.className = 'search-result';
            listItem.append(resultLink(item));
            fragment.append(listItem);
        });
        searchResults.append(fragment);
        resultCount.textContent = String(results.length);
        searchSummary.classList.remove('hidden');
        noResults.classList.add('hidden');
    };

    searchInput.setAttribute('aria-controls', 'searchResults');
    scope.on(searchInput, 'input', () => void executeSearch(searchInput.value));

    scope.on(document, 'keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === '/') {
            event.preventDefault();
            searchInput.focus();
            void loadSearchIndex().catch(() => {});
            return;
        }

        if (event.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.value = '';
            searchQueries.delete(indexURL);
            queryVersion++;
            clearResults();
            searchInput.blur();
            return;
        }

        const links = [...searchResults.querySelectorAll('a')];
        if (!links.length) return;

        if (event.key === 'ArrowDown' && document.activeElement === searchInput) {
            event.preventDefault();
            links[0].focus();
        } else if (event.key === 'ArrowUp' && links.includes(document.activeElement)) {
            event.preventDefault();
            const index = links.indexOf(document.activeElement);
            (index === 0 ? searchInput : links[index - 1]).focus();
        } else if (event.key === 'ArrowDown' && links.includes(document.activeElement)) {
            event.preventDefault();
            const index = links.indexOf(document.activeElement);
            links[Math.min(index + 1, links.length - 1)].focus();
        }
    });

    searchInput.value = searchQueries.get(indexURL) || '';
    if (searchInput.value) return executeSearch(searchInput.value);
}

let pageScope;

export function unmountPage() {
    pageScope?.dispose();
    pageScope = undefined;
}

export async function mountPage() {
    unmountPage();
    const scope = createPageScope();
    pageScope = scope;
    initializeMenu(scope);
    initializeThemeToggle(scope);
    initializeBackToTop(scope);
    initializeTableOfContents(scope);
    initializeArticleTitleFitting(scope);
    initializeCodeCopy(scope);
    await Promise.all([initializeSearch(scope), initializeMath(scope)]);
    return scope.active;
}
