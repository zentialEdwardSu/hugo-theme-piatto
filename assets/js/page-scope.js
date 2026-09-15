// Own everything that must stop when a page is replaced.
export function createPageScope() {
    const cleanups = [];
    const frames = new Set();
    const timers = new Set();
    let active = true;

    return {
        get active() { return active; },
        on(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            cleanups.push(() => target.removeEventListener(type, handler, options));
        },
        cleanup(callback) { cleanups.push(callback); },
        frame(callback) {
            if (!active) return 0;
            const id = window.requestAnimationFrame(() => {
                frames.delete(id);
                if (active) callback();
            });
            frames.add(id);
            return id;
        },
        timeout(callback, delay) {
            if (!active) return 0;
            const id = window.setTimeout(() => {
                timers.delete(id);
                if (active) callback();
            }, delay);
            timers.add(id);
            return id;
        },
        dispose() {
            if (!active) return;
            active = false;
            frames.forEach((id) => window.cancelAnimationFrame(id));
            timers.forEach((id) => window.clearTimeout(id));
            cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
        },
    };
}
