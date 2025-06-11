import { http, HttpResponse } from "msw";

// Mock response for OpenAI embeddings API
const mockEmbeddingResponse = {
  data: [
    {
      embedding: Array(1024).fill(0.5),
      index: 0,
      object: "embedding",
    },
  ],
  model: "text-embedding-3-large",
  object: "list",
  usage: {
    prompt_tokens: 10,
    total_tokens: 10,
  },
};

// Mock response for OpenAI batch embeddings API
const mockBatchEmbeddingResponse = (inputCount: number) => ({
  data: Array(inputCount)
    .fill(0)
    .map((_, index) => ({
      embedding: Array(1024).fill(0.5),
      index,
      object: "embedding",
    })),
  model: "text-embedding-3-large",
  object: "list",
  usage: {
    prompt_tokens: inputCount * 10,
    total_tokens: inputCount * 10,
  },
});

// Mock topic extraction response
const mockTopicExtractionResponse = {
  id: "chatcmpl-topic-123",
  object: "chat.completion",
  created: Date.now(),
  model: "gpt-4o",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify([
          {
            name: "Project Timeline",
            description: "Discussion about project deadlines and milestones",
            relevance: 9,
            subtopics: ["Delays", "Milestones", "Deliverables"],
            keywords: ["timeline", "deadline", "milestone", "schedule"],
          },
          {
            name: "Budget Concerns",
            description:
              "Analysis of current expenditures and budget constraints",
            relevance: 8,
            subtopics: ["Cost Overruns", "Resource Allocation"],
            keywords: ["budget", "cost", "expense", "funding"],
          },
          {
            name: "Team Collaboration",
            description: "Discussion about team dynamics and communication",
            relevance: 7,
            subtopics: ["Communication Channels", "Work Distribution"],
            keywords: [
              "team",
              "collaboration",
              "communication",
              "coordination",
            ],
          },
        ]),
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 50,
    completion_tokens: 200,
    total_tokens: 250,
  },
};

// Mock action item extraction response
const mockActionItemResponse = {
  id: "chatcmpl-action-123",
  object: "chat.completion",
  created: Date.now(),
  model: "gpt-4o",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify([
          {
            description: "Update project timeline document with new milestones",
            assignee: "Alice",
            dueDate: "2023-07-15",
            priority: "high",
            status: "pending",
            relatedTopics: ["Project Timeline"],
          },
          {
            description:
              "Schedule budget review meeting with finance department",
            assignee: "Bob",
            dueDate: "2023-07-10",
            priority: "medium",
            status: "pending",
            relatedTopics: ["Budget Concerns"],
          },
          {
            description:
              "Create new Slack channel for cross-team communication",
            assignee: "Charlie",
            dueDate: "2023-07-05",
            priority: "low",
            status: "pending",
            relatedTopics: ["Team Collaboration"],
          },
        ]),
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 60,
    completion_tokens: 180,
    total_tokens: 240,
  },
};

// Mock sentiment analysis response
const mockSentimentResponse = {
  id: "chatcmpl-sentiment-123",
  object: "chat.completion",
  created: Date.now(),
  model: "gpt-4o",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify({
          overall: "mixed",
          score: 0.2,
          segments: [
            {
              text: "We need to address these timeline issues immediately.",
              sentiment: "negative",
              score: -0.6,
              speaker: "Alice",
            },
            {
              text: "I think we can work through these challenges together.",
              sentiment: "positive",
              score: 0.7,
              speaker: "Bob",
            },
            {
              text: "The budget constraints are concerning but not insurmountable.",
              sentiment: "neutral",
              score: 0.1,
              speaker: "Charlie",
            },
          ],
          keyEmotions: ["concern", "hope", "determination"],
          toneShifts: [
            {
              from: "negative",
              to: "positive",
              approximate_time: "10:15",
              trigger: "Discussion of team collaboration",
            },
          ],
        }),
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 70,
    completion_tokens: 220,
    total_tokens: 290,
  },
};

// Mock meeting context response
const mockMeetingContextResponse = {
  id: "chatcmpl-context-123",
  object: "chat.completion",
  created: Date.now(),
  model: "gpt-4o",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify({
          participantHistories: [
            {
              email: "alice@company.com",
              displayName: "Alice Johnson",
              totalMeetings: 15,
              recentMeetings: [
                {
                  title: "Previous Product Planning",
                  date: "2024-01-10T10:00:00Z",
                  duration: 90,
                  topics: ["product roadmap", "quarterly goals"],
                },
              ],
              commonTopics: ["product management", "planning", "strategy"],
              responsePatterns: {
                averageResponseTime: "2 hours",
                preferredMeetingTimes: ["morning"],
                engagement: "high",
              },
              meetingBehavior: {
                participationLevel: "active",
                punctuality: "always_on_time",
                communicationStyle: "direct",
              },
            },
            {
              email: "bob@company.com",
              displayName: "Bob Smith",
              totalMeetings: 8,
              recentMeetings: [],
              commonTopics: ["engineering", "technical planning"],
              responsePatterns: {
                averageResponseTime: "4 hours",
                preferredMeetingTimes: ["afternoon"],
                engagement: "moderate",
              },
              meetingBehavior: {
                participationLevel: "reserved",
                punctuality: "usually_on_time",
                communicationStyle: "technical",
              },
            },
            {
              email: "charlie@company.com",
              displayName: "Charlie Brown",
              totalMeetings: 3,
              recentMeetings: [],
              commonTopics: ["design", "user experience"],
              responsePatterns: {
                averageResponseTime: "1 hour",
                preferredMeetingTimes: ["morning", "afternoon"],
                engagement: "high",
              },
              meetingBehavior: {
                participationLevel: "collaborative",
                punctuality: "always_early",
                communicationStyle: "visual",
              },
            },
          ],
          topicPredictions: [
            {
              topic: "Product Roadmap Q2",
              confidence: 0.95,
              reasoning: "Based on meeting title and participant history",
              relatedPastTopics: ["product roadmap", "quarterly planning"],
            },
            {
              topic: "Budget Planning",
              confidence: 0.75,
              reasoning: "Common topic for quarterly meetings",
              relatedPastTopics: ["budget", "resource allocation"],
            },
          ],
          contextSummary: {
            totalRelevantMeetings: 5,
            keyParticipants: ["alice@company.com", "bob@company.com"],
            primaryTopics: ["product planning", "quarterly goals", "roadmap"],
            meetingPatterns: {
              averageDuration: 75,
              commonTimeSlots: ["10:00 AM", "2:00 PM"],
              recurringAttendees: ["alice@company.com"],
            },
          },
        }),
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 400,
    total_tokens: 500,
  },
};

// Mock meeting brief response
const mockMeetingBriefResponse = {
  id: "chatcmpl-brief-123",
  object: "chat.completion",
  created: Date.now(),
  model: "gpt-4o",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify({
          enhancedAgenda: [
            {
              title: "Q2 Product Roadmap Review",
              duration: 30,
              priority: "high",
              description: "Review and finalize Q2 product roadmap priorities",
              materials: [
                "Q1 performance metrics",
                "customer feedback summary",
              ],
              expectedOutcomes: [
                "Finalized Q2 priorities",
                "Resource allocation decisions",
              ],
              owner: "alice@company.com",
              order: 1,
            },
            {
              title: "Budget Planning & Resource Allocation",
              duration: 25,
              priority: "high",
              description: "Discuss budget constraints and resource needs",
              materials: ["Current budget status", "resource requirements"],
              expectedOutcomes: ["Budget approval", "Team allocation plan"],
              owner: "bob@company.com",
              order: 2,
            },
            {
              title: "Design System Updates",
              duration: 15,
              priority: "medium",
              description: "Review design system changes for Q2",
              materials: ["Design mockups", "user research findings"],
              expectedOutcomes: ["Design approval", "Implementation timeline"],
              owner: "charlie@company.com",
              order: 3,
            },
          ],
          participantPreparations: [
            {
              email: "alice@company.com",
              displayName: "Alice Johnson",
              preparationTasks: [
                "Review Q1 performance metrics",
                "Prepare Q2 priority recommendations",
              ],
              keyQuestions: [
                "What are the top 3 Q2 priorities?",
                "How do we handle resource constraints?",
              ],
              responsibilities: [
                "Lead roadmap discussion",
                "Make final priority decisions",
              ],
              suggestedReadingTime: 20,
              personalizedNotes:
                "Focus on data-driven decisions based on Q1 learnings",
            },
            {
              email: "bob@company.com",
              displayName: "Bob Smith",
              preparationTasks: [
                "Prepare budget analysis",
                "Review resource requirements",
              ],
              keyQuestions: [
                "What's our budget flexibility?",
                "Can we hire additional developers?",
              ],
              responsibilities: [
                "Present budget constraints",
                "Propose resource solutions",
              ],
              suggestedReadingTime: 15,
              personalizedNotes: "Prepare technical feasibility assessment",
            },
            {
              email: "charlie@company.com",
              displayName: "Charlie Brown",
              preparationTasks: [
                "Finalize design mockups",
                "Prepare user research summary",
              ],
              keyQuestions: [
                "How do designs align with Q2 goals?",
                "What user feedback should influence decisions?",
              ],
              responsibilities: [
                "Present design updates",
                "Share user insights",
              ],
              suggestedReadingTime: 10,
              personalizedNotes: "Focus on user-centered design justifications",
            },
          ],
          objectives: {
            primary: [
              "Finalize Q2 product roadmap priorities",
              "Approve budget and resource allocation",
              "Align on design system updates",
            ],
            secondary: [
              "Identify potential risks and mitigations",
              "Set timeline for Q2 deliverables",
            ],
            successMetrics: [
              "All participants agree on top 3 Q2 priorities",
              "Budget approved with resource allocation plan",
              "Design system updates scheduled",
            ],
            risks: [
              {
                risk: "Budget constraints may limit scope",
                impact: "high",
                mitigation: "Prioritize most critical features first",
              },
              {
                risk: "Timeline pressure for Q2 deliverables",
                impact: "medium",
                mitigation: "Build buffer time into estimates",
              },
            ],
          },
          timeManagement: {
            recommended: {
              totalDuration: 70,
              bufferTime: 20,
              criticalTopics: ["Q2 roadmap", "budget approval"],
            },
            schedule: [
              {
                topic: "Opening & Context",
                startTime: "10:00",
                duration: 5,
                type: "opening",
              },
              {
                topic: "Q2 Product Roadmap Review",
                startTime: "10:05",
                duration: 30,
                type: "discussion",
              },
              {
                topic: "Budget Planning",
                startTime: "10:35",
                duration: 25,
                type: "decision",
              },
              {
                topic: "Design System Updates",
                startTime: "11:00",
                duration: 15,
                type: "update",
              },
              {
                topic: "Next Steps & Closing",
                startTime: "11:15",
                duration: 10,
                type: "closing",
              },
            ],
            fallbackPlans: [
              "If running late, postpone design discussion to follow-up",
              "Focus on roadmap and budget as critical decisions",
            ],
          },
        }),
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 200,
    completion_tokens: 600,
    total_tokens: 800,
  },
};

// Mock Google Calendar API responses
const mockGoogleCalendarEvents = {
  kind: "calendar#events",
  etag: '"test-etag"',
  summary: "Test Calendar",
  timeZone: "America/New_York",
  items: [
    {
      kind: "calendar#event",
      etag: '"test-event-etag"',
      id: "test-event-123",
      status: "confirmed",
      summary: "Product Planning Meeting",
      description: "Quarterly product planning session",
      location: "Conference Room A",
      creator: {
        email: "alice@company.com",
        displayName: "Alice Johnson",
      },
      organizer: {
        email: "alice@company.com",
        displayName: "Alice Johnson",
      },
      start: {
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timeZone: "America/New_York",
      },
      end: {
        dateTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + 90 * 60 * 1000,
        ).toISOString(),
        timeZone: "America/New_York",
      },
      attendees: [
        {
          email: "alice@company.com",
          displayName: "Alice Johnson",
          responseStatus: "accepted",
        },
        {
          email: "bob@company.com",
          displayName: "Bob Smith",
          responseStatus: "tentative",
        },
        {
          email: "charlie@company.com",
          displayName: "Charlie Brown",
          responseStatus: "needsAction",
        },
      ],
      hangoutLink: "https://meet.google.com/abc-defg-hij",
    },
  ],
};

// Default chat completion response for other queries
const mockChatCompletionResponse = {
  id: "chatcmpl-mock-123",
  object: "chat.completion",
  created: Date.now(),
  model: "gpt-4o",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "This is a mock response from the OpenAI API.",
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 20,
    completion_tokens: 10,
    total_tokens: 30,
  },
};

// Type for OpenAI embedding request
interface OpenAIEmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: string;
  dimensions?: number;
  user?: string;
}

export const handlers = [
  // Intercept OpenAI embeddings API
  http.post("https://api.openai.com/v1/embeddings", async ({ request }) => {
    // Parse the request body
    const reqBody = (await request.json()) as OpenAIEmbeddingRequest;

    if (Array.isArray(reqBody.input)) {
      // Handle batch embedding request
      return HttpResponse.json(
        mockBatchEmbeddingResponse(reqBody.input.length),
      );
    } else {
      // Handle single embedding request
      return HttpResponse.json(mockEmbeddingResponse);
    }
  }),

  // Intercept OpenAI chat completion API with content-based response selection
  http.post(
    "https://api.openai.com/v1/chat/completions",
    async ({ request }) => {
      const reqBody = (await request.json()) as any;
      const messages = reqBody.messages || [];
      const content =
        messages.length > 0 ? messages[messages.length - 1].content || "" : "";

      // Select appropriate mock response based on content
      if (
        content.toLowerCase().includes("meeting context") ||
        content.toLowerCase().includes("participant") ||
        content.toLowerCase().includes("previous meetings")
      ) {
        return HttpResponse.json(mockMeetingContextResponse);
      } else if (
        content.toLowerCase().includes("meeting brief") ||
        content.toLowerCase().includes("agenda") ||
        content.toLowerCase().includes("preparation")
      ) {
        return HttpResponse.json(mockMeetingBriefResponse);
      } else if (
        content.toLowerCase().includes("topic") ||
        content.toLowerCase().includes("main discussion points")
      ) {
        return HttpResponse.json(mockTopicExtractionResponse);
      } else if (
        content.toLowerCase().includes("action item") ||
        content.toLowerCase().includes("task") ||
        content.toLowerCase().includes("to-do")
      ) {
        return HttpResponse.json(mockActionItemResponse);
      } else if (
        content.toLowerCase().includes("sentiment") ||
        content.toLowerCase().includes("emotion") ||
        content.toLowerCase().includes("tone")
      ) {
        return HttpResponse.json(mockSentimentResponse);
      } else {
        return HttpResponse.json(mockChatCompletionResponse);
      }
    },
  ),

  // Mock Google Calendar API - List Events
  http.get(
    "https://www.googleapis.com/calendar/v3/calendars/*/events",
    async () => {
      return HttpResponse.json(mockGoogleCalendarEvents);
    },
  ),

  // Mock Google Calendar API - Get Event
  http.get(
    "https://www.googleapis.com/calendar/v3/calendars/*/events/*",
    async () => {
      return HttpResponse.json(mockGoogleCalendarEvents.items[0]);
    },
  ),

  // Mock Google Calendar API - Create Event
  http.post(
    "https://www.googleapis.com/calendar/v3/calendars/*/events",
    async () => {
      return HttpResponse.json({
        ...mockGoogleCalendarEvents.items[0],
        id: `new-event-${Date.now()}`,
      });
    },
  ),

  // Mock Google OAuth token endpoint
  http.post("https://oauth2.googleapis.com/token", async () => {
    return HttpResponse.json({
      access_token: "mock_access_token",
      refresh_token: "mock_refresh_token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "https://www.googleapis.com/auth/calendar",
    });
  }),

  // Mock Pinecone API for vector storage
  http.post("*/query", async () => {
    return HttpResponse.json({
      matches: [
        {
          id: "doc-1",
          score: 0.92,
          values: Array(1024).fill(0.1),
          metadata: {
            content: "Previous meeting discussed project timeline issues.",
            meetingId: "prev-meeting-001",
            date: "2023-06-15",
          },
        },
        {
          id: "doc-2",
          score: 0.87,
          values: Array(1024).fill(0.2),
          metadata: {
            content:
              "Budget concerns were raised in last week's financial review.",
            meetingId: "prev-meeting-002",
            date: "2023-06-22",
          },
        },
        {
          id: "doc-3",
          score: 0.84,
          values: Array(1024).fill(0.15),
          metadata: {
            content:
              "Alice led previous product planning sessions with focus on user feedback.",
            meetingId: "prev-meeting-003",
            date: "2023-12-10",
            participants: ["alice@company.com", "bob@company.com"],
          },
        },
      ],
      namespace: "meetings",
    });
  }),

  // Mock Pinecone API for vector upsert
  http.post("*/vectors/upsert", async () => {
    return HttpResponse.json({
      upsertedCount: 10,
    });
  }),

  // Mock Pinecone index stats
  http.get("*/describe_index_stats", async () => {
    return HttpResponse.json({
      namespaces: {
        meetings: {
          vectorCount: 150,
        },
        "email-history": {
          vectorCount: 300,
        },
      },
      dimension: 1024,
      indexFullness: 0.1,
      totalVectorCount: 450,
    });
  }),

  // Mock email/messaging services
  http.post("https://hooks.slack.com/services/**", async () => {
    return HttpResponse.json({ ok: true });
  }),

  // Mock webhook endpoints (placeholder for future integrations)
  http.post("*/webhook/**", async () => {
    return HttpResponse.json({ received: true, status: "processed" });
  }),
];
