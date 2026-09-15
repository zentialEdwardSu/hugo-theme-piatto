const scripts = new Map();

function loadScript(src, integrity) {
    if (!scripts.has(src)) {
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.integrity = integrity;
            script.crossOrigin = 'anonymous';
            script.dataset.piattoPersist = '';
            const timer = window.setTimeout(() => finish(new Error(`Script timed out: ${src}`)), 10_000);
            const finish = (error) => {
                window.clearTimeout(timer);
                script.onload = script.onerror = null;
                if (error) {
                    script.remove();
                    reject(error);
                } else {
                    resolve();
                }
            };
            script.onload = () => finish();
            script.onerror = () => finish(new Error(`Unable to load ${src}`));
            document.head.appendChild(script);
        });
        scripts.set(src, promise);
        promise.catch(() => scripts.delete(src));
    }
    return scripts.get(src);
}

export async function initializeMath(scope) {
    const content = document.getElementById('content');
    if (content?.dataset.katex !== 'true') return;
    try {
        if (!window.katex) {
            await loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
                'sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8');
        }
        if (!scope.active) return;
        if (!window.renderMathInElement) {
            await loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
                'sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05');
        }
        if (!scope.active) return;
        window.renderMathInElement(content, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true },
            ],
            throwOnError: false,
        });
    } catch (error) {
        if (scope.active) console.error('Unable to render math:', error);
    }
}
