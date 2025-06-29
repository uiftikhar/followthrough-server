# Meeting Analysis Client Integration Guide

## 📋 Overview

This guide provides a complete walkthrough for integrating with the meeting analysis system, covering the full client workflow from triggering analysis to retrieving stored results from the MongoDB sessions collection.

## 🔄 Client Workflow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant MeetingService
    participant MongoDB
    
    Client->>API: POST /api/meeting-analysis
    API->>MeetingService: Start Analysis
    MeetingService->>MongoDB: Create Session (pending)
    API-->>Client: Return sessionId
    
    loop Polling
        Client->>API: GET /api/meeting-analysis/{sessionId}
        API->>MongoDB: Query Session
        MongoDB-->>API: Return Session Data
        API-->>Client: Return Status & Results
        
        alt Analysis Complete
            break
        else Analysis In Progress
            Note over Client: Wait 2-5 seconds
        end
    end
    
    Client->>API: GET /api/meeting-analysis/{sessionId}
    API->>MongoDB: Query Final Results
    MongoDB-->>API: Complete Analysis Results
    API-->>Client: Full Analysis Results
```

## 🚀 Step-by-Step Integration

### **Step 1: Submit Meeting Analysis**

**Endpoint:** `POST /api/meeting-analysis`

**Request:**
```typescript
interface AnalysisRequest {
  transcript: string;
  metadata?: {
    title?: string;
    participants?: string[];
    date?: string;
    duration?: string;
    meetingType?: string;
  };
}
```

**Example Request:**
```javascript
const response = await fetch('/api/meeting-analysis', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    transcript: `[Sophia]: Good morning, everyone. Let's jump right in. We have a critical production bug impacting internal B2B users...`,
    metadata: {
      title: "Production Bug Resolution Meeting",
      participants: ["Sophia", "Maria", "Emily", "Adrian", "Jason"],
      date: "2025-01-15T10:30:00Z",
      duration: "30 minutes"
    }
  })
});

const result = await response.json();
console.log(result.sessionId); // "session-1750162464162-b9qdhaq1n"
```

**Response:**
```typescript
interface AnalysisResponse {
  sessionId: string;
  status: "pending";
  message: string;
}
```

### **Step 2: Poll for Analysis Results**

**Endpoint:** `GET /api/meeting-analysis/{sessionId}`

**Polling Strategy:**
- Poll every 2-5 seconds
- Maximum 30 attempts (60 seconds total)
- Check `status` field for completion

**Example Polling:**
```javascript
async function pollForResults(sessionId) {
  const maxAttempts = 30;
  const pollInterval = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(`/api/meeting-analysis/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    const result = await response.json();
    
    console.log(`Attempt ${attempt}: ${result.status} (${result.progress}%)`);
    
    if (result.status === 'completed') {
      return result; // Analysis complete!
    } else if (result.status === 'failed') {
      throw new Error(`Analysis failed: ${result.analysisErrors?.[0]?.error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('Analysis timeout');
}
```

### **Step 3: Process Results**

**Complete Response Structure:**
```typescript
interface AnalysisResult {
  sessionId: string;
  userId: string;
  status: "completed" | "failed" | "pending" | "in_progress";
  progress: number; // 0-100
  startTime: string; // ISO timestamp
  endTime?: string; // ISO timestamp
  transcript: string;
  
  // Analysis Results
  topics: Topic[];
  actionItems: ActionItem[];
  summary: MeetingSummary;
  sentiment: SentimentAnalysis;
  
  // Metadata
  metadata: {
    title?: string;
    participants?: string[];
    date?: string;
    processingTime?: string;
    ragEnabled?: boolean;
    ragUsed?: boolean;
    analysisCompletedAt?: string;
    resultsSummary?: {
      topicsCount: number;
      actionItemsCount: number;
      hasSummary: boolean;
      hasSentiment: boolean;
    };
  };
  
  // Error handling
  analysisErrors?: AnalysisError[];
  
  createdAt: string;
  updatedAt: string;
}
```

## 📊 Data Type Definitions

### **Topics**
```typescript
interface Topic {
  name: string;
  description: string;
  relevance: number; // 1-10 scale
  subtopics: string[];
  keywords: string[];
  participants: string[];
  duration?: string;
}
```

**Example:**
```json
{
  "name": "Production Bug Resolution",
  "description": "Comprehensive discussion of a critical production bug affecting B2B users",
  "relevance": 9,
  "subtopics": ["Root cause analysis", "Immediate hotfix deployment", "Monitoring improvements"],
  "keywords": ["production bug", "CRM sync", "hotfix"],
  "participants": ["Emily", "Adrian", "Sophia", "Jason"],
  "duration": "25 minutes"
}
```

### **Action Items**
```typescript
interface ActionItem {
  description: string;
  assignee?: string;
  deadline?: string;
  status: "pending" | "in_progress" | "completed";
  priority?: "high" | "medium" | "low";
  context?: string;
}
```

**Example:**
```json
{
  "description": "Debug and patch the backend to fix data mapping issue causing sync failures",
  "assignee": "Emily and Adrian",
  "deadline": "EOD today",
  "status": "pending",
  "priority": "high",
  "context": "Critical production bug affecting B2B users needs immediate resolution"
}
```

### **Summary**
```typescript
interface MeetingSummary {
  meetingTitle: string;
  summary: string;
  decisions: Decision[];
  next_steps?: string[];
}

interface Decision {
  title: string;
  content: string;
}
```

### **Sentiment Analysis**
```typescript
interface SentimentAnalysis {
  overall: number; // -1 to 1 scale
  segments: SentimentSegment[];
}

interface SentimentSegment {
  text: string;
  score: number; // -1 to 1 scale
}
```

## 🗄️ MongoDB Sessions Collection Structure

**Document Example:**
```json
{
  "_id": ObjectId("68515c203b92b9d90642e2e5"),
  "sessionId": "session-1750162464162-b9qdhaq1n",
  "userId": "68515bca3b92b9d90642e2dd",
  "status": "completed",
  "progress": 100,
  "startTime": ISODate("2025-01-15T10:30:00.000Z"),
  "endTime": ISODate("2025-01-15T10:31:45.000Z"),
  "transcript": "[Sophia]: Good morning, everyone. Let's jump right in...",
  "topics": [
    {
      "name": "Production Bug Resolution",
      "description": "Comprehensive discussion of a critical production bug affecting B2B users",
      "relevance": 9,
      "subtopics": ["Root cause analysis", "Immediate hotfix deployment"],
      "keywords": ["production bug", "CRM sync", "hotfix"],
      "participants": ["Emily", "Adrian", "Sophia", "Jason"],
      "duration": "25 minutes"
    }
  ],
  "actionItems": [
    {
      "description": "Debug and patch the backend to fix data mapping issue",
      "assignee": "Emily and Adrian",
      "deadline": "EOD today",
      "status": "pending",
      "priority": "high",
      "context": "Critical production bug affecting B2B users"
    }
  ],
  "summary": {
    "meetingTitle": "Production Bug Resolution Meeting",
    "summary": "Meeting focused on addressing critical production bug affecting B2B users...",
    "decisions": [
      {
        "title": "Deploy Hotfix by End of Day",
        "content": "Team decided to deploy a hotfix by EOD to resolve the CRM sync issue"
      }
    ],
    "next_steps": ["Begin debugging session", "Implement UI alerts", "Set up monitoring"]
  },
  "sentiment": {
    "overall": 0.1,
    "segments": [
      {
        "text": "Good morning, everyone. Let's jump right in.",
        "score": 0.2
      }
    ]
  },
  "metadata": {
    "title": "Production Bug Resolution Meeting",
    "participants": ["Sophia", "Maria", "Emily", "Adrian", "Jason"],
    "date": "2025-01-15T10:30:00Z",
    "processingTime": "2025-01-15T10:31:45.000Z",
    "ragEnabled": true,
    "ragUsed": false,
    "analysisCompletedAt": "2025-01-15T10:31:45.000Z",
    "resultsSummary": {
      "topicsCount": 2,
      "actionItemsCount": 5,
      "hasSummary": true,
      "hasSentiment": true
    }
  },
  "analysisErrors": [],
  "createdAt": ISODate("2025-01-15T10:30:00.000Z"),
  "updatedAt": ISODate("2025-01-15T10:31:45.000Z")
}
```

## 🔧 Complete Integration Example

```typescript
class MeetingAnalysisClient {
  constructor(private baseUrl: string, private authToken: string) {}

  async analyzeMeeting(transcript: string, metadata?: any): Promise<AnalysisResult> {
    // Step 1: Submit analysis
    const sessionId = await this.submitAnalysis(transcript, metadata);
    
    // Step 2: Poll for results
    const results = await this.pollForResults(sessionId);
    
    // Step 3: Validate and return
    this.validateResults(results);
    return results;
  }

  private async submitAnalysis(transcript: string, metadata?: any): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/meeting-analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transcript, metadata })
    });

    if (!response.ok) {
      throw new Error(`Failed to submit analysis: ${response.statusText}`);
    }

    const result = await response.json();
    return result.sessionId;
  }

  private async pollForResults(sessionId: string): Promise<AnalysisResult> {
    const maxAttempts = 30;
    const pollInterval = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await fetch(`${this.baseUrl}/api/meeting-analysis/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.statusText}`);
      }

      const result: AnalysisResult = await response.json();
      
      console.log(`Polling attempt ${attempt}: ${result.status} (${result.progress}%)`);

      if (result.status === 'completed') {
        console.log('Analysis completed successfully!');
        return result;
      } else if (result.status === 'failed') {
        throw new Error(`Analysis failed: ${result.analysisErrors?.[0]?.error || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Analysis timeout');
  }

  private validateResults(result: AnalysisResult): void {
    const hasValidTopics = result.topics && result.topics.length > 0;
    const hasValidActionItems = result.actionItems && result.actionItems.length > 0;
    const hasSummary = result.summary && result.summary.summary;
    
    if (!hasValidTopics || !hasValidActionItems || !hasSummary) {
      console.warn('Analysis results may be incomplete:', {
        topics: result.topics?.length || 0,
        actionItems: result.actionItems?.length || 0,
        hasSummary: !!hasSummary
      });
    }
  }
}

// Usage Example
const client = new MeetingAnalysisClient('https://your-api.com', 'your-jwt-token');

try {
  const results = await client.analyzeMeeting(
    `[Sophia]: Good morning, everyone. Let's jump right in...`,
    {
      title: "Production Bug Resolution",
      participants: ["Sophia", "Maria", "Emily", "Adrian"],
      date: new Date().toISOString()
    }
  );
  
  console.log('Analysis Results:', {
    topics: results.topics.length,
    actionItems: results.actionItems.length,
    sentiment: results.sentiment.overall
  });
} catch (error) {
  console.error('Analysis failed:', error);
}
```

## 🚀 Quick Start

1. **Install dependencies** (if using TypeScript):
```bash
npm install node-fetch @types/node-fetch
```

2. **Set up authentication**:
```javascript
const authToken = 'your-jwt-token';
const baseUrl = 'https://your-api-domain.com';
```

3. **Submit analysis**:
```javascript
const response = await fetch('/api/meeting-analysis', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    transcript: 'Your meeting transcript here...',
    metadata: { title: 'Meeting Title' }
  })
});
```

4. **Poll for results**:
```javascript
const { sessionId } = await response.json();
const results = await pollForResults(sessionId);
```

## 📈 Expected Results Quality

### **Topics (3-7 per meeting)**
- **High relevance** (7-10): Core meeting subjects
- **Medium relevance** (4-6): Supporting discussions  
- **Low relevance** (1-3): Brief mentions

### **Action Items (1-10 per meeting)**
- **Clear descriptions** with specific tasks
- **Assignees identified** from participant list
- **Deadlines extracted** when mentioned
- **Priority levels** based on urgency indicators

### **Summary Quality**
- **Comprehensive overview** of meeting purpose
- **Key decisions** clearly identified
- **Next steps** actionable and specific
- **Participant contributions** acknowledged

### **Sentiment Analysis**
- **Overall sentiment** (-1 to 1 scale)
- **Segment-level analysis** for detailed insights
- **Emotional tone** detection (positive/negative/neutral)

## 🔍 Troubleshooting

### **Common Issues**

1. **Empty Results** - Check transcript format and length
2. **Timeout Errors** - Increase polling interval or max attempts  
3. **Authentication Failures** - Verify JWT token validity
4. **Incomplete Analysis** - Check for processing errors in `analysisErrors`

### **Error Handling**
```javascript
try {
  const results = await client.analyzeMeeting(transcript);
} catch (error) {
  if (error.message.includes('timeout')) {
    // Handle timeout - possibly retry
  } else if (error.message.includes('authentication')) {
    // Handle auth error - refresh token
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

This guide provides everything needed to integrate with the meeting analysis system and retrieve stored results from the MongoDB sessions collection. 