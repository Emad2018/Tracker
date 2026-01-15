import { AuthService } from './auth-service.js';
import { UI } from './ui-utils.js';
import { CONFIG } from './config.js';

let tempCognitoUser = null;

document.addEventListener("DOMContentLoaded", () => {
  UI.togglePassword("password", "togglePassword");

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    UI.setLoading("signInBtn", true, "Sign in");
    UI.hide("authError");

    try {
      const email = document.getElementById("email").value;
      const pass = document.getElementById("password").value;
      const res = await AuthService.login(email, pass);

      if (res.status === 'SUCCESS') {
        AuthService.saveSession(res.result);
        window.location.href = CONFIG.routes.dashboard;
      } else if (res.status === 'NEW_PASSWORD_REQUIRED') {
        tempCognitoUser = res.cognitoUser;
        UI.hide("loginContainer");
        UI.show("forceChangePasswordContainer");
      }
    } catch (err) {
      UI.showError("authError", err.error?.message || "Invalid Credentials");
    } finally {
      UI.setLoading("signInBtn", false, "Sign in");
    }
  });

  document.getElementById("newPasswordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nPass = document.getElementById("newPassword").value;
    const cPass = document.getElementById("confirmPassword").value;

    if (nPass !== cPass) return UI.showError("passwordError", "Passwords do not match");

    try {
      const res = await AuthService.completeNewPassword(tempCognitoUser, nPass);
      AuthService.saveSession(res);
      window.location.href = CONFIG.routes.dashboard;
    } catch (err) {
      UI.showError("passwordError", err.message);
    }
  });
});