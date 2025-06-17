document.addEventListener('DOMContentLoaded', function() {
    const highlights = document.querySelectorAll('.highlight');
    
    highlights.forEach(function(highlight) {
        const code = highlight.querySelector('code');
        if (code) {
            const button = document.createElement('button');
            button.className = 'copy-button';
            button.innerHTML = '<i class="ti ti-copy"></i> Copy';
            button.setAttribute('aria-label', 'Copy code to clipboard');
            
            button.addEventListener('click', function() {
                const text = code.textContent || code.innerText;
                
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text).then(function() {
                        showCopySuccess(button);
                    }).catch(function() {
                        fallbackCopy(text, button);
                    });
                } else {
                    fallbackCopy(text, button);
                }
            });
            
            highlight.appendChild(button);
        }
    });
    
    function showCopySuccess(button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="ti ti-check"></i> Copied!';
        button.classList.add('copied');
        
        setTimeout(function() {
            button.innerHTML = originalText;
            button.classList.remove('copied');
        }, 2000);
    }
    
    function fallbackCopy(text, button) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            showCopySuccess(button);
        } catch (err) {
            console.error('Failed to copy:', err);
            button.innerHTML = '<i class="ti ti-x"></i> Failed';
            setTimeout(function() {
                button.innerHTML = '<i class="ti ti-copy"></i> Copy';
            }, 2000);
        }
        
        document.body.removeChild(textArea);
    }
});