# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## �� **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https://followthrough-server-production.up.railway.app
```

## 🛠️ **Step-by-Step Fix Process**

### **Step 1: Fix PubSubService Code**

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/integrations/google/services/pubsub.service.ts
</invoke>
</function_calls>

<rewritten_file>
```
# Gmail Pub/Sub Connection Fix Guide

## 🔍 **Problem Analysis**

Your Gmail push notifications aren't working because of several configuration mismatches between your updated topic/subscription names and the server configuration.

### **Current Issues Identified:**

1. **🎯 Topic Name Mismatch**: You changed to `gmail-triage` but service hardcoded to old topic
2. **🔗 Webhook URL Path Mismatch**: Script uses `/api/gmail/webhooks/push` but controller expects `/api/webhook/google/mail/push`
3. **📝 Environment Variables**: Missing/incorrect Pub/Sub configuration
4. **🔐 Service Account**: May need updated credentials for new topic

## 🔧 **Configuration Fixes Required**

### **1. Update PubSubService Configuration**

Your `PubSubService` has the topic name hardcoded instead of using environment variables:

**Current Issue in `src/integrations/google/services/pubsub.service.ts`:**
```typescript
// Line 32-33: HARDCODED TOPIC NAME
this.topicName = "gmail-triage";
// this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

**Fix Required:**
```typescript
this.topicName = this.configService.get<string>("GMAIL_PUBSUB_TOPIC") || "gmail-triage";
```

### **2. Webhook URL Path Correction**

**Current Script Configuration (WRONG):**
```bash
# scripts/email/setup-pubsub.sh line 19
WEBHOOK_ENDPOINT="https://your-domain.com/api/gmail/webhooks/push"
```

**Correct Configuration (FIXED):**
```bash
WEBHOOK_ENDPOINT="https://your-domain.com/api/webhook/google/mail/push"
```

### **3. Environment Variables for Deployment**

Based on your new configuration, here are the **EXACT environment variables** you need to update on your deployment server:

## 🌍 **Required Environment Variables for Deployment**

### **Core Google Cloud Configuration**
```bash
# Your Google Cloud Project
GOOGLE_CLOUD_PROJECT_ID=followthrough-ai

# Updated Topic and Subscriptions (your new names)
GMAIL_PUBSUB_TOPIC=gmail-triage
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription
```

### **Service Account Credentials**
```bash
# Option 1: JSON credentials (RECOMMENDED for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"followthrough-ai",...}

# Option 2: File path (for development)
GOOGLE_APPLICATION_CREDENTIALS=./config/gmail-push-service-account.json
```

### **Webhook Security (OPTIONAL)**
```bash
# Optional webhook token for additional security
GMAIL_WEBHOOK_SECRET=your-secure-webhook-secret-here

# Legacy token (if you want to use it)
GMAIL_WEBHOOK_TOKEN=your-webhook-token-here
```

### **Base URL Configuration**
```bash
# Your deployment domain
WEBHOOK_BASE_URL=https