const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const searchSummary = document.getElementById('hidegroup');
const noResults = document.getElementById('noResultsMessage');
const resultCount = document.getElementById('resultCount');

let searchIndex;
let searchIndexPromise;

function loadSearchIndex() {
    if (!searchIndexPromise) {
        searchIndexPromise = fetch('/index.json')
            .then((response) => {
                if (!response.ok) throw new Error(`Search index returned ${response.status}`);
                return response.json();
            })
            .then((data) => {
                searchIndex = new Fuse(data, {
                    shouldSort: true,
                    location: 0,
                    distance: 100,
                    threshold: 0.4,
                    minMatchCharLength: 2,
                    keys: ['title', 'permalink', 'description', 'content', 'section', 'categories', 'tags'],
                });
            })
            .catch((error) => {
                noResults.textContent = 'Search is temporarily unavailable.';
                noResults.classList.remove('hidden');
                console.error(error);
            });
    }
    return searchIndexPromise;
}

function clearResults() {
    searchResults.replaceChildren();
    searchSummary.classList.add('hidden');
    noResults.classList.add('hidden');
}

function resultLink(result) {
    const link = document.createElement('a');
    link.href = result.permalink;

    const title = document.createElement('span');
    title.className = 'cardtitle';
    title.textContent = result.title;

    const description = document.createElement('span');
    description.className = 'carddesc';
    description.textContent = result.description || '';

    link.append(title, description);
    return link;
}

async function executeSearch(term) {
    const query = term.trim();
    if (query.length < 2) {
        clearResults();
        return;
    }

    await loadSearchIndex();
    if (!searchIndex) return;

    const results = searchIndex.search(query).slice(0, 5);
    searchResults.replaceChildren();

    if (!results.length) {
        searchSummary.classList.add('hidden');
        noResults.classList.remove('hidden');
        return;
    }

    const fragment = document.createDocumentFragment();
    results.forEach(({ item }) => {
        const listItem = document.createElement('li');
        listItem.className = 'searchcard';
        listItem.append(resultLink(item));
        fragment.append(listItem);
    });
    searchResults.append(fragment);
    resultCount.textContent = String(results.length);
    searchSummary.classList.remove('hidden');
    noResults.classList.add('hidden');
}

if (searchInput && searchResults && searchSummary && noResults && resultCount) {
    searchInput.setAttribute('aria-controls', 'searchResults');
    searchInput.addEventListener('input', () => void executeSearch(searchInput.value));

    document.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === '/') {
            event.preventDefault();
            searchInput.focus();
            void loadSearchIndex();
            return;
        }

        if (event.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.value = '';
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
}
