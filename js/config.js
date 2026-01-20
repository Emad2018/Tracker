import { Amplify } from "https://esm.sh/aws-amplify@6";
export const CONFIG = {
    cognito: {
        userPoolId: "us-east-1_2xOi1OC6U",
        clientId: "ddv3pr427jrohlk3r2b5hievu"
    },
    routes: {
        dashboard: "live.html",
        login: "loginPage.html"
    }
};

export const Amplifyconfig = Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: CONFIG.cognito.userPoolId,
            userPoolClientId: CONFIG.cognito.clientId,
            region: 'us-east-1'
        }
    },
    API: {
        GraphQL: {
            endpoint: 'https://m677wqaywfat7ejuca7wmgwfeq.appsync-api.us-east-1.amazonaws.com/graphql',
            region: 'us-east-1',
            defaultAuthMode: 'userPool'
        }
    }
});
