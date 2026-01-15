export const UI = {
    togglePassword: (inputId, buttonId) => {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(buttonId);
        if (!input || !btn) return;
        btn.addEventListener('click', () => {
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            btn.textContent = type === 'password' ? '👁' : '🙈';
        });
    },
    showError: (elementId, message) => {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = message;
            el.classList.remove('hidden');
        }
    },
    hide: (id) => document.getElementById(id)?.classList.add('hidden'),
    show: (id) => document.getElementById(id)?.classList.remove('hidden'),
    setLoading: (buttonId, isLoading, defaultText) => {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.disabled = isLoading;
        btn.textContent = isLoading ? "Processing..." : defaultText;
        btn.classList.toggle("opacity-50", isLoading);
    }
};