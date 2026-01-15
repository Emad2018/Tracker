import { AuthService } from './js/auth-service.js';
import { UI } from './js/ui-utils.js';

let userEmail = "";

document.getElementById("requestResetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    userEmail = document.getElementById("resetEmail").value;
    try {
        await AuthService.forgotPassword(userEmail);
        document.getElementById("step1").classList.add("hidden");
        document.getElementById("step2").classList.remove("hidden");
    } catch (err) {
        alert(err.message);
    }
});

document.getElementById("confirmResetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = document.getElementById("code").value;
    const newPass = document.getElementById("confirmNewPassword").value;
    try {
        await AuthService.confirmPassword(userEmail, code, newPass);
        alert("Password reset successful!");
        window.location.href = "loginPage.html";
    } catch (err) {
        alert(err.message);
    }
});