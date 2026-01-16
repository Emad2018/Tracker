export const UI = {
    togglePassword: (inputId, buttonId) => {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(buttonId);
        if (!input || !btn) return;
        btn.addEventListener('click', () => {
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            btn.textContent = type === 'password' ? '👁' : '👁‍🗨';
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
    },

    setupPasswordRules: (inputId, containerId) => {
        const input = document.getElementById(inputId);
        const container = document.getElementById(containerId);
        if (!input || !container) return;

        const rules = {
            length: container.querySelector("#rule-length"),
            upper: container.querySelector("#rule-upper"),
            lower: container.querySelector("#rule-lower"),
            number: container.querySelector("#rule-number"),
            special: container.querySelector("#rule-special"),
        };

        const updateStatus = (el, valid) => {
            if (!el) return;
            if (valid) {
                el.classList.add("text-green-600", "font-medium");
                el.innerHTML = "✔️ " + el.innerText.replace("✔️ ", "").replace("• ", "");
            } else {
                el.classList.remove("text-green-600", "font-medium");
                el.innerHTML = "• " + el.innerText.replace("✔️ ", "").replace("• ", "");
            }
        };

        input.addEventListener("input", () => {
            const v = input.value;
            updateStatus(rules.length, v.length >= 8);
            updateStatus(rules.upper, /[A-Z]/.test(v));
            updateStatus(rules.lower, /[a-z]/.test(v));
            updateStatus(rules.number, /[0-9]/.test(v));
            updateStatus(rules.special, /[!@#$%^&*(),.?":{}|<>]/.test(v));
        });
    }
};