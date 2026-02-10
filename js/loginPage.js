import { AuthService } from './auth-service.js';
import { UI } from './ui-utils.js';
import { CONFIG } from './config.js';

let tempSession = null; // Store the session string for force password change
let tempEmail = "";

document.addEventListener("DOMContentLoaded", () => {
  // UI Helpers
  UI.togglePassword("password", "togglePassword");
  UI.togglePassword("newPassword", "toggleNewPassword");
  UI.togglePassword("confirmPassword", "toggleConfirmPassword");
  UI.setupPasswordRules("newPassword", "passwordRules");

  // 1. LOGIN SUBMIT
  const loginForm = document.getElementById("loginForm");
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    UI.setLoading("signInBtn", true, "Sign in");
    UI.hide("authError");

    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value.trim();
    tempEmail = email;

    try {
      const res = await AuthService.login(email, pass);
      console.log("Login failed with response:", res)
      // Check Status based on Postman response structure
      if (res.status === 'SUCCESS') {
        AuthService.saveSession(res);
        window.location.href = CONFIG.routes.dashboard;
      }
      // Handle Force Password Change (First Time Login)
      else if (res.status === 'NEW_PASSWORD_REQUIRED' || res.challengeName === 'NEW_PASSWORD_REQUIRED') {
        // The backend should return a 'session' string needed for the next step
        tempSession = res.session;
        UI.hide("loginContainer");
        UI.show("forceChangePasswordContainer");
      }
      else {

        throw new Error(res.message || "Login failed");
      }

    } catch (err) {
      console.error(err);
      UI.showError("authError", err.message || "Invalid Credentials");
    } finally {
      UI.setLoading("signInBtn", false, "Sign in");
    }
  });

  // 2. VERIFY CODE SUBMIT (If you still have email verification flow, otherwise this might be deprecated)
  // Assuming standard login flow usually doesn't trigger this in your new backend unless specific status returned
  const verifyForm = document.getElementById("verifyForm");
  if (verifyForm) {
    verifyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      // ... Logic depends if backend supports "confirm_signup" action. 
      // Based on Postman, only "confirm_reset" is shown, so I'll leave this generic.
      alert("Please contact admin to verify account.");
    });
  }

  // 3. FORCE CHANGE PASSWORD SUBMIT
  const newPassForm = document.getElementById("newPasswordForm");
  if (newPassForm) {
    newPassForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nPass = document.getElementById("newPassword").value;
      const cPass = document.getElementById("confirmPassword").value;

      if (nPass !== cPass) {
        return UI.showError("passwordError", "Passwords do not match");
      }

      UI.setLoading("updatePassBtn", true, "Updating...");

      try {
        // Use the new API call with the session we saved earlier
        const res = await AuthService.completeNewPassword(tempEmail, nPass, tempSession);

        if (res.status === 'SUCCESS') {
          AuthService.saveSession(res);
          window.location.href = CONFIG.routes.dashboard;
        } else {
          throw new Error(res.message || "Failed to update password");
        }
      } catch (err) {
        UI.showError("passwordError", err.message || "Error updating password");
        UI.setLoading("updatePassBtn", false, "Update Password");
      }
    });
  }
});