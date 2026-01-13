
// =====================
// Cognito Configuration
// =====================
const poolData = {
  UserPoolId: "us-east-1_2xOi1OC6U", 
  ClientId: "ddv3pr427jrohlk3r2b5hievu"  
}

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData)

// =====================
// Form Handler
// =====================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm")

  if (!form) return

  form.addEventListener("submit", (e) => {
    e.preventDefault()

    const email = document.getElementById("email").value.trim()
    const password = document.getElementById("password").value.trim()


    loginUser(email, password)
  })
})


    function showAuthError(message) {
      const errorEl = document.getElementById("authError");
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
        setTimeout(() => {
          errorEl.classList.add("hidden");
          errorEl.textContent = ""; // optional: clear text
        }, 1500);
    }

// =====================
// Login Function
// =====================
function loginUser(email, password) {
  const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: email,
    Password: password,
  })

  const userData = {
    Username: email,
    Pool: userPool,
  }

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData)

  cognitoUser.authenticateUser(authDetails, {
    onSuccess: (result) => {
      const idToken = result.getIdToken().getJwtToken()
      const accessToken = result.getAccessToken().getJwtToken()
      const refreshToken = result.getRefreshToken().getToken()

      // Store tokens
      localStorage.setItem("idToken", idToken)
      localStorage.setItem("accessToken", accessToken)
      localStorage.setItem("refreshToken", refreshToken)

      // Redirect to live page
      window.location.href = "../html/live.html" 
    },

    onFailure: (err) => {
      let msg = "Something went wrong. Please try again.";

      if (err.code === "UserNotFoundException") {
        msg = "Account does not exist.";
      } else if (err.code === "NotAuthorizedException") {
        msg = "Incorrect email or password.";
      } else if (err.code === "UserNotConfirmedException") {
        msg = "Please confirm your email first.";
      }

      showAuthError(msg);
    },
  })
}


