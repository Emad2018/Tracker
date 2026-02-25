import { Amplify } from "https://cdn.skypack.dev/aws-amplify";
export const CONFIG = {
    api: {
        // Base URL derived from your Postman environment
        authUrl: "https://cfwhkbacci.execute-api.us-east-1.amazonaws.com/prod/auth",
        tripUrl: "https://cfwhkbacci.execute-api.us-east-1.amazonaws.com/prod/trip",
        deviceUrl: "https://cfwhkbacci.execute-api.us-east-1.amazonaws.com/prod/device",
        lockUrl: "https://cfwhkbacci.execute-api.us-east-1.amazonaws.com/prod/lock"
    },
    routes: {
        dashboard: "profile.html",
        login: "loginPage.html"
    }
};

export const Amplifyconfig = Amplify.configure({

    API: {
        GraphQL: {
            endpoint: 'https://m677wqaywfat7ejuca7wmgwfeq.appsync-api.us-east-1.amazonaws.com/graphql',
            region: 'us-east-1',
            defaultAuthMode: 'apiKey',
            apiKey: 'da2-prfdxjwshfbero4l7wdwjvfxdi'
        }
    }
});
