
I'll help you clean up the email triage system and then provide a comprehensive explanation of the end-to-end flow. Let me first explore the current codebase to identify what needs to be cleaned up.

Search files...
Now let me explore more about the current flow and identify testing/temporary methods:

Ran tool

Search files...
Now let me check the current pinecone configuration and RAG setup:

Search files...
Let me now check for webhook endpoints and any test scripts that need to be removed:

Read file: test-agentic-email-triage-curl.sh

Read file: test-enhanced-email-triage-curl.sh
Now let me check for any other test methods in the email triage controller and related files:

Ran tool
Now let me check the actual production webhook endpoint:

Search files...
Now I have a comprehensive understanding of the current email triage system. Let me clean it up by removing test methods and then provide a detailed explanation of the production flow.

## Cleaning Up the Email Triage System

First, let me remove the test methods and clean up the codebase:


Now let me remove the test scripts:

Ran tool

Ran tool
Now let me check if there are any other test methods that need to be removed:

Ran tool
I see there's a test method in the Gmail client controller. Since this is for client testing and not the core triage flow, I'll leave it as it's useful for integration testing. The test scripts I removed were the main temporary testing files.

Now let me check the current embedding model configuration:

Search files...
Now I'll provide you with a comprehensive explanation of the email triage system flow:

# 📧 **Email Triage System - Complete End-to-End Flow**

## **System Overview**

The email triage system is a sophisticated RAG-enhanced AI pipeline that automatically processes incoming Gmail emails through a multi-agent workflow. Here's the complete production flow:

---

## **🔗 Webhook Trigger & Email Entry Point**

### **1. Gmail Push Webhook (Production Entry Point)**
**Endpoint:** `POST /api/gmail/webhooks/push`
**File:** `src/integrations/google/controllers/gmail-webhook.controller.ts`

```typescript
@Post('push')
async handlePushNotification(@Body() payload: PubSubPushPayload)
```

**Flow:**
1. **Google Gmail** sends push notifications to Google Cloud Pub/Sub when new emails arrive
2. **Pub/Sub** forwards notifications to our webhook endpoint via HTTP POST
3. **GmailWebhookController** receives and validates the notification
4. Controller extracts `historyId` and `emailAddress` from the Pub/Sub message
5. **Gmail History API** is called to fetch actual email content since last known `historyId`
6. Each new email triggers the triage process

---

## **🤖 Unified Workflow Entry**

### **2. UnifiedWorkflowService Processing**
**File:** `src/langgraph/unified-workflow.service.ts`

When `triggerEmailTriage()` is called:

```typescript
const triageInput = {
  type: "email_triage",
  emailData: { id: email.id, body: email.body, metadata: email.metadata },
  content: email.body,
};

const result = await this.unifiedWorkflowService.processInput(triageInput, context, userId);
```

The UnifiedWorkflowService routes the request to the **Master Supervisor Graph**, which then delegates to the **Email Triage Team**.

---

## **🎯 Direct Email Triage Processing**

### **3. EmailTriageController (Production Endpoint)**
**Endpoint:** `POST /api/email/triage`
**File:** `src/email/email-triage.controller.ts`

```typescript
@Post("triage")
async processEmailTriage(@Body() emailPayload: any)
```

This endpoint:
- Creates an `EmailTriageState` with session tracking
- Executes the **EmailTriageGraphBuilder** directly
- Returns structured results (classification, summary, reply draft)

---

## **🏗️ RAG-Enhanced Agentic Graph Execution**

### **4. EmailTriageGraphBuilder - The Core Engine**
**File:** `src/email/workflow/email-triage-graph.builder.ts`

**Graph Flow Sequence:**
```
START → INITIALIZATION → CONTEXT_ENRICHMENT → PARALLEL_ANALYSIS → COORDINATION → REPLY_DRAFT → PATTERN_STORAGE → FINALIZATION → END
```

#### **Phase 1: Initialization**
- Validates email data structure
- Logs available agents (Classification, Summarization, RAG services)
- Sets up session tracking

#### **Phase 2: Context Enrichment (RAG Integration Point #1)**
```typescript
private async contextEnrichmentNode(state: EmailTriageState)
```

**RAG Usage:**
- **Pinecone Index:** `VectorIndexes.EMAIL_TRIAGE`
- **Namespace:** `"email-patterns"`
- **Embedding Model:** `text-embedding-3-large` (1024 dimensions)

**Query Generation:**
```typescript
const queries = [
  `Subject: ${subject} Content: ${body.substring(0, 200)}`,
  `Email classification priority category: ${subject}`,
  `Customer support email problem: ${keywords.join(' ')}`
];
```

**Retrieval Parameters:**
- `topK: 2` per query (max 5 total documents)
- `minScore: 0.6` (lower threshold for better recall)
- Returns historical email patterns for context

#### **Phase 3: Parallel Analysis (True Parallel Processing)**
```typescript
private async parallelAnalysisNode(state: EmailTriageState)
```

**Uses Promise.all() for TRUE parallel execution:**
```typescript
const [classificationResult, summarizationResult] = await Promise.all([
  this.executeClassification(state),
  this.executeSummarization(state),
]);
```

**Agents Called:**
1. **EmailClassificationAgent** - Categories: `bug_report`, `feature_request`, `question`, `complaint`, `praise`, `other`
2. **EmailRagSummarizationAgent** OR **EmailSummarizationAgent** (RAG-enhanced preferred)

#### **Phase 4: RAG-Enhanced Summarization (RAG Integration Point #2)**
**File:** `src/email/agents/email-rag-summarization.agent.ts`

**RAG Usage:**
- **Pinecone Index:** `VectorIndexes.EMAIL_TRIAGE`  
- **Namespace:** `"email-summaries"`
- **Embedding Model:** `text-embedding-3-large`

```typescript
const retrievedContext = await this.ragService.getContext(ragQuery, {
  indexName: VectorIndexes.EMAIL_TRIAGE,
  namespace: "email-summaries",
  topK: 3,
  minScore: 0.7,
});
```

#### **Phase 5: Reply Draft Generation (RAG Integration Point #3)**
**Agent:** `RagEmailReplyDraftAgent`
**File:** `src/email/agents/rag-email-reply-draft.agent.ts`

**RAG Usage:**
- **Pinecone Index:** `VectorIndexes.EMAIL_TRIAGE`
- **Namespace:** `"reply-patterns"`
- **Purpose:** Retrieves similar successful reply patterns for tone-adapted responses

```typescript
const patterns = await this.ragService.getContext(query, {
  indexName: VectorIndexes.EMAIL_TRIAGE,
  namespace: "reply-patterns",
  topK: 3,
  minScore: 0.6,
});
```

#### **Phase 6: Pattern Storage (RAG Learning)**
**Service:** `EmailPatternStorageService`
**File:** `src/email/agents/email-pattern-storage.service.ts`

**Stores successful patterns back to Pinecone:**
- **Index:** `VectorIndexes.EMAIL_TRIAGE`
- **Namespace:** `"email-patterns"`
- **Purpose:** Learns from successful triage results for future improvements

---

## **🗂️ Pinecone Vector Database Structure**

### **Index Configuration:**
- **Index Name:** `email-triage` (from `VectorIndexes.EMAIL_TRIAGE`)
- **Dimensions:** 1024 (matches `text-embedding-3-large`)
- **Metric:** Cosine similarity
- **Cloud:** AWS (configurable)
- **Region:** us-west-2 (configurable)

### **Namespaces:**
1. **`"email-patterns"`** - Historical successful triage patterns
2. **`"email-summaries"`** - Successful email summarization examples  
3. **`"reply-patterns"`** - Successful reply draft patterns
4. **`"user-tone-profiles"`** - User communication style profiles

---

## **🤖 Embedding Model & RAG Configuration**

### **Embedding Model:**
- **Model:** `text-embedding-3-large` (OpenAI)
- **Dimensions:** 1024
- **Service:** `EmbeddingService` (`src/embedding/embedding.service.ts`)
- **Caching:** Redis-backed caching for performance

### **RAG Service:**
- **File:** `src/rag/rag.service.ts`
- **Retrieval Strategy:** Semantic similarity search
- **Context Enrichment:** Multiple query generation for better recall

---

## **🔄 Agent Execution Sequence**

### **When RAG is Integrated:**

1. **Context Enrichment** (Pre-analysis)
   - Retrieves historical patterns BEFORE classification/summarization
   - Provides context to improve agent decisions

2. **RAG-Enhanced Summarization** 
   - Uses historical summarization patterns
   - Incorporates learned summarization styles

3. **Tone-Adapted Reply Generation**
   - Retrieves similar reply patterns
   - Adapts tone based on user communication history
   - Stores successful replies for future learning

4. **Pattern Learning** (Post-analysis)
   - Stores successful triage results
   - Creates embeddings for future retrieval
   - Enables continuous learning

---

## **📊 Real-Time Event Flow**

### **WebSocket Notifications:**
**Gateway:** `src/integrations/google/services/gmail-notification.gateway.ts`
**Namespace:** `/gmail-notifications`

**Event Sequence:**
1. `email.received` - When email is detected
2. `email.triage.started` - When triage begins  
3. `email.triage.processing` - During analysis
4. `email.triage.completed` - When results are ready
5. `email.triage.failed` - If processing fails

---

## **🚀 Production Architecture Summary**

### **Entry Points:**
1. **Gmail Webhook** → Pub/Sub → `GmailWebhookController.handlePushNotification()`
2. **Direct API** → `EmailTriageController.processEmailTriage()` (internal use)

### **Core Processing:**
- **Master Supervisor** routes to Email Triage Team
- **EmailTriageGraphBuilder** executes RAG-enhanced graph
- **Multiple RAG Integration Points** enrich processing with historical context

### **RAG Enhancement:**
- **Pre-Analysis:** Context enrichment from historical patterns
- **During Analysis:** RAG-enhanced summarization and classification  
- **Post-Analysis:** Tone-adapted reply generation and pattern storage
- **Continuous Learning:** Successful results feed back into knowledge base

### **Output:**
- Structured triage results (classification, summary, reply draft)
- Real-time WebSocket notifications to clients
- Pattern storage for continuous improvement

This system represents a sophisticated **RAG-enhanced agentic workflow** that learns and improves over time, providing increasingly accurate email triage with context-aware processing and tone-adapted responses.
