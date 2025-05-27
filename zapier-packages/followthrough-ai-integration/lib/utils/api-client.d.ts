import { Bundle, ZObject } from 'zapier-platform-core';
export declare class ApiClient {
    private baseUrl;
    private z;
    private bundle;
    constructor(z: ZObject, bundle: Bundle);
    /**
     * Make a POST request to the API
     */
    post(endpoint: string, data: any): Promise<any>;
    /**
     * Make a GET request to the API
     */
    get(endpoint: string, params?: Record<string, string>): Promise<any>;
    /**
     * Make a PUT request to the API
     */
    put(endpoint: string, data: any): Promise<any>;
    /**
     * Make a DELETE request to the API
     */
    delete(endpoint: string): Promise<any>;
    /**
     * Make a request to the Zapier webhook endpoint for email triage
     */
    triggerEmailTriage(emailData: {
        id: string;
        subject: string;
        from: string;
        to: string;
        body: string;
        timestamp: string;
        headers: Record<string, string>;
        userId?: string;
    }): Promise<any>;
    /**
     * Make a request to trigger meeting analysis
     */
    triggerMeetingAnalysis(meetingData: {
        id: string;
        summary: string;
        description: string;
        start: string;
        end: string;
        attendees: string[];
        location?: string;
        userId?: string;
    }): Promise<any>;
    /**
     * Get the status of a processing session
     */
    getSessionStatus(sessionId: string): Promise<any>;
    /**
     * Get the results of a completed session
     */
    getSessionResults(sessionId: string): Promise<any>;
}
//# sourceMappingURL=api-client.d.ts.map