export interface EmailClassification {
  priority: 'urgent' | 'high' | 'normal' | 'low';
  category: 'bug_report' | 'feature_request' | 'question' | 'complaint' | 'praise' | 'other';
  reasoning: string;
  confidence: number;
}

export interface EmailSummary {
  problem: string;
  context: string;
  ask: string;
  summary: string;
}

export interface EmailReplyDraft {
  subject: string;
  body: string;
  tone: 'professional' | 'friendly' | 'urgent';
  next_steps: string[];
}

export interface EmailTriageResult {
  sessionId: string;
  emailId: string;
  classification: EmailClassification;
  summary: EmailSummary;
  replyDraft: EmailReplyDraft;
  status: 'processing' | 'completed' | 'failed';
  processedAt: Date;
}

export interface EmailTriageState {
  sessionId: string;
  emailData: {
    id: string;
    body: string;
    metadata: {
      subject: string;
      from: string;
      to: string;
      timestamp: string;
      headers?: any;
    };
  };
  classification?: EmailClassification;
  summary?: EmailSummary;
  replyDraft?: EmailReplyDraft;
  currentStep: string;
  progress: number;
}

export interface EmailClassificationConfig {
  name: string;
  systemPrompt: string;
  priorities: string[];
  categories: string[];
}

export interface EmailSummarizationConfig {
  name: string;
  systemPrompt: string;
  maxSummaryLength: number;
}

export interface EmailReplyDraftConfig {
  name: string;
  systemPrompt: string;
  replyTemplates: {
    [key: string]: string;
  };
}

export interface ZapierEmailPayload {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
  headers: any;
  metadata?: any;
  userId?: string;
}

export interface DelegationResult {
  id: string;
  emailId: string;
  delegatorId: string;
  delegateId: string;
  notes?: string;
  summary: string;
  status: 'pending' | 'accepted' | 'completed';
  createdAt: Date;
} 