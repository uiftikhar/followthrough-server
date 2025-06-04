/**
 * Gmail System Client Integration Types
 * 
 * TypeScript interfaces for all API responses and WebSocket events.
 * Use these types in your client applications for better type safety.
 */

// ===== AUTHENTICATION TYPES =====

export interface AuthUrlResponse {
  success: boolean;
  authUrl: string;
  message: string;
  instructions: string;
}

// ===== STATUS TYPES =====

export interface StatusResponse {
  success: boolean;
  status: {
    user: {
      userId: string;
      isConnectedToGoogle: boolean;
      authenticationStatus: 'not_connected' | 'connected' | 'auth_failed';
    };
    gmail: {
      authenticatedAs: string | null;
      monitoringAccount: string | null;
      accountsMatch: boolean;
      watchActive: boolean;
      watchDetails?: {
        watchId: string;
        expiresAt: string;
        notificationsReceived: number;
        emailsProcessed: number;
        errorCount: number;
      };
    };
    infrastructure: {
      pubsubConfigured: boolean;
      note: string;
    };
    health: {
      overall: 'healthy' | 'issues_detected';
      issues: string[];
      recommendations: string[];
    };
  };
  nextSteps: string[];
}

export interface InfrastructureHealthResponse {
  success: boolean;
  user: {
    userId: string;
    requestedAt: string;
  };
  infrastructure: {
    pubsub: {
      connected: boolean;
      subscriptions: {
        pushSubscription: { exists: boolean; messageCount?: number };
        pullSubscription: { exists: boolean; messageCount?: number };
      };
    };
    watches: {
      totalActive: number;
      expiringSoon: number;
      withErrors: number;
      totalNotifications: number;
      totalEmailsProcessed: number;
    };
  };
  status: 'healthy' | 'unhealthy';
  timestamp: string;
}

// ===== SETUP & MANAGEMENT TYPES =====

export interface SetupNotificationsRequest {
  labelIds?: string[];
  labelFilterBehavior?: 'INCLUDE' | 'EXCLUDE';
}

export interface SetupNotificationsResponse {
  success: boolean;
  message: string;
  status: 'setup_complete' | 'already_active';
  watchInfo: {
    watchId: string;
    email: string;
    expiresAt: string;
    historyId: string;
  };
  important: {
    note: string;
    authenticatedAccount: string;
    monitoringAccount: string;
    guidance: string;
  };
}

export interface DisableNotificationsResponse {
  success: boolean;
  message: string;
  nextSteps?: string[];
}

// ===== TESTING TYPES =====

export interface TestEmailTriageRequest {
  subject: string;
  from: string;
  body: string;
  to?: string;
}

export interface EmailMetadata {
  subject: string;
  from: string;
  to: string;
  date: string;
  messageId: string;
  gmailSource: boolean;
  userId: string;
  headers?: Record<string, string>;
  labels?: string[];
}

export interface TestTriageResponse {
  success: boolean;
  message: string;
  sessionId: string;
  result: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    sessionId: string;
    isProcessing: boolean;
  };
  testEmail: {
    id: string;
    body: string;
    metadata: EmailMetadata;
  };
  note: string;
}

export interface PubSubTestResponse {
  success: boolean;
  user: {
    userId: string;
    testedAt: string;
  };
  pubsub: {
    connected: boolean;
    subscriptions: {
      pushSubscription: { exists: boolean; messageCount?: number };
      pullSubscription: { exists: boolean; messageCount?: number };
    };
    error?: string;
  };
  message: string;
}

// ===== HEALTH & MONITORING TYPES =====

export interface HealthResponse {
  success: boolean;
  status: 'healthy' | 'unhealthy';
  pubsub: {
    connected: boolean;
    subscriptions: any;
  };
  watches: {
    totalActive: number;
    expiringSoon: number;
    withErrors: number;
    totalNotifications: number;
    totalEmailsProcessed: number;
  };
  timestamp: string;
}

export interface WebhookHealthResponse {
  status: 'healthy' | 'unhealthy';
  pubsub: boolean;
  subscriptions: any;
  watchStats: {
    totalActive: number;
    contextNote: string;
  };
  timestamp: string;
}

// ===== ERROR TYPES =====

export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  guidance?: string[];
  troubleshooting?: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
}

// ===== WEBSOCKET TYPES =====

export interface WebSocketAuthOptions {
  token: string;
}

export interface SubscribeRequest {
  userId: string;
  emailAddress: string;
}

export interface UnsubscribeRequest {
  userId: string;
  emailAddress: string;
}

// Server → Client Events

export interface ConnectedEvent {
  message: string;
  clientId: string;
  timestamp: string;
}

export interface SubscribedEvent {
  message: string;
  userId: string;
  emailAddress: string;
  rooms: string[];
}

export interface EmailReceivedEvent {
  emailId: string;
  emailAddress: string;
  subject: string;
  from: string;
  to: string;
  body: string; // preview (first 500 chars)
  timestamp: string;
  fullEmail: {
    id: string;
    threadId: string;
    metadata: EmailMetadata;
    bodyLength: number;
  };
}

export interface TriageStartedEvent {
  sessionId: string;
  emailId: string;
  emailAddress: string;
  subject: string;
  from: string;
  timestamp: string;
  source: string;
}

export interface TriageProcessingEvent {
  sessionId: string;
  emailId: string;
  emailAddress: string;
  subject: string;
  status: string;
  timestamp: string;
  source: string;
}

export interface TriageCompletedEvent {
  sessionId: string;
  emailId: string;
  result: {
    classification: {
      category: string;
      priority: string;
      confidence: number;
    };
    summary: string;
    replyDraft: string;
  };
  timestamp: string;
}

export interface TriageFailedEvent {
  emailId: string;
  emailAddress: string;
  subject?: string;
  error: string;
  timestamp: string;
  source: string;
}

export interface StatusResponseEvent {
  clientId: string;
  connectedClients: number;
  rooms: string[];
  timestamp: string;
}

// ===== CLIENT INTEGRATION TYPES =====

export interface GmailClientConfig {
  apiUrl: string;
  jwtToken: string;
  socketOptions?: {
    transports?: string[];
    timeout?: number;
    forceNew?: boolean;
  };
}

export interface ClientEventHandlers {
  onEmailReceived?: (event: EmailReceivedEvent) => void;
  onTriageStarted?: (event: TriageStartedEvent) => void;
  onTriageProcessing?: (event: TriageProcessingEvent) => void;
  onTriageCompleted?: (event: TriageCompletedEvent) => void;
  onTriageFailed?: (event: TriageFailedEvent) => void;
  onConnected?: (event: ConnectedEvent) => void;
  onSubscribed?: (event: SubscribedEvent) => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

// ===== API CLIENT INTERFACE =====

export interface IGmailApiClient {
  // Authentication
  getOAuthUrl(): Promise<AuthUrlResponse>;
  
  // Status
  getStatus(): Promise<StatusResponse>;
  getInfrastructureHealth(): Promise<InfrastructureHealthResponse>;
  
  // Setup & Management
  setupNotifications(options?: SetupNotificationsRequest): Promise<SetupNotificationsResponse>;
  disableNotifications(): Promise<DisableNotificationsResponse>;
  
  // Testing
  testTriage(email?: TestEmailTriageRequest): Promise<TestTriageResponse>;
  testPubSub(): Promise<PubSubTestResponse>;
  
  // Health & Monitoring
  getHealth(): Promise<HealthResponse>;
  getWebhookHealth(): Promise<WebhookHealthResponse>;
}

// ===== WEBSOCKET CLIENT INTERFACE =====

export interface IGmailWebSocketClient {
  connect(config: { userId: string; emailAddress: string }): Promise<void>;
  disconnect(): void;
  subscribe(userId: string, emailAddress: string): void;
  unsubscribe(userId: string, emailAddress: string): void;
  sendTest(): void;
  getStatus(): void;
  
  // Event handlers
  on<K extends keyof ClientEventHandlers>(event: K, handler: ClientEventHandlers[K]): void;
  off<K extends keyof ClientEventHandlers>(event: K, handler?: ClientEventHandlers[K]): void;
}

// ===== UTILITY TYPES =====

export type EmailPriority = 'low' | 'medium' | 'high' | 'urgent';
export type EmailCategory = 'support' | 'sales' | 'billing' | 'technical' | 'general';
export type SystemStatus = 'healthy' | 'degraded' | 'unhealthy';
export type TriageStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface EmailClassification {
  category: EmailCategory;
  priority: EmailPriority;
  confidence: number;
  tags?: string[];
}

export interface EmailSummary {
  shortSummary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  actionItems?: string[];
}

export interface EmailReplyDraft {
  subject: string;
  body: string;
  tone: 'professional' | 'friendly' | 'formal' | 'casual';
  confidence: number;
}

export interface TriageResult {
  classification: EmailClassification;
  summary: EmailSummary;
  replyDraft: EmailReplyDraft;
  processingTime?: number;
  sessionId: string;
}

// ===== RATE LIMITING TYPES =====

export interface RateLimitInfo {
  endpoint: string;
  limit: number;
  remaining: number;
  resetTime: Date;
}

export interface RateLimitError extends Error {
  rateLimitInfo: RateLimitInfo;
  retryAfter: number; // seconds
}

// ===== MONITORING TYPES =====

export interface PerformanceMetrics {
  endpoint: string;
  responseTime: number;
  status: number;
  timestamp: Date;
  userAgent?: string;
  userId?: string;
}

export interface SystemMetrics {
  activeConnections: number;
  activeWatches: number;
  emailsProcessedToday: number;
  averageTriageTime: number;
  errorRate: number;
  lastUpdate: Date;
}

// ===== EXPORT ALL TYPES =====

export * from './client-types';

// Example usage in client applications:
/*
import { 
  IGmailApiClient, 
  IGmailWebSocketClient, 
  StatusResponse, 
  EmailReceivedEvent,
  GmailClientConfig 
} from './client-types';

const config: GmailClientConfig = {
  apiUrl: 'https://api.example.com',
  jwtToken: 'your-jwt-token'
};

const apiClient: IGmailApiClient = new GmailApiClient(config);
const wsClient: IGmailWebSocketClient = new GmailWebSocketClient(config);

// API usage
const status: StatusResponse = await apiClient.getStatus();

// WebSocket usage
wsClient.on('onEmailReceived', (event: EmailReceivedEvent) => {
  console.log('New email:', event.subject);
});
*/ 