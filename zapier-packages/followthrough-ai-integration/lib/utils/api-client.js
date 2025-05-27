"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
class ApiClient {
    constructor(z, bundle) {
        this.z = z;
        this.bundle = bundle;
        this.baseUrl = process.env.FOLLOWTHROUGH_API_URL || 'https://your-domain.com';
    }
    /**
     * Make a POST request to the API
     */
    async post(endpoint, data) {
        try {
            return await this.z.request({
                url: `${this.baseUrl}${endpoint}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.bundle.authData.access_token}`,
                    'x-api-key': this.bundle.authData.api_key,
                },
                body: data,
            });
        }
        catch (error) {
            this.z.console.error(`POST ${endpoint} failed:`, error);
            throw new Error(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Make a GET request to the API
     */
    async get(endpoint, params) {
        try {
            const url = new URL(`${this.baseUrl}${endpoint}`);
            if (params) {
                Object.keys(params).forEach(key => {
                    if (params[key] !== undefined && params[key] !== null) {
                        url.searchParams.append(key, params[key]);
                    }
                });
            }
            return await this.z.request({
                url: url.toString(),
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.bundle.authData.access_token}`,
                    'x-api-key': this.bundle.authData.api_key,
                },
            });
        }
        catch (error) {
            this.z.console.error(`GET ${endpoint} failed:`, error);
            throw new Error(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Make a PUT request to the API
     */
    async put(endpoint, data) {
        try {
            return await this.z.request({
                url: `${this.baseUrl}${endpoint}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.bundle.authData.access_token}`,
                    'x-api-key': this.bundle.authData.api_key,
                },
                body: data,
            });
        }
        catch (error) {
            this.z.console.error(`PUT ${endpoint} failed:`, error);
            throw new Error(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Make a DELETE request to the API
     */
    async delete(endpoint) {
        try {
            return await this.z.request({
                url: `${this.baseUrl}${endpoint}`,
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.bundle.authData.access_token}`,
                    'x-api-key': this.bundle.authData.api_key,
                },
            });
        }
        catch (error) {
            this.z.console.error(`DELETE ${endpoint} failed:`, error);
            throw new Error(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Make a request to the Zapier webhook endpoint for email triage
     */
    async triggerEmailTriage(emailData) {
        return this.post('/api/zapier/webhooks/email', {
            ...emailData,
            userId: emailData.userId || this.bundle.authData.userId,
        });
    }
    /**
     * Make a request to trigger meeting analysis
     */
    async triggerMeetingAnalysis(meetingData) {
        return this.post('/api/zapier/webhooks/meeting', {
            ...meetingData,
            userId: meetingData.userId || this.bundle.authData.userId,
        });
    }
    /**
     * Get the status of a processing session
     */
    async getSessionStatus(sessionId) {
        return this.get(`/api/sessions/${sessionId}/status`);
    }
    /**
     * Get the results of a completed session
     */
    async getSessionResults(sessionId) {
        return this.get(`/api/sessions/${sessionId}/results`);
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=api-client.js.map