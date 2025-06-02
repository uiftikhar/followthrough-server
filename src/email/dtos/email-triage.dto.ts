export interface EmailClassification {
  priority: "urgent" | "high" | "normal" | "low";
  category:
    | "bug_report"
    | "feature_request"
    | "question"
    | "complaint"
    | "praise"
    | "other";
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
  tone: "professional" | "friendly" | "urgent";
  next_steps: string[];
}

export interface EmailTriageResult {
  sessionId: string;
  emailId: string;
  classification: EmailClassification;
  summary: EmailSummary;
  replyDraft: EmailReplyDraft;
  status: "processing" | "completed" | "failed";
  processedAt: Date;
}

export interface EmailTriageState {
  sessionId: string;
  emailData: {
    id?: string;
    body: string;
    metadata: {
      subject?: string;
      from?: string;
      to?: string;
      timestamp?: string;
      headers?: any;
      userId?: string;
    };
  };
  classification?: EmailClassification;
  summary?: EmailSummary;
  replyDraft?: EmailReplyDraft;
  currentStep: string;
  progress: number;
  error?: {
    message: string;
    stage: string;
    timestamp: string;
  };
  result?: EmailTriageResult;
  
  retrievedContext?: Array<{
    id: string;
    content: string;
    metadata?: any;
    score?: number;
    namespace?: string;
  }>;
  
  userToneProfile?: UserToneProfile;
  
  parallelResults?: {
    classificationStarted?: boolean;
    summarizationStarted?: boolean;
    classificationCompleted?: boolean;
    summarizationCompleted?: boolean;
    parallelCompletedAt?: string;
    parallelDuration?: number;
  };
  
  contextRetrievalResults?: {
    totalQueries: number;
    totalDocuments: number;
    namespaces: string[];
    retrievalDuration?: number;
    retrievedAt?: string;
  };
  
  processingMetadata?: {
    startedAt?: string;
    ragEnhanced?: boolean;
    agentsUsed?: string[];
    performanceMetrics?: {
      contextRetrievalMs?: number;
      classificationMs?: number;
      summarizationMs?: number;
      replyDraftMs?: number;
      totalProcessingMs?: number;
    };
  };
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

export interface DelegationResult {
  id: string;
  emailId: string;
  delegatorId: string;
  delegateId: string;
  notes?: string;
  summary: string;
  status: "pending" | "accepted" | "completed";
  createdAt: Date;
}

// Phase 3: User Tone Learning Interfaces
export interface ToneFeatures {
  formality: "very_formal" | "formal" | "casual" | "very_casual";
  warmth: "cold" | "neutral" | "warm" | "very_warm";
  urgency: "relaxed" | "normal" | "urgent" | "critical";
  directness: "indirect" | "balanced" | "direct" | "very_direct";
  technicalLevel: "basic" | "intermediate" | "advanced" | "expert";
  emotionalTone: "neutral" | "empathetic" | "enthusiastic" | "concerned";
  responseLength: "brief" | "moderate" | "detailed" | "comprehensive";
  keywords: string[];
  phrases: string[];
}

export interface UserToneProfile {
  userId: string;
  userEmail: string;
  communicationStyle: ToneFeatures;
  preferredTones: string[];
  commonPhrases: string[];
  responsePatterns: {
    urgent: ToneFeatures;
    normal: ToneFeatures;
    low: ToneFeatures;
  };
  lastUpdated: Date;
  sampleCount: number; // Number of emails analyzed to build this profile
  confidence: number; // 0-1 confidence in the profile accuracy
}

export interface EmailToneAnalysisConfig {
  name: string;
  systemPrompt: string;
  minSamplesForProfile: number;
  maxSamplesAnalyzed: number;
}

export interface RagEmailReplyDraftConfig extends EmailReplyDraftConfig {
  enableToneLearning: boolean;
  toneAdaptationStrength: number; // 0-1, how much to adapt to user's tone
  fallbackToBehavior: "professional" | "formal" | "friendly";
}
