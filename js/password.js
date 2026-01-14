
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


// Toggle eye buttons
function setupPasswordToggle(passwordId, toggleId){
  const passwordInput = document.getElementById(passwordId);
  const toggleButton = document.getElementById(toggleId);
  if(!passwordInput || !toggleButton) return;
  toggleButton.addEventListener("click", ()=>{
    const type = passwordInput.type==="password"?"text":"password";
    passwordInput.type = type;
    toggleButton.textContent = type==="password"?"👁":"🙈";
  });
}
setupPasswordToggle("newPassword","toggleNewPassword");
setupPasswordToggle("confirmPassword","toggleConfirmPassword");

// Password rules live
const rules = {
  length: document.getElementById("rule-length"),
  upper: document.getElementById("rule-upper"),
  lower: document.getElementById("rule-lower"),
  number: document.getElementById("rule-number"),
  special: document.getElementById("rule-special"),
};
document.getElementById("newPassword").addEventListener("input", ()=>{
  const v = document.getElementById("newPassword").value;
  setRule(rules.length, v.length>=8);
  setRule(rules.upper, /[A-Z]/.test(v));
  setRule(rules.lower, /[a-z]/.test(v));
  setRule(rules.number, /[0-9]/.test(v));
  setRule(rules.special, /[!@#$%^&*(),.?":{}|<>]/.test(v));
});
function setRule(el,valid){
  if(valid){
    el.classList.remove("text-gray-600");
    el.classList.add("text-green-600","font-medium");
    el.innerHTML = "✔️ "+el.innerText.replace("✔️ ","").replace("• ","");
  }else{
    el.classList.remove("text-green-600","font-medium");
    el.classList.add("text-gray-600");
    el.innerHTML = "• "+el.innerText.replace("✔️ ","").replace("• ","");
  }
}
