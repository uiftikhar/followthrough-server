import { Bundle, ZObject } from 'zapier-platform-core';
export declare const authentication: {
    type: "oauth2";
    oauth2Config: {
        authorizeUrl: {
            url: string;
            params: {
                client_id: string;
                state: string;
                redirect_uri: string;
                response_type: string;
                access_type: string;
                prompt: string;
                scope: string;
            };
        };
        getAccessToken: {
            url: string;
            method: string;
            headers: {
                'Content-Type': string;
                Accept: string;
            };
            body: {
                grant_type: string;
                client_id: string;
                client_secret: string;
                code: string;
                redirect_uri: string;
            };
        };
        refreshAccessToken: {
            url: string;
            method: string;
            headers: {
                'Content-Type': string;
                Accept: string;
            };
            body: {
                grant_type: string;
                refresh_token: string;
                client_id: string;
                client_secret: string;
            };
        };
        scope: string;
        autoRefresh: boolean;
    };
    test: (z: ZObject, bundle: Bundle) => Promise<{
        id: any;
        email: any;
        name: any;
    }>;
    connectionLabel: string;
    fields: {
        key: string;
        label: string;
        required: boolean;
        helpText: string;
        type: "password";
    }[];
};
//# sourceMappingURL=index.d.ts.map