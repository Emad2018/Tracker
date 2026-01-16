import { AuthService } from './auth-service.js';
import { UI } from './ui-utils.js';

let userEmail = "";

document.addEventListener("DOMContentLoaded", () => {
    UI.togglePassword("newPassword", "toggleNewPassword");
    UI.togglePassword("confirmPassword", "toggleConfirmPassword");
    UI.setupPasswordRules("newPassword", "passwordRules");

    // STEP 1: Request Reset Code
    document.getElementById("emailForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        userEmail = document.getElementById("email").value.trim();
        UI.setLoading("emailSubmitBtn", true, "Send Reset Code");
        UI.hide("step1Error");

        try {
            await AuthService.forgotPassword(userEmail);
            UI.hide("step1");
            UI.show("step2");
        } catch (err) {
            UI.showError("step1Error", err.message || "Email not found.");
        } finally {
            UI.setLoading("emailSubmitBtn", false, "Send Reset Code");
        }
    });

    // STEP 2: Final Reset
    document.getElementById("resetForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = document.getElementById("verificationCode").value.trim();
        const newPass = document.getElementById("newPassword").value;
        const confirmPass = document.getElementById("confirmPassword").value;

        if (newPass !== confirmPass) {
            return UI.showError("step2Error", "Passwords do not match.");
        }

        UI.setLoading("resetBtn", true, "Updating...");
        UI.hide("step2Error");

        try {
            await AuthService.confirmPassword(userEmail, code, newPass);

            // 1. Hide the button and error message
            UI.hide("resetBtn");
            UI.hide("step2Error");

            // 2. Show Success Message
            UI.show("successMessage");

            // 3. Start 10-second countdown
            startRedirectTimer(10);

        } catch (err) {
            UI.showError("step2Error", err.message || "Invalid code or password requirements.");
            UI.setLoading("resetBtn", false, "Update Password");
        }
    });
});

/**
 * Handles the redirect countdown logic
 */
function startRedirectTimer(seconds) {
    const countdownEl = document.getElementById("countdown");
    let timeLeft = seconds;

    const interval = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(interval);
            window.location.href = "loginPage.html";
        }
    }, 1000);
}