import { Bundle, ZObject } from 'zapier-platform-core';

// Test function to verify OAuth connection
const testAuth = async (z: ZObject, bundle: Bundle) => {
  // Test the connection by calling your server's OAuth test endpoint
  const response = await z.request({
    url: `${process.env.FOLLOWTHROUGH_API_URL}/oauth/google/test`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bundle.authData.access_token}`,
    },
  });

  if (response.status !== 200) {
    throw new Error('Authentication failed');
  }

  const data = response.data;
  return {
    id: data.testResult?.email || 'unknown',
    email: data.testResult?.email,
    name: data.testResult?.name,
  };
};

// OAuth 2.0 configuration that integrates with your existing Google OAuth
export const authentication = {
  type: 'oauth2' as const,
  oauth2Config: {
    // Authorization URL - your server handles the OAuth flow
    authorizeUrl: {
      url: `${process.env.FOLLOWTHROUGH_API_URL}/oauth/google/authorize`,
      params: {
        client_id: '{{process.env.GOOGLE_CLIENT_ID}}',
        state: '{{bundle.inputData.state}}',
        redirect_uri: '{{bundle.inputData.redirect_uri}}',
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        scope: [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events',
        ].join(' '),
      },
    },

    // Token exchange - your server handles token exchange
    getAccessToken: {
      url: `${process.env.FOLLOWTHROUGH_API_URL}/oauth/google/token`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: {
        grant_type: 'authorization_code',
        client_id: '{{process.env.GOOGLE_CLIENT_ID}}',
        client_secret: '{{process.env.GOOGLE_CLIENT_SECRET}}',
        code: '{{bundle.inputData.code}}',
        redirect_uri: '{{bundle.inputData.redirect_uri}}',
      },
    },

    // Token refresh - your server handles token refresh
    refreshAccessToken: {
      url: `${process.env.FOLLOWTHROUGH_API_URL}/oauth/google/refresh`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: {
        grant_type: 'refresh_token',
        refresh_token: '{{bundle.authData.refresh_token}}',
        client_id: '{{process.env.GOOGLE_CLIENT_ID}}',
        client_secret: '{{process.env.GOOGLE_CLIENT_SECRET}}',
      },
    },

    // Scopes required for the integration
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' '),

    // Automatically refresh tokens when they expire
    autoRefresh: true,
  },

  // Test the authentication
  test: testAuth,

  // Connection label shown to users
  connectionLabel: '{{userInfo.email}}',

  // Fields to collect during authentication (if any)
  fields: [
    {
      key: 'api_key',
      label: 'FollowThrough AI API Key',
      required: true,
      helpText: 'Get your API key from FollowThrough AI dashboard > Settings > Integrations > Zapier',
      type: 'password' as const,
    },
  ],
}; 