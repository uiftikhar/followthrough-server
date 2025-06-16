# Meeting Analysis Agentic Workflow: Complete Integration Guide

## 📋 Overview

This guide provides a comprehensive walkthrough of the meeting analysis agentic workflow, including:
- How the system works internally
- MongoDB storage patterns and collections
- Client integration patterns
- API endpoints and response formats
- Real-time progress tracking

## 🏗️ System Architecture

### Core Components

The meeting analysis system follows this flow:

1. **Client Request** → `MeetingAnalysisController`
2. **Routing** → `UnifiedWorkflowService` 
3. **Processing** → `MeetingAnalysisService`
4. **RAG Enhancement** → Context retrieval from Pinecone
5. **Agent Execution** → Specialized analysis agents
6. **Storage** → MongoDB `sessions` collection
7. **Result Retrieval** → Client polling or WebSocket

## 🗄️ MongoDB Storage Pattern

### Primary Collection: `sessions`

The meeting analysis results are stored in the **`sessions`** collection in MongoDB. Here's the schema:

```typescript
interface Session {
  sessionId: string;           // Unique identifier (UUID)
  userId: string;              // User who initiated the analysis
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;            // 0-100 percentage
  startTime: Date;             // When analysis started
  endTime?: Date;              // When analysis completed
  transcript?: string;         // Original meeting transcript
  metadata?: Record<string, any>; // Additional metadata
  
  // Agent Results (clean outputs only)
  topics?: Topic[];            // 3-7 key themes
  actionItems?: ActionItem[];  // 3-10 concrete action items
  summary?: MeetingSummary;    // Meeting summary
  sentiment?: SentimentAnalysis; // Sentiment analysis
  
  errors?: AnalysisError[];    // Any errors during processing
  createdAt?: Date;
  updatedAt?: Date;
}
```

### Data Types

```typescript
interface Topic {
  name: string;                // Theme title (3-8 words)
  description: string;         // Comprehensive explanation
  relevance: number;           // 1-10 importance score
  subtopics: string[];         // 2-4 specific subtopics
  keywords: string[];          // 3-5 key terms
  participants: string[];      // People who discussed this
  duration: string;            // Time spent (e.g., "15 minutes")
}

interface ActionItem {
  description: string;         // Clear, specific task description
  assignee: string;           // Person responsible
  deadline?: string;          // Specific deadline if mentioned
  status: "pending";          // Always "pending" for new items
  priority?: "high" | "medium" | "low"; // Only if explicitly stated
  context: string;            // Why this action is needed
}

interface SentimentAnalysis {
  overall: number;            // Overall sentiment score (-1 to 1)
  segments: Array<{
    text: string;             // Text segment
    score: number;            // Sentiment score for segment
  }>;
}

interface MeetingSummary {
  meetingTitle: string;       // Meeting title
  summary: string;            // Brief summary
  decisions: Array<{
    title: string;            // Decision title
    content: string;          // Decision details
  }>;
  next_steps?: string[];      // Next steps if identified
}
```

## 🚀 Complete Workflow Execution

### Phase 1: Client Request

```bash
POST /api/meeting-analysis
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "transcript": "[Sophia]: Good morning, everyone. Let's jump right in. We have a critical production bug...",
  "metadata": {
    "title": "Production Bug Resolution Meeting",
    "participants": ["Sophia", "Emily", "Adrian", "Jason"],
    "date": "2024-01-15T10:00:00Z",
    "duration": "45 minutes"
  }
}
```

**Response:**
```json
{
  "sessionId": "session-1750071201219-ac0gl0c22",
  "status": "pending",
  "message": "Analysis started successfully"
}
```

### Phase 2: Internal Processing

1. **Session Creation**: Creates entry in `sessions` collection
2. **RAG Enhancement**: Stores transcript in Pinecone for context retrieval
3. **Agent Graph Execution**: Runs specialized agents in sequence:
   - **Topic Extraction**: Identifies 3-7 key themes
   - **Action Item Extraction**: Finds 3-10 concrete tasks
   - **Sentiment Analysis**: Analyzes meeting tone
   - **Summary Generation**: Creates comprehensive summary

### Phase 3: Result Storage

Results are stored in the same `sessions` document with clean agent outputs only.

## 📡 Client Integration Guide

### 1. Authentication

All endpoints require JWT authentication:

```javascript
const token = 'your-jwt-token';
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### 2. Submit Analysis Request

```javascript
async function analyzeTranscript(transcript, metadata) {
  const response = await fetch('/api/meeting-analysis', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transcript: transcript,
      metadata: {
        title: metadata.title || "Meeting Analysis",
        participants: metadata.participants || [],
        date: metadata.date || new Date().toISOString(),
        duration: metadata.duration
      }
    })
  });
  
  const result = await response.json();
  return result.sessionId;
}
```

### 3. Poll for Results

```javascript
async function getAnalysisResults(sessionId) {
  const response = await fetch(`/api/meeting-analysis/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Polling function
async function waitForResults(sessionId, maxAttempts = 30, interval = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getAnalysisResults(sessionId);
    
    if (result.status === 'completed') {
      return result;
    } else if (result.status === 'failed') {
      throw new Error('Analysis failed: ' + (result.errors?.[0]?.error || 'Unknown error'));
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Analysis timeout - results not ready after maximum attempts');
}
```

### 4. Real-time Progress Tracking (WebSocket)

```javascript
import io from 'socket.io-client';

function trackProgress(sessionId) {
  const socket = io('/meeting-analysis', {
    auth: {
      token: yourJwtToken
    }
  });
  
  // Join session room for updates
  socket.emit('join-session', sessionId);
  
  // Listen for progress updates
  socket.on('progress-update', (data) => {
    console.log(`Progress: ${data.progress}% - ${data.message}`);
    updateProgressBar(data.progress);
  });
  
  // Listen for completion
  socket.on('analysis-complete', (data) => {
    console.log('Analysis completed!', data);
    displayResults(data.results);
  });
  
  // Handle errors
  socket.on('analysis-error', (error) => {
    console.error('Analysis failed:', error);
    showError(error.message);
  });
  
  return socket;
}
```

## 🎯 Response DTOs and Expected Outputs

### Analysis Result DTO

```typescript
interface AnalysisResultDto {
  sessionId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  
  // Clean agent outputs (only when completed)
  topics: Topic[];              // 3-7 key themes
  actionItems: ActionItem[];    // 3-10 concrete action items
  summary: MeetingSummary;      // Comprehensive summary
  sentiment: SentimentAnalysis; // Sentiment analysis
  
  errors: AnalysisError[];      // Any processing errors
  metadata: {
    ragEnabled: boolean;        // Whether RAG was used
    ragUsed: boolean;          // Whether RAG context was found
    processingTime?: string;    // Processing duration
  };
}
```

### Example Complete Response

```json
{
  "sessionId": "session-1750071201219-ac0gl0c22",
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:31:30Z",
  "topics": [
    {
      "name": "Production Bug Resolution",
      "description": "Comprehensive discussion of a critical production bug affecting B2B users, including root cause analysis, immediate fixes, and preventive measures",
      "relevance": 9,
      "subtopics": ["Root cause analysis", "Immediate hotfix deployment", "Monitoring improvements", "User communication"],
      "keywords": ["production bug", "CRM sync", "hotfix", "monitoring"],
      "participants": ["Emily", "Adrian", "Sophia", "Jason"],
      "duration": "25 minutes"
    },
    {
      "name": "System Monitoring Enhancement",
      "description": "Discussion of improving system monitoring and alerting to prevent similar issues in the future",
      "relevance": 7,
      "subtopics": ["Datadog integration", "Error logging", "Alert configuration"],
      "keywords": ["monitoring", "alerts", "logging", "Datadog"],
      "participants": ["Jason", "Emily"],
      "duration": "10 minutes"
    }
  ],
  "actionItems": [
    {
      "description": "Debug and patch the backend to fix the data mapping issue causing sync failures with multi-region shipping orders",
      "assignee": "Emily and Adrian",
      "deadline": "EOD today",
      "status": "pending",
      "context": "Critical production bug affecting B2B users needs immediate resolution"
    },
    {
      "description": "Implement a UI alert to indicate sync failure to users",
      "assignee": "Dimitri",
      "status": "pending",
      "context": "Users currently receive no feedback when sync issues occur"
    },
    {
      "description": "Configure Datadog monitoring alerts for sync failures",
      "assignee": "Jason",
      "status": "pending",
      "context": "Need proactive monitoring to catch similar issues earlier"
    }
  ],
  "sentiment": {
    "overall": 0.6,
    "segments": [
      {
        "text": "Good morning, everyone. Let's jump right in. We have a critical production bug impacting internal B2B users.",
        "score": 0
      },
      {
        "text": "Great. Quick action recap: Emily and Adrian debug and patch the backend, Dimitri implements UI alerts, Jason configures Datadog monitoring, Maria handles user comms.",
        "score": 0.5
      }
    ]
  },
  "summary": {
    "meetingTitle": "Production Bug Resolution Meeting",
    "summary": "The meeting, led by Sophia, focused on addressing a critical production bug affecting internal B2B users, specifically involving order sync issues with the CRM system. The team identified the root cause as recent API changes affecting multi-region shipping orders and developed a comprehensive action plan including immediate fixes, monitoring improvements, and user communication.",
    "decisions": [
      {
        "title": "Implement UI Alerts for Sync Failures",
        "content": "Dimitri was tasked with adding a user interface alert to inform users of order sync failures to improve user experience by providing immediate feedback on sync status."
      },
      {
        "title": "Debug and Patch Backend Mapping Logic",
        "content": "Emily and Adrian were assigned to pair up and debug the backend mapping logic to deploy a hotfix by the end of the day without rolling back other critical updates."
      },
      {
        "title": "Enhance Logging and Monitoring",
        "content": "The team decided to enhance logging around CRM interactions and set up Datadog alerts for sync failures to improve the team's ability to detect and respond to similar issues in the future."
      }
    ]
  },
  "errors": [],
  "metadata": {
    "ragEnabled": true,
    "ragUsed": true,
    "processingTime": "90 seconds"
  }
}
```

## 🔧 Error Handling

### Common Error Scenarios

1. **Session Not Found**
```json
{
  "statusCode": 404,
  "message": "Session not found",
  "error": "Not Found"
}
```

2. **Analysis Failed**
```json
{
  "sessionId": "session-123",
  "status": "failed",
  "errors": [
    {
      "step": "topic_extraction",
      "error": "Failed to extract topics from transcript",
      "timestamp": "2024-01-15T10:31:00Z"
    }
  ]
}
```

3. **Invalid Input**
```json
{
  "statusCode": 400,
  "message": ["transcript should not be empty"],
  "error": "Bad Request"
}
```

## 📊 Performance Considerations

### Typical Processing Times
- **Short meetings** (< 30 min transcript): 30-60 seconds
- **Medium meetings** (30-60 min transcript): 60-120 seconds  
- **Long meetings** (> 60 min transcript): 120-300 seconds

### Rate Limits
- **Analysis requests**: 10 per minute per user
- **Result queries**: 60 per minute per user

### Best Practices

1. **Implement proper polling intervals** (2-5 seconds)
2. **Use WebSocket for real-time updates** when available
3. **Cache results** on the client side once completed
4. **Handle timeouts gracefully** (max 5 minutes for analysis)
5. **Validate transcript length** (max 100,000 characters)

## 🧪 Testing the Integration

### Complete Test Script

```javascript
async function testMeetingAnalysis() {
  const transcript = `
[Sophia]: Good morning, everyone. Let's jump right in. We have a critical production bug impacting internal B2B users.
[Maria]: Sure. Yesterday, internal stakeholders reported that orders from the admin interface aren't syncing correctly to our CRM system.
[Emily]: Yes, specifically, the endpoint /orders/shipping-region was updated to accommodate a new payload structure.
[Sophia]: Emily, Adrian, could you pair on debugging this post-meeting?
[Adrian]: I'm available.
[Sophia]: Aiming for a hotfix by EOD today. Emily and Adrian, feasible?
[Emily]: Yes, provided the issue is what we suspect.
  `;

  try {
    // 1. Submit analysis
    console.log('Submitting analysis...');
    const sessionId = await analyzeTranscript(transcript, {
      title: "Production Bug Resolution",
      participants: ["Sophia", "Maria", "Emily", "Adrian"],
      date: new Date().toISOString()
    });
    
    console.log(`Analysis started with session ID: ${sessionId}`);
    
    // 2. Wait for results
    console.log('Waiting for results...');
    const results = await waitForResults(sessionId);
    
    // 3. Display results
    console.log('Analysis completed!');
    console.log(`Topics found: ${results.topics.length}`);
    console.log(`Action items: ${results.actionItems.length}`);
    console.log(`Overall sentiment: ${results.sentiment.overall}`);
    
    return results;
    
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Run the test
testMeetingAnalysis()
  .then(results => console.log('Test successful:', results))
  .catch(error => console.error('Test failed:', error));
```

## 🔍 Monitoring and Debugging

### Useful Endpoints for Debugging

1. **Check session status directly**:
```bash
GET /unified-workflow/result/{sessionId}
```

2. **View raw session data** (admin only):
```bash
GET /admin/sessions/{sessionId}
```

### Log Patterns to Watch

```bash
# Successful analysis
[MeetingAnalysisService] Created new analysis session: session-123
[MeetingAnalysisService] Session session-123 will use RAG capabilities by default
[MeetingAnalysisService] Successfully completed analysis for session session-123

# Failed analysis
[MeetingAnalysisService] Error in analysis: <error message>
[MeetingAnalysisService] Analysis failed for session session-123: <error message>
```

This guide provides everything needed to integrate with the meeting analysis agentic workflow, from understanding the internal architecture to implementing robust client-side integration patterns. 