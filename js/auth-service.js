import { CONFIG } from './config.js';

const AmazonCognitoIdentity = window.AmazonCognitoIdentity;
const poolData = { UserPoolId: CONFIG.cognito.userPoolId, ClientId: CONFIG.cognito.clientId };
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

export const AuthService = {
    login: (email, password) => {
        return new Promise((resolve, reject) => {
            const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({ Username: email, Password: password });
            const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });

            cognitoUser.authenticateUser(authDetails, {
                onSuccess: (result) => resolve({ status: 'SUCCESS', result }),
                onFailure: (err) => reject({ status: 'ERROR', error: err }), // This 'err' contains the code
                newPasswordRequired: (userAttrs) => resolve({ status: 'NEW_PASSWORD_REQUIRED', cognitoUser, userAttrs })
            });
        });
    },

    confirmSignUp: (username, code) => {
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: username, Pool: userPool });
        return new Promise((resolve, reject) => {
            cognitoUser.confirmRegistration(code, true, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    },

    resendCode: (username) => {
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: username, Pool: userPool });
        return new Promise((resolve, reject) => {
            cognitoUser.resendConfirmationCode((err, result) => {
                if (err) reject(err);
                else resolve(result);
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

    saveSession: (result) => {
        localStorage.setItem("idToken", result.getIdToken().getJwtToken());
        localStorage.setItem("accessToken", result.getAccessToken().getJwtToken());
    },
    forgotPassword: (username) => {
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: username,
            Pool: userPool // userPool must be defined at the top of your file
        });
        return new Promise((resolve, reject) => {
            cognitoUser.forgotPassword({
                onSuccess: (data) => resolve(data),
                onFailure: (err) => reject(err)
            });
        });
    },

    confirmPassword: (username, code, newPassword) => {
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: username,
            Pool: userPool
        });
        return new Promise((resolve, reject) => {
            cognitoUser.confirmPassword(code, newPassword, {
                onSuccess: () => resolve(),
                onFailure: (err) => reject(err)
            });
        });
    }
};