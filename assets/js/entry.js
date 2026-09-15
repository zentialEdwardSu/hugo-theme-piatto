import { mountPage, unmountPage } from './main.js';
import { initializeNavigation } from './navigation.js';

// Defer scripts run after the document is parsed. Install routing synchronously
// so slow optional math assets cannot delay interception of the first link.
initializeNavigation({ mount: mountPage, unmount: unmountPage });
void mountPage().then((active) => {
    if (active) {
        document.dispatchEvent(new CustomEvent('piatto:page-load', {
            detail: { url: window.location.pathname + window.location.search + window.location.hash },
        }));
    }
});
