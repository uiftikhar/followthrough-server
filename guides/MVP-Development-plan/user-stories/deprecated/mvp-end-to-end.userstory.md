# Refined User Stories with End-to-End User Flows

Below are detailed user stories for each MVP feature, documented as user-centered flows with Preconditions, Steps, and Acceptance Criteria.

---

## Feature 1: AI Meeting Intelligence & Action Items

### Story 1.1 — Meeting Detection & Transcript Capture  
**As a** team leader  
**I want** the assistant to detect when one of my calendar meetings starts and automatically capture audio/video  
**So that** I don’t have to remember to hit “record”  

**Precondition:**  
- User has linked Google Calendar (or Outlook) and Zoom/Teams/Meet account.  

**Flow:**  
1. **Given** a scheduled meeting in the user’s calendar  
2. **When** the meeting start time arrives  
3. **Then** the system calls the conferencing-tool API to join/record the meeting  
4. **And** streams the audio to the transcription engine  

**Acceptance Criteria:**  
- [ ] System joins/records every meeting listed in the user’s calendar  
- [ ] Transcription starts within 30 seconds of meeting start  
- [ ] Recording metadata (meeting title, participants, time) is stored  

---

### Story 1.2 — Action Item Extraction & Assignment  
**As a** project manager  
**I want** the AI to extract “to-dos” during the meeting and assign them to participants  
**So that** I have a ready-made task list without manual note-taking  

**Precondition:**  
- Transcript is available in the system.  
- Participants have known user IDs in the system.  

**Flow:**  
1. **Given** a completed transcript of the meeting  
2. **When** the SummaryAgent processes it  
3. **Then** relevant sentences like “Jane will draft the proposal by Friday” are identified  
4. **And** an ActionItem entity is created with owner = “Jane” and due = [date]  

**Acceptance Criteria:**  
- [ ] Action items accurately capture owner, description, and due date  
- [ ] Each item is visible in the user’s task tracker placeholder  
- [ ] User can confirm or reassign items before final creation  

---

### Story 1.3 — Post-Meeting Summary Delivery  
**As a** meeting participant  
**I want** to receive a concise summary and action-item list immediately after the meeting  
**So that** I can quickly see decisions and my responsibilities  

**Precondition:**  
- Meeting has ended and transcript processed.  

**Flow:**  
1. **Given** the meeting has concluded  
2. **When** the SummaryAgent finishes generating the summary  
3. **Then** the system sends a message (email/Slack) to all participants  
4. **And** includes:  
   - Key decisions  
   - Extracted action items with owners & due dates  

**Acceptance Criteria:**  
- [ ] Summary length ≤ 5 bullet points  
- [ ] Action items are formatted as checkboxes with links to the task tracker  
- [ ] Notification arrives within 2 minutes of meeting end  

---

## Feature 2: Intelligent Task Execution & Follow-Up

### Story 2.1 — Drafting & Reviewing Follow-Up Emails  
**As a** team member  
**I want** the AI to draft a follow-up email listing action items and next steps  
**So that** I can review and send it without composing from scratch  

**Precondition:**  
- Action items have been extracted.  
- User has granted “send email” permission.  

**Flow:**  
1. **Given** new action items exist for an attendee  
2. **When** the user opens the “Follow-Up” panel in the UI  
3. **Then** the system populates a draft email:  
   - To: meeting attendees  
   - Subject: “[Project] – Action Items & Next Steps”  
   - Body: summary + numbered tasks  
4. **And** user can edit or approve the draft  
5. **Finally**, on “Send”, the system uses Gmail/Outlook API to deliver the email  

**Acceptance Criteria:**  
- [ ] Draft includes all extracted items and decisions  
- [ ] User edits are persisted before send  
- [ ] Email is delivered and logged in “Sent Items”  

---

### Story 2.2 — Automatic Task Creation & Check-In Scheduling  
**As a** project manager  
**I want** the AI to create tasks in Jira/Asana and schedule a follow-up check-in  
**So that** I don’t have to manually enter tasks or calendar invites  

**Precondition:**  
- User has connected Jira/Asana and Calendar.  

**Flow:**  
1. **Given** confirmed action items after user review  
2. **When** user clicks “Create Tasks + Schedule Check-In”  
3. **Then** the system:  
   - Creates tickets in Jira/Asana with title, description, assignee, due date  
   - Adds a follow-up meeting to the calendar 1 week before the nearest due date  
4. **And** sends a confirmation notification  

**Acceptance Criteria:**  
- [ ] All action items appear as tasks in the chosen project board  
- [ ] Check-in event appears on organizer’s calendar with correct time  
- [ ] Notifications in Slack/Teams confirm creation  

---

## Feature 3: Email Triage Assistant

### Story 3.1 — Priority Inbox Overview  
**As a** busy professional  
**I want** my inbox automatically sorted by urgency and importance  
**So that** I can focus on high-priority messages first  

**Precondition:**  
- User has granted inbox read access.  

**Flow:**  
1. **Given** new emails arrive in Gmail/Outlook  
2. **When** the TriageAgent processes them  
3. **Then** each email is tagged: Urgent, High, Normal, Low  
4. **And** the UI displays a “Priority Inbox” folder with Urgent + High emails at top  

**Acceptance Criteria:**  
- [ ] Tags match defined priority algorithm (sender, keywords, deadlines)  
- [ ] UI refreshes within 30 seconds of new mail arrival  
- [ ] User can override tags manually  

---

### Story 3.2 — Automated Response Drafting  
**As a** manager  
**I want** the AI to suggest replies for routine inquiries  
**So that** I can send them with one click  

**Precondition:**  
- User has enabled “suggest replies.”  

**Flow:**  
1. **Given** an email classified as “routine”  
2. **When** the user clicks the email in the Priority Inbox  
3. **Then** the system displays a suggested response draft below the message  
4. **And** user can edit or accept it, then click “Send”  

**Acceptance Criteria:**  
- [ ] Draft covers key points from the incoming email  
- [ ] User edits are saved before send  
- [ ] Email thread updates correctly on send  

---

### Story 3.3 — Thread Summarization & Snooze  
**As a** team member  
**I want** long email threads summarized and snoozed  
**So that** I can catch up quickly and defer low-priority threads  

**Precondition:**  
- Thread length > 3 messages.  

**Flow:**  
1. **Given** a long conversation thread  
2. **When** the user selects “Summarize & Snooze”  
3. **Then** the TriageAgent produces a 3-bullet summary of the thread  
4. **And** the thread is hidden until a user-specified time  
5. **Finally**, summary is added to “Snoozed + Summarized” view  

**Acceptance Criteria:**  
- [ ] Summary accurately captures main points  
- [ ] Thread reappears at the correct snooze time  
- [ ] User can adjust snooze duration  

---

Each story captures the user’s journey through the system—from scheduling or receiving content, through AI processing, to final delivery or task creation—ensuring an intuitive, end-to-end experience aligned with PRD goals.
