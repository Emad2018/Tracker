// 1. Set this to true for Dev, false for Prod
const IS_DEV = false; // Change to true for development environment

const BASE_URL = IS_DEV
    ? "https://zmv50h6cx8.execute-api.us-east-1.amazonaws.com/dev"
    : "https://cfwhkbacci.execute-api.us-east-1.amazonaws.com/prod";

export const CONFIG = {
    api: {
        // Now these update automatically based on BASE_URL
        authUrl: `${BASE_URL}/auth`,
        tripUrl: `${BASE_URL}/trip`,
        deviceUrl: `${BASE_URL}/device`,
        lockUrl: `${BASE_URL}/lock`,
        fleetUrl: `${BASE_URL}/fleet`
    },
    routes: {
        dashboard: "profile.html",
        login: "loginPage.html"
    },
    amplifyConfig: {
        API: {
            GraphQL: {
                // If you have a Dev AppSync, you can apply the same logic here
                endpoint: 'https://m677wqaywfat7ejuca7wmgwfeq.appsync-api.us-east-1.amazonaws.com/graphql',
                region: 'us-east-1',
                defaultAuthMode: 'apiKey',
                apiKey: 'da2-prfdxjwshfbero4l7wdwjvfxdi'
            }
        }
    }
};