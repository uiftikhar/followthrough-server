## 1. Email Triage Pipeline

### 1.1 Integration Layer

* **Zapier (or other iPaaS)**

  * **Pros:** Zero-code, built-in Gmail/Outlook connectors, super fast to prototype
  * **Cons:** Extra latency, harder to debug at scale, per-task fees
  * **Zapier Triggers:**

    * `New Email` (every incoming message)
    * `New Email Matching Search` (pre-filter by sender/subject/keywords)

---

### 1.2 Trigger

* **Event:** `New Email Received`
* **Payload:**

  ```json
  {
    "headers": { ... },
    "body": "...",
    "attachments": [ ... ],
    "metadata": {
      "timestamp": "...",
      "mailbox": "...",
      "labels": [ ... ]
    }
  }
  ```
* **Zapier setup:**

  1. Point your “New Email” (or “Matching Search”) trigger at support@…
  2. Add an action: **Webhooks → POST** to

     ```
     https://your-app.com/webhook/email
     ```

---

### 1.3 Agent Workflow

1. **Supervisor Agent**

   * Receives the raw webhook
   * Routes to the **Email Triage Manager** based on `event.type`

2. **Email Triage Manager**

   * Fans out into parallel workers:

     * **Classification Worker**
     * **Summarization Worker**
     * **Reply-Draft Worker**

3. **Workers**

   * **Classification Worker**

     * Uses keywords, sender priority, or ML model
     * Tags email as **Urgent**, **Normal**, or **Low**
   * **Summarization Worker**

     * Calls your “meeting-analysis” pipeline in “email mode”
     <!-- TODO: Generate specialized prompt for email triage worker -->
     * Prompt: *“Summarize this support email: problem, context, ask.”*
   * **Reply-Draft Worker**

     * Generates a reply skeleton:

       > “Hi {{sender\_name}},
       > Thanks for reaching out …”

4. **Dashboard Updates**

   * Triage Manager writes

     ```yaml
     - message_id: 1234
       priority: Urgent
       summary: "…"
       draft_reply: "…"
     ```
   * Notifies front-end (via WebSocket or polling) to re-sort the inbox

---

### 1.4 User Actions & Agent Responses

| User Action           | API Call / Agent Task                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| **Send / Edit Reply** | `POST /api/email/send` → **Email Send Worker** calls Gmail/Graph API with final body                   |
| **Snooze**            | Front-end “Snooze until …” → update `snooze_at` in DB → Supervisor schedules a re-trigger at that time |
| **Delegate**          | “Delegate to Teammate” → Supervisor spawns **Delegation Worker** that:                                 |

1. Emails summary + excerpt to teammate
2. Logs delegation action back to dashboard |

---
