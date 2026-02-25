export const CONFIG = {
    api: {
        // Base URL derived from your Postman environment
        authUrl: "https://cfwhkbacci.execute-api.us-east-1.amazonaws.com/prod/auth",
        tripUrl: "https://cfwhkbacci.execute-api.us-east-1.amazonaws.com/prod/trip",
        deviceUrl: "https://cfwhkbacci.execute-api.us-east-1.amazonaws.com/prod/device",
        lockUrl: "https://cfwhkbacci.execute-api.us-east-1.amazonaws.com/prod/lock",
        fleetUrl: "https://cfwhkbacci.execute-api.us-east-1.amazonaws.com/prod/fleet"
    },
    routes: {
        dashboard: "profile.html",
        login: "loginPage.html"
    },
    amplifyConfig: {
        API: {
            GraphQL: {
                endpoint: 'https://m677wqaywfat7ejuca7wmgwfeq.appsync-api.us-east-1.amazonaws.com/graphql',
                region: 'us-east-1',
                defaultAuthMode: 'apiKey',
                apiKey: 'da2-prfdxjwshfbero4l7wdwjvfxdi'
            }
        }
    }
};
