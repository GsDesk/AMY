import { PublicClientApplication } from '@azure/msal-browser';

export const DEFAULT_GOOGLE_CLIENT_ID = '622335356967-1ff87v5nvi4mh4egfpt12ngnochn32t5.apps.googleusercontent.com';
let msalPromise = null;

export async function getMsal(azureClientId, azureTenantId) {
    if (!msalPromise) {
        const msalInstance = new PublicClientApplication({
            auth: {
                clientId: azureClientId || 'b70d884c-ba19-48f3-ac91-a1e24f14e544',
                authority: `https://login.microsoftonline.com/${azureTenantId || '0a42bec9-732b-45d1-977d-3b8d3ac98c2b'}`,
                redirectUri: window.location.origin
            },
            cache: {
                cacheLocation: 'sessionStorage'
            }
        });
        msalPromise = msalInstance.initialize().then(() => msalInstance).catch((error) => {
            msalPromise = null;
            throw error;
        });
    }
    return msalPromise;
}

