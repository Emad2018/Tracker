import { AuthService } from './auth-service.js';
import { UI } from './ui-utils.js';
import { CONFIG } from './config.js';

let tempCognitoUser = null;
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
    tempEmail = email; // Save for the verification step

    try {
      const res = await AuthService.login(email, pass);

      // If we reach here, the user is confirmed and the password is correct
      if (res.status === 'SUCCESS') {
        AuthService.saveSession(res.result);
        window.location.href = CONFIG.routes.dashboard;
      } else if (res.status === 'NEW_PASSWORD_REQUIRED') {
        tempCognitoUser = res.cognitoUser;
        UI.hide("loginContainer");
        UI.show("forceChangePasswordContainer");
      }
    } catch (err) {
      // THE CRITICAL FIX: Extract the actual error code
      const error = err.error || err;

      if (error.code === "UserNotConfirmedException") {
        console.log("User needs verification first.");
        UI.hide("loginContainer");
        UI.show("verificationContainer");
      } else {
        UI.showError("authError", error.message || "Invalid Credentials");
      }
    } finally {
      UI.setLoading("signInBtn", false, "Sign in");
    }
  });

  // 2. VERIFICATION SUBMIT
  document.getElementById("verifyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    UI.setLoading("verifyBtn", true, "Verifying...");
    const code = document.getElementById("verifyCode").value.trim();

    try {
      await AuthService.confirmSignUp(tempEmail, code);
      alert("Verification successful! Now please sign in with your password.");
      window.location.reload(); // Reload to let them login normally
    } catch (err) {
      UI.showError("verifyError", err.message || "Verification failed.");
    } finally {
      UI.setLoading("verifyBtn", false, "Verify & Sign In");
    }
  });

  // 3. RESEND CODE
  document.getElementById("resendBtn").addEventListener("click", async () => {
    try {
      await AuthService.resendCode(tempEmail);
      alert("A new code has been sent to " + tempEmail);
    } catch (err) {
      alert(err.message);
    }
  });

  // 4. FORCE CHANGE PASSWORD SUBMIT
  document.getElementById("newPasswordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nPass = document.getElementById("newPassword").value;
    const cPass = document.getElementById("confirmPassword").value;

    if (nPass !== cPass) {
      return UI.showError("passwordError", "Passwords do not match");
    }

    UI.setLoading("updatePassBtn", true, "Updating...");
    try {
      const res = await AuthService.completeNewPassword(tempCognitoUser, nPass);
      AuthService.saveSession(res);
      window.location.href = CONFIG.routes.dashboard;
    } catch (err) {
      UI.showError("passwordError", err.message || "Could not update password.");
    } finally {
      UI.setLoading("updatePassBtn", false, "Update Password");
    }
  });
});