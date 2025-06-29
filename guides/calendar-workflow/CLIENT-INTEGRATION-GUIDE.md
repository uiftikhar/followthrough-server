# Calendar Workflow Client Integration Guide

## 🎯 **Overview**

This guide provides everything needed to integrate with the FollowThrough AI Calendar Workflow server. The system supports **Google Calendar integration**, **automatic meeting briefs**, and **intelligent event detection** with both manual and automated triggers.

---

## 🔐 **Authentication Flow**

### **1. Google OAuth Setup**

#### **Initiate OAuth Flow**
```typescript
// Client-side: Redirect user to OAuth
GET /oauth/google/authorize?scope=calendar

// Response: Redirect URL
{
  "authUrl": "https://accounts.google.com/oauth/authorize?client_id=...",
  "state": "random-state-string"
}
```

#### **Handle OAuth Callback**
```typescript
// After user grants permission, Google redirects to:
GET /oauth/google/callback?code=auth_code&state=state_string

// Server processes and returns JWT
{
  "access_token": "jwt_token_here",
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "calendar_connected": true
}
```

#### **Use JWT for API Calls**
```typescript
// Include JWT in all requests
headers: {
  "Authorization": "Bearer jwt_token_here",
  "Content-Type": "application/json"
}
```

---

## 📅 **Core Calendar Operations**

### **1. Calendar Sync Management**

#### **Trigger Calendar Sync**
```typescript
POST /calendar/sync
Authorization: Bearer jwt_token

// Request Body
{
  "type": "calendar_sync",
  "metadata": {
    "force_refresh": false,
    "hours_ahead": 168  // 7 days
  }
}

// Response
{
  "sessionId": "uuid-session-id",
  "status": "pending",
  "message": "Calendar sync initiated"
}

// Alternative: Check sync results
GET /calendar/sync/status
// Response
{
  "status": "completed" | "pending" | "failed",
  "lastSyncTime": "2024-01-15T10:00:00Z",
  "eventsCount": 25,
  "errors": []
}
```

#### **Calendar Sync Response DTO**
```typescript
interface CalendarSyncResponse {
  sessionId: string;
  status: 'pending' | 'completed' | 'failed';
  message: string;
  lastSyncTime?: string;
  eventsCount?: number;
  errors?: string[];
}

interface CalendarSyncStatus {
  status: 'completed' | 'pending' | 'failed';
  lastSyncTime: string;
  eventsCount: number;
  nextSyncTime?: string;
  errors: string[];
}
```

### **2. Event Retrieval**

#### **Get Upcoming Events**
```typescript
GET /calendar/events/upcoming
Authorization: Bearer jwt_token

// Response
{
  "events": [
    {
      "id": "event_123",
      "title": "Team Standup",
      "description": "Daily team synchronization meeting",
      "startTime": "2024-01-15T09:00:00Z",
      "endTime": "2024-01-15T09:30:00Z",
      "location": "Conference Room A",
      "attendees": [
        {
          "email": "alice@company.com",
          "name": "Alice Smith",
          "responseStatus": "accepted"
        }
      ],
      "organizer": {
        "email": "organizer@company.com",
        "name": "Meeting Organizer"
      },
      "meetingLink": "https://meet.google.com/abc-defg-hij",
      "provider": "google",
      "status": "confirmed",
      "analysisStatus": "pending",
      "created": "2024-01-14T15:30:00Z",
      "updated": "2024-01-14T16:45:00Z"
    }
  ],
  "total": 5,
  "hasMore": false
}
```

#### **Get Events Happening Soon**
```typescript
GET /calendar/events/soon
Authorization: Bearer jwt_token

// Response: Same format as upcoming, filtered for events starting within 2 hours
```

#### **Get Next Event**
```typescript
GET /calendar/events/next
Authorization: Bearer jwt_token

// Response
{
  "event": {
    // Single CalendarEvent object or null
  },
  "timeUntilStart": "25 minutes",
  "minutesUntilStart": 25
}
```

#### **Calendar Event DTO**
```typescript
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO 8601 format
  endTime: string;
  location?: string;
  attendees: CalendarAttendee[];
  organizer: CalendarAttendee;
  meetingLink?: string;
  provider: 'google' | 'outlook' | 'apple';
  status: 'confirmed' | 'tentative' | 'cancelled';
  analysisStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  created: string;
  updated: string;
}

interface CalendarAttendee {
  email: string;
  name: string;
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction';
}
```

---

## 📋 **Meeting Brief Operations**

### **1. Request Meeting Brief**

#### **Generate Meeting Brief**
```typescript
POST /calendar/brief/:eventId
Authorization: Bearer jwt_token

// Response
{
  "sessionId": "uuid-session-id",
  "status": "pending",
  "message": "Meeting brief generation initiated"
}

// Poll for results or use WebSocket
GET /calendar/brief/:eventId/status

// Brief Ready Response
{
  "status": "completed",
  "brief": {
    "meetingDetails": {
      "title": "Product Planning Meeting",
      "date": "2024-01-15T15:00:00Z",
      "duration": 60,
      "location": "Conference Room B"
    },
    "objective": "Discuss Q2 product roadmap and feature prioritization",
    "participants": [
      {
        "email": "alice@company.com",
        "name": "Alice Smith",
        "role": "Product Manager",
        "lastMetWith": "2024-01-10T10:00:00Z",
        "sharedHistory": "Discussed user feedback in last 2 meetings"
      }
    ],
    "backgroundContext": {
      "briefSummary": "This continues planning for Q2 features. Previous meeting established user priorities.",
      "relevantDecisions": [
        {
          "decision": "Focus on mobile app improvements",
          "dateMade": "2024-01-08T14:00:00Z",
          "status": "implemented",
          "meetingSource": "Leadership Review"
        }
      ],
      "pendingActionItems": [
        {
          "task": "Complete user research analysis",
          "assignee": "alice@company.com",
          "dueDate": "2024-01-16T17:00:00Z",
          "status": "in_progress",
          "fromMeeting": "User Research Review"
        }
      ]
    },
    "agenda": [
      {
        "timeSlot": "15:00-15:15",
        "topic": "Review Q1 Metrics",
        "lead": "Alice Smith",
        "desiredOutcome": "Confirm baseline for Q2 planning"
      }
    ],
    "aiInsights": {
      "patternAnalysis": "This is meeting #4 about Q2 planning. Pattern suggests decision-making phase approaching.",
      "riskFactors": ["Tight timeline for Q2 delivery"],
      "suggestedFocus": ["Prioritize high-impact features", "Confirm resource allocation"]
    }
  }
}
```

#### **Meeting Brief DTO**
```typescript
interface MeetingBrief {
  meetingDetails: {
    title: string;
    date: string;
    duration: number;
    location: string;
    organizer: string;
  };
  objective: string;
  successCriteria: string[];
  participants: MeetingParticipant[];
  agenda: AgendaItem[];
  backgroundContext: {
    briefSummary: string;
    relevantDecisions: RelevantDecision[];
    pendingActionItems: PendingActionItem[];
    openQuestions: string[];
  };
  preMeetingPrep: {
    requiredReading: ReadingItem[];
    questionsToConsider: string[];
  };
  aiInsights: {
    patternAnalysis: string;
    riskFactors: string[];
    suggestedFocus: string[];
    predictedOutcomes: string[];
  };
}

interface MeetingParticipant {
  email: string;
  name: string;
  role: string;
  responsibilities?: string[];
  prepWork?: string[];
  lastMetWith?: string;
  sharedHistory?: string;
}

interface RelevantDecision {
  decision: string;
  dateMade: string;
  status: 'implemented' | 'pending' | 'revised';
  impact: string;
  meetingSource: string;
}

interface PendingActionItem {
  task: string;
  assignee: string;
  dueDate: string;
  status: string;
  fromMeeting: string;
}
```

---

## 🔔 **Push Notification Management**

### **1. Setup Automatic Notifications** (Coming Soon)

#### **Enable Push Notifications**
```typescript
POST /calendar/notifications/setup
Authorization: Bearer jwt_token

// Response
{
  "status": "success",
  "channel": {
    "id": "followthrough-user123-1703123456789",
    "resourceId": "o3hgv1538sdjfh",
    "expiration": "1703730000000"
  },
  "message": "Push notifications set up successfully"
}
```

#### **Check Notification Status**
```typescript
GET /calendar/notifications/status
Authorization: Bearer jwt_token

// Response
{
  "active": true,
  "channel": {
    "id": "followthrough-user123-1703123456789",
    "resourceId": "o3hgv1538sdjfh",
    "expiration": "1703730000000",
    "timeUntilExpiration": "6 days"
  },
  "message": "Push notifications are active"
}
```

#### **Stop Push Notifications**
```typescript
POST /calendar/notifications/stop
Authorization: Bearer jwt_token

// Response
{
  "status": "success",
  "message": "Push notifications stopped"
}
```

---

## 📊 **Event Detection & Statistics**

### **1. Event Detection Statistics** (Coming Soon)

#### **Get Event Stats**
```typescript
GET /calendar/events/stats
Authorization: Bearer jwt_token

// Response
{
  "stats": {
    "processedEvents": 42,
    "trackedMeetings": 15,
    "activeStates": {
      "scheduled": 8,
      "starting": 2,
      "active": 3,
      "ended": 2
    },
    "briefsGenerated": 12,
    "briefsScheduled": 3
  },
  "message": "Event detection statistics retrieved"
}
```

#### **Get Meeting State**
```typescript
GET /calendar/events/:eventId/state
Authorization: Bearer jwt_token

// Response
{
  "state": "active" | "scheduled" | "starting" | "ended",
  "eventId": "event123",
  "lastStateChange": "2024-01-15T09:02:00Z",
  "nextExpectedTransition": "ended",
  "estimatedTransitionTime": "2024-01-15T09:30:00Z"
}
```

---

## 🔄 **Real-Time Data Flow**

### **1. Server-Sent Events (Recommended)**

```typescript
// Connect to event stream
const eventSource = new EventSource('/calendar/events/stream', {
  headers: {
    'Authorization': 'Bearer jwt_token'
  }
});

// Listen for calendar events
eventSource.addEventListener('calendar_event', (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'meeting_starting':
      showMeetingAlert(data.event);
      break;
    case 'brief_ready':
      displayMeetingBrief(data.briefId);
      break;
    case 'calendar_updated':
      refreshCalendarView();
      break;
  }
});

// Event Data Format
{
  "type": "meeting_starting" | "brief_ready" | "calendar_updated" | "meeting_ended",
  "eventId": "event123",
  "userId": "user123",
  "event": CalendarEvent,
  "metadata": {
    "briefId"?: "brief123",
    "sessionId"?: "session123",
    "timeUntilStart"?: 5
  },
  "timestamp": "2024-01-15T08:55:00Z"
}
```

### **2. Polling Strategy (Alternative)**

```typescript
// Recommended polling intervals
const POLLING_INTERVALS = {
  upcoming_events: 300000,    // 5 minutes
  sync_status: 600000,        // 10 minutes
  brief_status: 30000,        // 30 seconds (when waiting for brief)
  event_states: 60000         // 1 minute (for active meetings)
};

// Efficient polling implementation
class CalendarPoller {
  async pollUpcomingEvents() {
    const response = await fetch('/calendar/events/upcoming', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    // Check for events starting soon
    const soonEvents = data.events.filter(event => {
      const startTime = new Date(event.startTime);
      const now = new Date();
      const minutesUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
      return minutesUntilStart <= 30 && minutesUntilStart > 0;
    });
    
    if (soonEvents.length > 0) {
      this.handleMeetingsSoon(soonEvents);
    }
  }
  
  async pollBriefStatus(sessionId: string) {
    const response = await fetch(`/calendar/brief/${sessionId}/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    if (data.status === 'completed') {
      this.handleBriefReady(data.brief);
      return true; // Stop polling
    }
    
    return false; // Continue polling
  }
}
```

---

## 🎨 **Client UI/UX Recommendations**

### **1. Calendar Integration UX**

#### **Authentication Flow**
```typescript
// Step 1: Show calendar connection prompt
<CalendarConnectButton onClick={initiateOAuth}>
  Connect Your Google Calendar
</CalendarConnectButton>

// Step 2: Handle OAuth return
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('code')) {
    handleOAuthCallback(urlParams.get('code'));
  }
}, []);

// Step 3: Show connection success
<CalendarStatus connected={true} lastSync={lastSyncTime} />
```

#### **Event Display Components**
```tsx
// Upcoming Events List
function UpcomingEventsList({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="events-list">
      {events.map(event => (
        <EventCard key={event.id} event={event}>
          <EventTime startTime={event.startTime} endTime={event.endTime} />
          <EventTitle>{event.title}</EventTitle>
          <EventParticipants attendees={event.attendees} />
          <BriefButton eventId={event.id} />
        </EventCard>
      ))}
    </div>
  );
}

// Meeting Brief Display
function MeetingBriefCard({ brief }: { brief: MeetingBrief }) {
  return (
    <Card className="meeting-brief">
      <CardHeader>
        <h3>{brief.meetingDetails.title}</h3>
        <Badge>AI Generated Brief</Badge>
      </CardHeader>
      <CardContent>
        <Section title="Objective">
          {brief.objective}
        </Section>
        <Section title="Background">
          {brief.backgroundContext.briefSummary}
        </Section>
        <Section title="Agenda">
          <AgendaList items={brief.agenda} />
        </Section>
        <Section title="AI Insights">
          <InsightsList insights={brief.aiInsights} />
        </Section>
      </CardContent>
    </Card>
  );
}
```

### **2. Real-Time Updates UX**

#### **Meeting Alerts**
```tsx
// Meeting starting notification
function MeetingStartingAlert({ event, minutesUntilStart }: MeetingAlertProps) {
  return (
    <Toast variant="info" duration={0}>
      <Clock className="w-4 h-4" />
      <div>
        <p className="font-medium">Meeting starting in {minutesUntilStart} minutes</p>
        <p className="text-sm text-gray-600">{event.title}</p>
        <div className="mt-2 space-x-2">
          <Button size="sm" onClick={() => viewBrief(event.id)}>
            View Brief
          </Button>
          <Button size="sm" variant="outline" onClick={() => joinMeeting(event.meetingLink)}>
            Join Meeting
          </Button>
        </div>
      </div>
    </Toast>
  );
}

// Brief ready notification
function BriefReadyAlert({ briefId, eventTitle }: BriefAlertProps) {
  return (
    <Toast variant="success">
      <FileText className="w-4 h-4" />
      <div>
        <p className="font-medium">Meeting brief ready</p>
        <p className="text-sm text-gray-600">{eventTitle}</p>
        <Button size="sm" className="mt-1" onClick={() => viewBrief(briefId)}>
          View Brief
        </Button>
      </div>
    </Toast>
  );
}
```

### **3. Loading States & Error Handling**

#### **Loading States**
```tsx
// Calendar sync loading
function CalendarSyncStatus({ status }: { status: CalendarSyncStatus }) {
  if (status.status === 'pending') {
    return (
      <div className="flex items-center space-x-2">
        <Spinner className="w-4 h-4" />
        <span>Syncing calendar...</span>
      </div>
    );
  }
  
  if (status.status === 'failed') {
    return (
      <div className="flex items-center space-x-2 text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span>Sync failed. Retrying...</span>
        <Button size="sm" onClick={retrySync}>Retry Now</Button>
      </div>
    );
  }
  
  return (
    <div className="flex items-center space-x-2 text-green-600">
      <CheckCircle className="w-4 h-4" />
      <span>Last synced: {formatRelativeTime(status.lastSyncTime)}</span>
    </div>
  );
}

// Brief generation loading
function BriefGenerationStatus({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  
  useEffect(() => {
    const pollBrief = async () => {
      const response = await fetch(`/calendar/brief/${sessionId}/status`);
      const data = await response.json();
      setStatus(data.status);
      
      if (data.status === 'completed') {
        onBriefReady(data.brief);
      }
    };
    
    const interval = setInterval(pollBrief, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);
  
  return (
    <div className="brief-status">
      {status === 'pending' && (
        <div className="flex items-center space-x-2">
          <Spinner />
          <span>Generating meeting brief...</span>
        </div>
      )}
      {status === 'failed' && (
        <div className="text-red-600">
          Brief generation failed. Please try again.
        </div>
      )}
    </div>
  );
}
```

---

## 🔧 **Error Handling**

### **HTTP Status Codes**

| Status | Meaning | Client Action |
|--------|---------|---------------|
| `200` | Success | Process response data |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Fix request parameters |
| `401` | Unauthorized | Refresh JWT or re-authenticate |
| `403` | Forbidden | Check user permissions |
| `404` | Not Found | Resource doesn't exist |
| `429` | Rate Limited | Implement exponential backoff |
| `500` | Server Error | Show error message, retry later |

### **Error Response Format**
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
  path: string;
  statusCode: number;
}

// Example error responses
{
  "error": {
    "code": "CALENDAR_NOT_CONNECTED",
    "message": "Google Calendar not connected. Please authenticate first.",
    "details": {
      "authUrl": "/oauth/google/authorize"
    }
  },
  "timestamp": "2024-01-15T10:00:00Z",
  "path": "/calendar/sync",
  "statusCode": 401
}

{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Calendar event not found or not accessible",
    "details": {
      "eventId": "invalid_event_123"
    }
  },
  "timestamp": "2024-01-15T10:00:00Z",
  "path": "/calendar/brief/invalid_event_123",
  "statusCode": 404
}
```

### **Client Error Handling**
```typescript
class CalendarApiClient {
  async handleApiCall<T>(request: () => Promise<Response>): Promise<T> {
    try {
      const response = await request();
      
      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        
        switch (errorData.statusCode) {
          case 401:
            // Handle authentication error
            if (errorData.error.code === 'CALENDAR_NOT_CONNECTED') {
              this.redirectToAuth(errorData.error.details?.authUrl);
            } else {
              this.refreshToken();
            }
            break;
            
          case 429:
            // Handle rate limiting
            const retryAfter = response.headers.get('Retry-After');
            await this.delay(parseInt(retryAfter || '60') * 1000);
            return this.handleApiCall(request); // Retry
            
          case 500:
            // Handle server errors
            this.showErrorToast('Server error. Please try again later.');
            break;
            
          default:
            this.showErrorToast(errorData.error.message);
        }
        
        throw new Error(errorData.error.message);
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof TypeError) {
        // Network error
        this.showErrorToast('Network error. Please check your connection.');
      }
      throw error;
    }
  }
}
```

---

## 🚀 **Getting Started Checklist**

### **Phase 1: Basic Integration** (Week 1)
- [ ] Implement Google OAuth flow
- [ ] Add calendar sync functionality
- [ ] Display upcoming events
- [ ] Handle authentication errors
- [ ] Add basic error handling

### **Phase 2: Meeting Briefs** (Week 2)
- [ ] Add meeting brief request functionality
- [ ] Implement brief display UI
- [ ] Add brief generation status polling
- [ ] Handle brief generation errors

### **Phase 3: Real-Time Features** (Week 3)
- [ ] Implement Server-Sent Events or polling
- [ ] Add meeting alerts and notifications
- [ ] Implement push notification setup (when server ready)
- [ ] Add real-time calendar updates

### **Phase 4: Advanced Features** (Week 4)
- [ ] Add event statistics dashboard
- [ ] Implement advanced error handling
- [ ] Add performance optimizations
- [ ] Add offline support

---

## 📞 **Support & Resources**

### **API Documentation**
- Base URL: `https://your-server.com/api`
- WebSocket: `wss://your-server.com`
- Health Check: `GET /health`

### **Rate Limits**
- Calendar sync: 10 requests per minute
- Event retrieval: 100 requests per minute
- Brief generation: 5 requests per minute
- Webhook endpoints: No limit (handled by Google)

### **Testing**
- Use development environment: `https://dev-server.com/api`
- Test OAuth with development client ID
- Mock webhook notifications for testing

This comprehensive guide provides everything needed to build a robust calendar integration client that leverages all the server-side calendar workflow capabilities. 