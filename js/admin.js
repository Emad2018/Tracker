const poolData = {
  UserPoolId: "us-east-1_2xOi1OC6U", 
  ClientId: "ddv3pr427jrohlk3r2b5hievu"  
}
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
let emailGlobal = "";
let cognitoUser = null;

// Step 1: Email submit
document.getElementById("emailForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  if(!email) return showMessage("Enter your email","step1Error");
  emailGlobal = email;
  document.getElementById("step1").style.display="none";
  document.getElementById("step2").style.display="block";
});

// Step 2: Temporary password (or skip if not required)
document.getElementById("tempPassForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const tempPassword = document.getElementById("code").value.trim();
  if(!tempPassword) return showMessage("Enter temporary password","step2Error");

  const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: emailGlobal,
    Password: tempPassword
  });
  const userData = {Username: emailGlobal, Pool: userPool};
  cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

  cognitoUser.authenticateUser(authDetails, {
    onSuccess: () => {
      // User is fully confirmed → skip step2, redirect to loginPage
      window.location.href = "/loginPage.html";
    },
    onFailure: (err) => showMessage(err.message, "step2Error"),
    newPasswordRequired: () => {
      // User must change password → show Step3
      document.getElementById("step2").style.display = "none";
      document.getElementById("step3").style.display = "block";
    }
  });
});

// Step 3: Reset password
document.getElementById("resetForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const newPassword = document.getElementById("newPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();
  if(newPassword!==confirmPassword) return showMessage("Passwords do not match","step3Error");
  if(newPassword.length<8) return showMessage("Password must be at least 8 characters","step3Error");

  cognitoUser.completeNewPasswordChallenge(newPassword,{},{
    onSuccess:()=> window.location.href="/loginPage.html",
    onFailure:(err)=>showMessage(err.message,"step3Error")
  });
});

// Show message
function showMessage(msg,id){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(()=>{el.classList.add("hidden"); el.textContent="";},2000);
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