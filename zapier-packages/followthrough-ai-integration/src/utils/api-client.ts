import { Bundle, ZObject } from 'zapier-platform-core';

export class ApiClient {
  private baseUrl: string;
  private z: ZObject;
  private bundle: Bundle;

  constructor(z: ZObject, bundle: Bundle) {
    this.z = z;
    this.bundle = bundle;
    this.baseUrl = process.env.FOLLOWTHROUGH_API_URL || 'https://your-domain.com';
  }

  /**
   * Make a POST request to the API
   */
  async post(endpoint: string, data: any): Promise<any> {
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
    } catch (error) {
      this.z.console.error(`POST ${endpoint} failed:`, error);
      throw new Error(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make a GET request to the API
   */
  async get(endpoint: string, params?: Record<string, string>): Promise<any> {
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
    } catch (error) {
      this.z.console.error(`GET ${endpoint} failed:`, error);
      throw new Error(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make a PUT request to the API
   */
  async put(endpoint: string, data: any): Promise<any> {
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
    } catch (error) {
      this.z.console.error(`PUT ${endpoint} failed:`, error);
      throw new Error(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make a DELETE request to the API
   */
  async delete(endpoint: string): Promise<any> {
    try {
      return await this.z.request({
        url: `${this.baseUrl}${endpoint}`,
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.bundle.authData.access_token}`,
          'x-api-key': this.bundle.authData.api_key,
        },
      });
    } catch (error) {
      this.z.console.error(`DELETE ${endpoint} failed:`, error);
      throw new Error(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make a request to the Zapier webhook endpoint for email triage
   */
  async triggerEmailTriage(emailData: {
    id: string;
    subject: string;
    from: string;
    to: string;
    body: string;
    timestamp: string;
    headers: Record<string, string>;
    userId?: string;
  }): Promise<any> {
    return this.post('/api/zapier/webhooks/email', {
      ...emailData,
      userId: emailData.userId || this.bundle.authData.userId,
    });
  }

  /**
   * Make a request to trigger meeting analysis
   */
  async triggerMeetingAnalysis(meetingData: {
    id: string;
    summary: string;
    description: string;
    start: string;
    end: string;
    attendees: string[];
    location?: string;
    userId?: string;
  }): Promise<any> {
    return this.post('/api/zapier/webhooks/meeting', {
      ...meetingData,
      userId: meetingData.userId || this.bundle.authData.userId,
    });
  }

  /**
   * Get the status of a processing session
   */
  async getSessionStatus(sessionId: string): Promise<any> {
    return this.get(`/api/sessions/${sessionId}/status`);
  }

  /**
   * Get the results of a completed session
   */
  async getSessionResults(sessionId: string): Promise<any> {
    return this.get(`/api/sessions/${sessionId}/results`);
  }
} 