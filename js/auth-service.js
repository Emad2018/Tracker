import { CONFIG } from './config.js';

const poolData = { UserPoolId: CONFIG.cognito.userPoolId, ClientId: CONFIG.cognito.clientId };
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

export const AuthService = {
    login: (email, password) => {
        return new Promise((resolve, reject) => {
            const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({ Username: email, Password: password });
            const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });
            cognitoUser.authenticateUser(authDetails, {
                onSuccess: (result) => resolve({ status: 'SUCCESS', result }),
                onFailure: (err) => reject({ status: 'ERROR', error: err }),
                newPasswordRequired: (userAttrs) => resolve({ status: 'NEW_PASSWORD_REQUIRED', cognitoUser, userAttrs })
            });
        });
    },
    completeNewPassword: (cognitoUser, newPass) => {
        return new Promise((resolve, reject) => {
            cognitoUser.completeNewPasswordChallenge(newPass, {}, {
                onSuccess: (result) => resolve(result),
                onFailure: (err) => reject(err)
            });
        });
    },
    confirmSignUp: (username, code) => {
        const userData = { Username: username, Pool: userPool };
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
        return new Promise((resolve, reject) => {
            cognitoUser.confirmRegistration(code, true, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    },

    resendCode: (username) => {
        const userData = { Username: username, Pool: userPool };
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
        return new Promise((resolve, reject) => {
            cognitoUser.resendConfirmationCode((err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    },
    saveSession: (result) => {
        localStorage.setItem("idToken", result.getIdToken().getJwtToken());
        localStorage.setItem("accessToken", result.getAccessToken().getJwtToken());
    },
    logout: () => {
        const user = userPool.getCurrentUser();
        if (user) user.signOut();
        localStorage.clear();
        window.location.href = CONFIG.routes.login;
    }
};