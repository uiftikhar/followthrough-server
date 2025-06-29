# Refined User Stories & User Flows

Below are detailed personas and comprehensive user stories for the three MVP feature areas. Each story includes preconditions, step-by-step flows, and acceptance criteria.

---

## Personas

1. **Alex – Startup Founder**  
   – Wears many hats, numerous investor/team meetings, cares about speed and accountability.  
2. **Priya – Project Manager**  
   – Manages cross-functional deliverables, heavy on task trackers and status updates.  
3. **Eva – Operations Lead (Chief of Staff)**  
   – Oversees processes and compliance, focuses on follow-ups and reporting.  
4. **Sam – Consultant / Agency Lead**  
   – Juggles client calls, deliverables, and needs flawless follow-through for client confidence.  
5. **Jordan – Individual Contributor**  
   – Contributor to projects, wants clarity on “what I need to do” and fewer interruptions.

---

## 1. AI Meeting Intelligence & Action Items

### 1.1 Alex (Startup Founder)

#### Story MI-A1: Auto-Transcribe & Notify  
**As Alex**, I want every investor meeting automatically transcribed and key decisions surfaced in Slack,  
**So that** I can stay focused on the conversation and review later.  

- **Precondition:**  
  • Alex has linked Google Calendar & Zoom; invited the bot to his Slack channel.  
- **Flow:**  
  1. Bot detects “Investor Update” on Alex’s calendar.  
  2. At meeting start, bot joins Zoom, streams audio to transcript engine.  
  3. Mid-meeting, TopicExtractionAgent tags “Fundraise”, “Runway” topics.  
  4. After meeting end, bot posts in #founders Slack:  
     - 3-bullet summary  
     - List of key decisions.  
- **Acceptance Criteria:**  
  - [ ] Transcript available within 1 minute of meeting end.  
  - [ ] Slack message formatted with summary + highlights.  
  - [ ] Decision bullets exactly match meeting content (≥85% accuracy).

#### Story MI-A2: Action-Item Dashboard Link  
**As Alex**, I want a link to a web dashboard showing all meeting action items,  
**So that** I can quickly assign them to my team.  

- **Precondition:**  
  • Summary + items extracted.  
- **Flow:**  
  1. Bot sends email: “Your meeting summary & tasks are ready → [View Dashboard]”  
  2. Alex clicks link, sees ActionItemAgent list: “Hire CTO by May 30 (Owner: unassigned)”.  
  3. Alex clicks “Assign” dropdown, selects team member.  
- **Acceptance Criteria:**  
  - [ ] Dashboard loads in ≤2s, lists all tasks with “Assign” control.  
  - [ ] Assigning a task updates the owner in the system and notifies assignee via Slack.

---

### 1.2 Priya (Project Manager)

#### Story MI-P1: Collaborative Live Notes  
**As Priya**, I want live meeting notes to appear in Asana tasks,  
**So that** my team can comment or clarify in real time.  

- **Precondition:**  
  • Priya’s Asana is connected; recurring “Stand-up” meeting exists.  
- **Flow:**  
  1. At Stand-up start, bot streams transcription.  
  2. SentimentAnalysisAgent flags low morale comment.  
  3. ActionItemAgent extracts “John to update spec doc by EOD”.  
  4. Bot creates Asana task in “Sprint Backlog” with comment thread.  
- **Acceptance Criteria:**  
  - [ ] Asana task appears during meeting with transcript snippet.  
  - [ ] Team members can comment under the task thread instantly.

---

### 1.3 Eva (Operations Lead)

#### Story MI-E1: Compliance-Ready Minutes  
**As Eva**, I want meeting minutes with attendance and decisions stamped,  
**So that** we have audit-ready records for compliance.  

- **Precondition:**  
  • Eva’s Teams account connected; compliance mode ON.  
- **Flow:**  
  1. Bot records participants via Teams API.  
  2. SummaryAgent generates minutes including names/timestamps.  
  3. Bot saves PDF minutes to SharePoint; emails compliance team.  
- **Acceptance Criteria:**  
  - [ ] PDF contains header: date, attendees, duration.  
  - [ ] All decision statements numbered and timestamped.  
  - [ ] File accessible in SharePoint “Meeting Minutes” folder.

---

### 1.4 Sam (Consultant)

#### Story MI-S1: Client-Ready Summary Email  
**As Sam**, I want the AI to draft a client-facing summary email,  
**So that** I maintain professionalism and speed.  

- **Precondition:**  
  • Sam granted “send-as” permission for client domain.  
- **Flow:**  
  1. After client call ends, bot runs SummaryAgent.  
  2. Bot drafts email “To: client@corp.com” with:  
     - Thank-you opening  
     - 3 key outcomes  
     - Next steps.  
  3. Bot saves draft in Sam’s Gmail.  
- **Acceptance Criteria:**  
  - [ ] Draft appears in Sent Items as “Draft” within 2 minutes.  
  - [ ] Tone is polite and professional (per prompt guidelines).

---

### 1.5 Jordan (Individual Contributor)

#### Story MI-J1: Personal Action-Item Reminder  
**As Jordan**, I want my personal to-dos from team meetings to populate my Slack DMs,  
**So that** I don’t miss tasks buried in long summaries.  

- **Precondition:**  
  • Jordan’s Slack DM integration enabled.  
- **Flow:**  
  1. ActionItemAgent identifies “Jordan: prepare budget slide by Wed”.  
  2. Bot DMs Jordan: “You have 1 new task: prepare budget slide by Wed [Mark Done | Snooze]”.  
- **Acceptance Criteria:**  
  - [ ] DM arrives within 1 minute post-meeting.  
  - [ ] Buttons work: “Mark Done” archives the task, “Snooze” lets Jordan pick a time.

---

## 2. Intelligent Task Execution & Follow-Up

### 2.1 Alex (Startup Founder)

#### Story TE-A1: Auto-Schedule Investor Follow-up  
**As Alex**, when someone says “let’s reconvene next Thursday,” I want the AI to schedule it automatically,  
**So that** I avoid back-and-forth emails.  

- **Precondition:**  
  • Calendar + email connected; permission granted for internal scheduling.  
- **Flow:**  
  1. During meeting, scheduler agent hears “next Thursday”.  
  2. After meeting, agent queries calendars for all attendees.  
  3. Bot creates Zoom invite for next Thursday at 2 PM, sends to all.  
- **Acceptance Criteria:**  
  - [ ] Invite appears on Alex’s and attendees’ calendars.  
  - [ ] Confirmation email sent to all participants.

---

### 2.2 Priya (Project Manager)

#### Story TE-P1: Jira Ticket Creation & Status Check-In  
**As Priya**, I want action items to become Jira tickets and a reminder scheduled if stale,  
**So that** nothing slips through.  

- **Precondition:**  
  • Jira connected; team project “Alpha” exists.  
- **Flow:**  
  1. Post-meeting, agent creates tickets for each item in project “Alpha”.  
  2. Two days before due date, reminder agent posts in #project-alpha Slack: “Ticket ABC-123 is due tomorrow.”  
- **Acceptance Criteria:**  
  - [ ] Tickets created with correct assignees and due dates.  
  - [ ] Slack reminder triggers at the correct time with ticket link.

---

### 2.3 Eva (Operations Lead)

#### Story TE-E1: Automated Weekly Report Draft  
**As Eva**, every Friday the AI should draft our weekly summary report,  
**So that** I can send it to the exec team with minimal edits.  

- **Precondition:**  
  • Weekly report pattern detected; permission for auto-draft enabled.  
- **Flow:**  
  1. On Friday 4 PM, the recurring-task agent triggers.  
  2. Bot gathers: meeting summaries, completed tasks, upcoming deadlines.  
  3. Drafts email “Weekly Operations Summary” and saves to drafts.  
- **Acceptance Criteria:**  
  - [ ] Draft generated by 4 PM Friday with correct data.  
  - [ ] Draft link appears in Eva’s dashboard for quick review.

---

### 2.4 Sam (Consultant)

#### Story TE-S1: Client Task Follow-Up Sequence  
**As Sam**, after a client meeting, I want the AI to:  
  1. Create Asana tasks for deliverables  
  2. Send interim reminder to client contact  
  3. Notify me if client hasn’t responded in 3 days  
**So that** I can manage deliverables without manual overhead.  

- **Precondition:**  
  • Asana connected; client email on file; three-day follow-up rule configured.  
- **Flow:**  
  1. Post-meeting, create Asana tasks under “Client X > Deliverables.”  
  2. Bot sends email: “Hi [Client], here are next steps…”  
  3. After 3 days, if no reply, bot DMs Sam: “No response from client on proposal—remind?”  
- **Acceptance Criteria:**  
  - [ ] Asana tasks created with correct details.  
  - [ ] Initial email sent automatically.  
  - [ ] Reminder prompt appears exactly 72 hours later if no reply thread detected.

---

### 2.5 Jordan (Individual Contributor)

#### Story TE-J1: One-Click Task Completion  
**As Jordan**, when I complete a task in Trello, I want the AI to stop reminding me and update my dashboard,  
**So that** I see an accurate view of outstanding work.  

- **Precondition:**  
  • Trello board connected; reminders enabled.  
- **Flow:**  
  1. Jordan drags card to “Done.”  
  2. Trello webhook notifies agent.  
  3. Agent marks task “completed” in FollowThrough dashboard and stops reminders.  
- **Acceptance Criteria:**  
  - [ ] Reminder for that task is cancelled immediately.  
  - [ ] Dashboard shows the task as completed with timestamp.

---

## 3. Email Triage Assistant

### 3.1 Alex (Startup Founder)

#### Story ET-A1: Morning Priority Digest  
**As Alex**, I want a daily email each morning listing my top 5 urgent emails,  
**So that** I start my day on what matters most.  

- **Precondition:**  
  • Email read access granted; “urgent” keywords configured.  
- **Flow:**  
  1. At 8 AM, TriageAgent scans inbox.  
  2. Tags top 5 as Urgent based on sender, keywords, deadlines.  
  3. Sends “Morning Digest” email with subject “Top 5 Urgent Emails Today” and links.  
- **Acceptance Criteria:**  
  - [ ] Digest arrives by 8:05 AM.  
  - [ ] Links open the correct email in Gmail web UI.

---

### 3.2 Priya (Project Manager)

#### Story ET-P1: Thread Summaries on Demand  
**As Priya**, when I type `/ft summarize thread` in Slack, I want a 3-bullet summary of the referenced email thread,  
**So that** I can catch up quickly without switching apps.  

- **Precondition:**  
  • Slack bot installed; user authenticated for email.  
- **Flow:**  
  1. Priya pastes thread link in Slack and runs `/ft summarize thread`.  
  2. TriageAgent fetches thread via Gmail API.  
  3. Returns 3 bullets in thread reply.  
- **Acceptance Criteria:**  
  - [ ] Summary accurate (captures sender intent, decisions, next steps).  
  - [ ] Response appears in Slack thread within 20 s.

---

### 3.3 Eva (Operations Lead)

#### Story ET-E1: Auto-Respond to Routine Requests  
**As Eva**, I want routine inquiries (“What’s the PTO policy?”) to be auto-drafted or auto-answered,  
**So that** I reduce repetitive email load.  

- **Precondition:**  
  • FAQ list uploaded; auto-respond mode enabled for matching subjects.  
- **Flow:**  
  1. Incoming email with subject “PTO policy” arrives.  
  2. TriageAgent matches to FAQ “Paid Time Off Policy.”  
  3. Bot sends the canned response immediately or drafts for Eva’s approval.  
- **Acceptance Criteria:**  
  - [ ] Correct FAQ answer is sent within 1 min.  
  - [ ] Eva can review/edit if “approval required” mode is on.

---

### 3.4 Sam (Consultant)

#### Story ET-S1: Snooze & Follow-Up Prompt  
**As Sam**, I want to snooze low-priority client emails and get a follow-up prompt later,  
**So that** I handle them when I have more time.  

- **Precondition:**  
  • Sam marks an email as “low” priority.  
- **Flow:**  
  1. In Slack DM, Sam clicks “snooze 3 days” on an email notification.  
  2. Email is archived and unsent.  
  3. After 3 days, bot re-notifies Sam in Slack: “Snoozed email from [Client] is back in your inbox.”  
- **Acceptance Criteria:**  
  - [ ] Email returns to inbox unread after the snooze period.  
  - [ ] Slack reminder triggers reliably at the configured time.

---

### 3.5 Jordan (Individual Contributor)

#### Story ET-J1: One-Click Draft Send  
**As Jordan**, I want to click “Send Suggested Reply” next to an email in my dashboard,  
**So that** routine replies go out instantly.  

- **Precondition:**  
  • Suggested reply drafted; user authorized.  
- **Flow:**  
  1. Dashboard shows list of “Suggested Replies.”  
  2. Jordan clicks “Send” on one item.  
  3. Bot sends reply via Gmail and logs in dashboard.  
- **Acceptance Criteria:**  
  - [ ] Email is sent immediately and visible in Sent folder.  
  - [ ] Dashboard updates that the reply is “Sent” with timestamp.

# Additional Personas & Dashboard-Driven User Stories

Below are new personas focused on monitoring, analytics, and dashboard workflows for the three core feature areas. Each story includes preconditions, flow steps, and acceptance criteria.

---

## Personas

- **Charlie – Customer Success Manager (CSM)**  
  Tracks adoption and ROI for multiple client teams; ensures clients hit follow-up SLAs and usage targets.  

- **Taylor – Product Owner (Dev Team)**  
  Monitors system performance, feature adoption, and quality metrics to drive roadmap decisions.  

- **Riley – Data Analyst**  
  Analyzes usage data and impact metrics (time saved, tasks completed) to produce reports for leadership.  

- **Casey – IT Administrator**  
  Oversees system health, error rates, integration statuses, and security/compliance dashboards.

---

## 1. AI Meeting Intelligence & Action Items — Monitoring & Analytics

### Story MI-D1: CSM Adoption Dashboard (Charlie)  
**As Charlie**, I want a client-facing dashboard showing each team’s meeting processing rate and action item completion percentage,  
**So that** I can report on SLA adherence and propose success plans.

- **Precondition:**  
  • Charlie has “CSM” role with read-only dashboard access.  
- **Flow:**  
  1. Charlie logs into the FollowThrough portal.  
  2. Navigates to **Client Analytics → Meeting Intelligence**.  
  3. Sees a table: each team, # meetings processed last 30 days, % action items confirmed, average summary latency.  
  4. Filters to teams below 80% action-item completion.  
  5. Exports CSV for upcoming account review.  
- **Acceptance Criteria:**  
  - [ ] Dashboard loads within 3s and displays all client teams.  
  - [ ] Exported CSV matches on-screen data.  
  - [ ] Teams below thresholds are highlighted in red.

### Story MI-D2: Performance Monitoring (Taylor)  
**As Taylor**, I want an internal dashboard showing transcription latency and agent error rates,  
**So that** I can prioritize reliability improvements.

- **Precondition:**  
  • Taylor has “Product Owner” access; telemetry is enabled.  
- **Flow:**  
  1. Taylor opens **Dev Ops → Meeting Pipeline Metrics**.  
  2. Sees time-series chart of “Time to first transcript token” and “% meetings with agent errors.”  
  3. Clicks into any error spike to view logs (e.g. RAG retrieval failures).  
  4. Creates a Jira ticket from the dashboard for the top error type.  
- **Acceptance Criteria:**  
  - [ ] Charts display data granularity down to 15-minute intervals.  
  - [ ] Error log drill-downs link directly to log entries.  
  - [ ] Jira ticket contains error summary and link.

### Story MI-D3: Usage Trend Report (Riley)  
**As Riley**, I want to schedule a weekly report of meeting analysis usage and quality scores,  
**So that** stakeholders see impact over time.

- **Precondition:**  
  • Riley has “Analyst” role and can schedule reports.  
- **Flow:**  
  1. Riley navigates to **Analytics → Scheduled Reports**.  
  2. Clicks “New Report,” selects “Meeting Intelligence KPIs.”  
  3. Configures cadence: every Monday 7 AM, recipients: leadership@company.com.  
  4. Saves; report is emailed weekly with charts of # meetings, avg. summary rating, action-item accuracy.  
- **Acceptance Criteria:**  
  - [ ] Report arrives on schedule with correct metrics.  
  - [ ] Recipients see embedded PNG charts and CSV attachment.

---

## 2. Intelligent Task Execution & Follow-Up — Monitoring & Analytics

### Story TE-D1: Follow-Up SLA Tracker (Charlie)  
**As Charlie**, I want to see each client’s SLA compliance for follow-ups (e.g., % of tasks auto-scheduled within 1 hr),  
**So that** I can coach clients lagging behind.

- **Precondition:**  
  • SLA defined: tasks scheduled within 60 min of extraction.  
- **Flow:**  
  1. Charlie selects **Client Analytics → Follow-Up SLA**.  
  2. Views gauge showing current SLA compliance (e.g., 72%).  
  3. Clicks “View Details” to see per-client breakdown.  
  4. Identifies Client X at 55%; clicks “Notify” to send automated best-practice tips.  
- **Acceptance Criteria:**  
  - [ ] SLA gauge updates in real time.  
  - [ ] “Notify” action sends an email with templated tips.

### Story TE-D2: Autonomous Execution Metrics (Taylor)  
**As Taylor**, I want to track % of follow-up emails drafted vs. sent autonomously vs. manually sent,  
**So that** I can measure progressive autonomy adoption.

- **Precondition:**  
  • All email actions are instrumented with “mode” tags.  
- **Flow:**  
  1. Taylor opens **Dev Ops → Autonomy Metrics**.  
  2. Sees stacked bar chart: drafted-only, user-approved, auto-sent.  
  3. Filters to last 14 days; notes auto-send climbed from 5%→18%.  
- **Acceptance Criteria:**  
  - [ ] Chart accurately reflects modes.  
  - [ ] Filters respond within 2s.

### Story TE-D3: Time-Saved Dashboard (Riley)  
**As Riley**, I want a dashboard showing estimated hours saved per user by automated task creation and reminders,  
**So that** I can quantify ROI.

- **Precondition:**  
  • System logs time delta between manual vs. automated actions.  
- **Flow:**  
  1. Riley goes to **Analytics → Time Saved**.  
  2. Selects date range and user segment (e.g., “Engineering Managers”).  
  3. Sees table: User, # tasks auto-created, estimated hours saved (based on average task time).  
  4. Downloads PDF summary for leadership.  
- **Acceptance Criteria:**  
  - [ ] Hours-saved calculation matches formula: tasks×avg_task_time.  
  - [ ] PDF includes charts and the data table.

---

## 3. Email Triage Assistant — Monitoring & Analytics

### Story ET-D1: Inbox Load Heatmap (Charlie)  
**As Charlie**, I want a client view of average daily email volume and triage classification distribution,  
**So that** I can highlight overload issues and recommend improvements.

- **Precondition:**  
  • Email triage data collected for each user.  
- **Flow:**  
  1. Charlie opens **Client Analytics → Email Triage Load**.  
  2. Sees heatmap: days vs. users vs. volume.  
  3. Clicks a high-load day to see breakdown by priority tags (Urgent, High, Normal, Low).  
- **Acceptance Criteria:**  
  - [ ] Heatmap correctly visualizes volume per user per day.  
  - [ ] Drill-down shows correct priority distribution.

### Story ET-D2: Auto-Response Quality Monitoring (Taylor)  
**As Taylor**, I want to see edit-rate for auto-drafted replies (i.e., % of draft text the user changed),  
**So that** I can tune our LLM prompts for higher accuracy.

- **Precondition:**  
  • System logs diff between draft vs. sent content.  
- **Flow:**  
  1. Taylor navigates to **Dev Ops → Email Draft Quality**.  
  2. Views average edit % per prompt template.  
  3. Identifies “PTO Policy” template has 40% edits; flags for prompt refinement.  
- **Acceptance Criteria:**  
  - [ ] Edit percentages calculated accurately.  
  - [ ] Ability to filter by template and time range.

### Story ET-D3: Snooze & Follow-Up Effectiveness (Riley)  
**As Riley**, I want to measure how often snoozed emails are acted upon after reminder,  
**So that** I can validate that snooze improves completion rates.

- **Precondition:**  
  • Snooze events and subsequent user actions are tracked.  
- **Flow:**  
  1. Riley goes to **Analytics → Snooze Outcomes**.  
  2. Sees funnel: Snoozed→Reopened→Replied.  
  3. Notes 70% of snoozed emails are replied within 24 hrs.  
- **Acceptance Criteria:**  
  - [ ] Funnel percentages match tracked events.  
  - [ ] Time buckets (<1 hr, 1–24 hrs, >24 hrs) are available.

### Story ET-D4: System Health & Latency (Casey)  
**As Casey**, I want an IT dashboard showing API error rates (Gmail, Slack), triage agent latency,  
**So that** I can ensure uptime and SLA compliance.

- **Precondition:**  
  • Telemetry for all external calls and agent processing times enabled.  
- **Flow:**  
  1. Casey logs into **Admin → System Health**.  
  2. Monitors real-time counters: Gmail API 5xx errors, Slack webhook failures, average triage latency.  
  3. Sets an alert if Gmail errors exceed 1% or latency >1s.  
- **Acceptance Criteria:**  
  - [ ] Metrics refresh in real time (≤10s).  
  - [ ] Alerts trigger correctly based on thresholds.
# Additional Personas & Dashboard-Driven User Stories

Below we introduce new **client-customer** and **internal team** personas focused on **monitoring**, **analytics**, and **follow-up**, and map them to the three core feature areas.

---

## New Personas

- **Carla – COO (Client Customer)**  
  Oversees operational performance and wants high-level KPIs on meeting follow-through and task completion.

- **Oliver – Customer Success Manager (Internal)**  
  Supports client accounts; needs per-client health dashboards and alerting to proactively intervene.

- **Priya – Product Manager (Internal)**  
  Tracks feature adoption, usage patterns, and user feedback to guide roadmap priorities.

- **Raj – DevOps Engineer (Internal)**  
  Monitors system performance, agent throughput, and error rates to ensure reliability.

- **Chloe – QA Lead (Internal)**  
  Monitors AI output quality metrics (accuracy, edit rates, CSAT) to drive model improvements.

---

## 1. AI Meeting Intelligence & Action Items — Monitoring & Analytics

### MI-AN1: Executive Summary Dashboard (Carla, COO)
**As Carla**, I want an executive dashboard showing  
- number of meetings processed  
- % with on-time summaries  
- total action items extracted  
- on-time completion rate  
**So that** I can gauge the health of our team’s follow-through.

- **Precondition:**  
  • Carla has dashboard access.  
- **Flow:**  
  1. Carla navigates to “Executive Insights” tab.  
  2. Sees widgets:  
     - Meetings/hour, Summaries delivered (SLA compliance), Extraction count  
     - Chart of “Action items created vs completed on time”  
  3. Clicks “Drill-down” on any widget to view team- or project-level detail.  
- **Acceptance Criteria:**  
  - [ ] Data refreshes hourly.  
  - [ ] Drill-down shows per-project breakdown in <2s.  
  - [ ] KPIs reflect real usage (e.g., if 50 meetings processed, summary SLA ≥90%).

### MI-AN2: Client Health Alerts (Oliver, CSM)
**As Oliver**, I want to receive alerts when a client’s meeting backlog or error rate exceeds thresholds,  
**So that** I can proactively reach out.

- **Precondition:**  
  • Alert rules configured (e.g., “>10 unprocessed meetings”, “>5% extraction errors”).  
- **Flow:**  
  1. System detects client “Acme Corp” has 12 unprocessed meetings older than 2 hours.  
  2. Triggers alert:  
     - Email to Oliver: “Acme backlog: 12 meetings”  
     - Slack DM from CSM-bot: “Client Acme needs support: backlog high”  
- **Acceptance Criteria:**  
  - [ ] Alerts arrive within 5 minutes of threshold breach.  
  - [ ] Alert contains direct link to client’s Meeting Queue page.

### MI-AN3: Feature Usage Trends (Priya, Product Manager)
**As Priya**, I want analytics on how often users view summaries vs raw transcripts, and summary edit rates,  
**So that** I can prioritize improvements.

- **Precondition:**  
  • Instrumentation of summary vs transcript views and edit events.  
- **Flow:**  
  1. Priya opens “Usage Analytics” dashboard.  
  2. Selects “Meeting Intelligence” feature.  
  3. Views metrics:  
     - Summary views / transcript views ratio  
     - % of summaries edited by users  
     - Average summary length over time  
- **Acceptance Criteria:**  
  - [ ] Charts display past 30 days of data.  
  - [ ] Edit-rate trend shows weekly granularity.  
  - [ ] Priya can export CSV of raw metrics.

### MI-AN4: System Performance Monitoring (Raj, DevOps Engineer)
**As Raj**, I want real-time metrics on agent latency, queue depth, and error rates,  
**So that** I can ensure the system meets SLAs and scale resources.

- **Precondition:**  
  • Prometheus/Grafana integration is in place.  
- **Flow:**  
  1. Raj views “Agent Performance” dashboard in Grafana.  
  2. Monitors panels:  
     - Transcript→summary latency distribution  
     - Active agent count and message queue depth  
     - Error rate (%) per agent type  
  3. If error rate >2% for 5 minutes, an alert fires to #devops Slack.  
- **Acceptance Criteria:**  
  - [ ] Metrics update in real time (≤10s lag).  
  - [ ] Alerts configured and tested successfully.

### MI-AN5: Output Quality Metrics (Chloe, QA Lead)
**As Chloe**, I want to see summary CSAT scores and average user-correction length,  
**So that** I can identify areas for model retraining.

- **Precondition:**  
  • Users can rate summaries (1–5) and correct them in UI.  
- **Flow:**  
  1. Chloe opens “Quality Dashboard.”  
  2. Reviews:  
     - Average CSAT per week  
     - Distribution of summary lengths before/after edits  
     - Top 5 most-edited summary sections  
  3. Flags “Action Item extraction” for retraining if edit rate >15%.  
- **Acceptance Criteria:**  
  - [ ] Dashboard shows last 4 weeks.  
  - [ ] Chloe can click into specific meeting examples.

---

## 2. Intelligent Task Execution & Follow-Up — Monitoring & Analytics

### TE-AN1: Task Completion Overview (Carla, COO)
**As Carla**, I want a dashboard that tracks  
- total tasks created  
- % completed on time  
- tasks overdue by >3 days  
**So that** I can see where follow-through is slipping.

- **Precondition:**  
  • Task-tracking data aggregated.  
- **Flow:**  
  1. Carla visits “Task Insights.”  
  2. Sees:  
     - KPI cards: Created, Completed On Time, Overdue  
     - Time-series trend of completion rate  
     - List of top 10 overdue tasks across teams  
- **Acceptance Criteria:**  
  - [ ] Overdue list includes task name, owner, due date, days overdue.  
  - [ ] Metrics match underlying task database counts.

### TE-AN2: Client Usage Health (Oliver, CSM)
**As Oliver**, I want to monitor each client’s AI-executed tasks vs manual tasks,  
**So that** I can demonstrate ROI and identify adoption gaps.

- **Precondition:**  
  • Classification of “AI-executed” vs “user-executed” tasks.  
- **Flow:**  
  1. Oliver selects client account “Beta Inc.”  
  2. Sees pie chart: 40% AI-executed, 60% manual.  
  3. Filters by time period to show trend.  
- **Acceptance Criteria:**  
  - [ ] Chart updates on filter change.  
  - [ ] Data exportable for reporting.

### TE-AN3: Autonomy Adoption Metrics (Priya, Product Manager)
**As Priya**, I want to see how many users have opted into “auto-schedule” or “auto-send” settings and how often they’re used,  
**So that** I can measure trust growth.

- **Precondition:**  
  • Settings usage metrics logged.  
- **Flow:**  
  1. Priya opens “Autonomy Dashboard.”  
  2. Reviews:  
     - % of users enabling each autonomy toggle  
     - Count of auto-scheduled meetings per week  
     - Auto-sent emails vs manually sent after suggestion  
- **Acceptance Criteria:**  
  - [ ] Toggles adoption displayed per user cohort (e.g., by join month).  
  - [ ] Usage trend chart over last 3 months.

### TE-AN4: Execution Failure Alerts (Raj, DevOps Engineer)
**As Raj**, I want to be alerted when task creation or scheduling API calls fail >1% of attempts,  
**So that** I can investigate integration issues.

- **Precondition:**  
  • Integration calls instrumented with success/fail metrics.  
- **Flow:**  
  1. System tracks API success rate.  
  2. If failure rate >1% over 15 min window, alert fires.  
  3. Raj receives PagerDuty notification.  
- **Acceptance Criteria:**  
  - [ ] Alert triggers correctly in test scenario.  
  - [ ] Dashboard shows error breakdown by integration type.

### TE-AN5: Follow-Up Quality Feedback (Chloe, QA Lead)
**As Chloe**, I want users to rate AI-drafted emails and task drafts,  
**So that** I can monitor quality and tune prompts.

- **Precondition:**  
  • In-app rating UI for drafts.  
- **Flow:**  
  1. Chloe views “Draft Quality” dashboard.  
  2. Sees:  
     - Average rating per draft type (email, calendar invite)  
     - % of drafts edited before send  
     - Free-text feedback snippets  
  3. Exports low-rated examples for review.  
- **Acceptance Criteria:**  
  - [ ] Rating distribution and edit percentages displayed.  
  - [ ] Export includes draft text and user comments.

---

## 3. Email Triage Assistant — Monitoring & Analytics

### ET-AN1: Inbox Triage Metrics (Carla, COO)
**As Carla**, I want to see how many emails per day are tagged Urgent/High vs Low/Normal,  
**So that** I understand my team’s email load distribution.

- **Precondition:**  
  • TriageAgent tag counts logged.  
- **Flow:**  
  1. Carla opens “Email Insights.”  
  2. Views bar chart: daily counts by priority tag.  
  3. Clicks “High” bar to list sample emails.  
- **Acceptance Criteria:**  
  - [ ] Chart shows past 14 days.  
  - [ ] Drill-in list shows subject, sender, received time.

### ET-AN2: Client Triage Adoption (Oliver, CSM)
**As Oliver**, I want to monitor % of users engaging with “Suggested Replies” and “Snooze” features,  
**So that** I can coach low-adoption clients.

- **Precondition:**  
  • Interaction events tracked.  
- **Flow:**  
  1. Oliver selects client “Gamma LLC.”  
  2. Views KPI:  
     - Suggested replies clicked / suggested replies shown  
     - Snoozed threads count  
  3. Identifies client users with <10% engagement.  
- **Acceptance Criteria:**  
  - [ ] Engagement metrics correct per client.  
  - [ ] Able to export list of low-engagement users.

### ET-AN3: Response Time Analytics (Priya, Product Manager)
**As Priya**, I want average and median time from email arrival to reply (AI-draft or user),  
**So that** I can measure time savings.

- **Precondition:**  
  • Timestamps of arrival and reply stored.  
- **Flow:**  
  1. Priya opens “Response Time” dashboard.  
  2. Sees:  
     - Avg/median reply time for AI-drafted messages  
     - Avg/median reply time for manual replies  
  3. Breaks down by queue (urgent vs normal).  
- **Acceptance Criteria:**  
  - [ ] Metrics computed correctly.  
  - [ ] Breakdowns filterable by priority.

### ET-AN4: Classification Accuracy Monitoring (Chloe, QA Lead)
**As Chloe**, I want to see the precision/recall of email priority classification,  
**So that** I can tune the ML models.

- **Precondition:**  
  • Ground-truth labels collected via user overrides.  
- **Flow:**  
  1. Chloe opens “Classification Metrics.”  
  2. Reviews confusion matrix and precision/recall for each tag.  
  3. Identifies tags needing improvement.  
- **Acceptance Criteria:**  
  - [ ] Confusion matrix correct.  
  - [ ] Precision/recall displayed per class.

### ET-AN5: System Health & Queue Monitoring (Raj, DevOps Engineer)
**As Raj**, I want to monitor the email-processing queue length and failure rates,  
**So that** I know if the triage pipeline is backlogged.

- **Precondition:**  
  • Email triage pipeline metrics instrumented.  
- **Flow:**  
  1. Raj views “Email Pipeline Health” dashboard.  
  2. Monitors:  
     - Queue length over time  
     - Processing latency per email  
     - Error count/rate  
  3. Configures alert if queue >500 or error rate >0.5%.  
- **Acceptance Criteria:**  
  - [ ] Metrics dashboards show real-time data.  
  - [ ] Alerts fire under threshold breach.

