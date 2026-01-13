
// Configure your user pool here
const poolData = {
  UserPoolId: "us-east-1_2xOi1OC6U", 
  ClientId: "ddv3pr427jrohlk3r2b5hievu"  
}

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
let emailGlobal = "";
let cognitoUser = null;

// ---------------- Step 1: Enter Email ----------------
document.getElementById("emailForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("email")?.value.trim();
  if (!email) return showMessage("Please enter your email.", "step1Error");

  emailGlobal = email;

  cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: emailGlobal,
    Pool: userPool,
  });

  // Trigger forgotPassword
  cognitoUser.forgotPassword({
    onSuccess: () => {
      showMessage("Verification code sent. Check your email.", "step1Success");
      document.getElementById("step1").style.display = "none";
      document.getElementById("step2").style.display = "block";
    },
    onFailure: (err) => {
      if (err.code === "UserNotFoundException") {
        showMessage("This email is not registered. Please sign up first.", "step1Error");
      } else {
        showMessage(err.message || "Failed to send reset code.", "step1Error");
      }
    },
  });
});

// ---------------- Step 2: Enter Verification Code ----------------
document.getElementById("verifyCodeForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = document.getElementById("verificationCode")?.value.trim();
  if (!code) return showMessage("Please enter the verification code.", "step2Error");

  // Store code for Step 3
  cognitoUser.verificationCode = code;

  document.getElementById("step2").style.display = "none";
  document.getElementById("step3").style.display = "block";
});

// ---------------- Step 3: Enter New Password ----------------
document.getElementById("resetForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const newPassword = document.getElementById("newPassword")?.value.trim();
  const confirmPassword = document.getElementById("confirmPassword")?.value.trim();

  if (!newPassword || !confirmPassword) return showMessage("Enter and confirm your new password.", "step3Error");
  if (newPassword !== confirmPassword) return showMessage("Passwords do not match.", "step3Error");
  if (newPassword.length < 8) return showMessage("Password must be at least 8 characters.", "step3Error");

  // Complete forgot password
  cognitoUser.confirmPassword(
    cognitoUser.verificationCode,
    newPassword,
    {
      onSuccess: () => {
        showMessage("Password reset successfully! Redirecting to login...", "step3Success");
        setTimeout(() => window.location.href = "../html/loginPage.html", 1500);
      },
      onFailure: (err) => {
        showMessage(err.message || "Failed to reset password.", "step3Error");
      }
    }
  );
});

// ---------------- Helper: Show message ----------------
function showMessage(msg, id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => {
    el.classList.add("hidden");
    el.textContent = "";
  }, 2000);
}
