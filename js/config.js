import { Amplify } from "https://esm.sh/aws-amplify@6";
export const CONFIG = {
    api: {
        // Base URL derived from your Postman environment
        authUrl: "https://moj6el904i.execute-api.us-east-1.amazonaws.com/prod/auth",
        tripUrl: "https://moj6el904i.execute-api.us-east-1.amazonaws.com/prod/trip",
        deviceUrl: "https://moj6el904i.execute-api.us-east-1.amazonaws.com/prod/device"
    },
    routes: {
        dashboard: "html/profile.html",
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
