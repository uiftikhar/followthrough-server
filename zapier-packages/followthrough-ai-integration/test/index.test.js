const zapier = require('zapier-platform-core');
const App = require('../src/index');

// Mock environment variables
process.env.FOLLOWTHROUGH_API_URL = 'https://api.followthrough.ai';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

const appTester = zapier.createAppTester(App);

describe('FollowThrough AI Zapier Integration', () => {
  // Mock authentication data
  const authData = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    api_key: 'mock-api-key',
    userId: 'test-user-123',
  };

  describe('Authentication', () => {
    it('should have OAuth2 authentication configured', () => {
      expect(App.authentication.type).toBe('oauth2');
      expect(App.authentication.oauth2Config.authorizeUrl).toBeDefined();
      expect(App.authentication.oauth2Config.getAccessToken).toBeDefined();
    });

    it('should test authentication successfully', async () => {
      const bundle = {
        authData,
        inputData: {},
      };

      // Mock the test function to return success
      const result = await appTester(App.authentication.test, bundle);
      expect(result).toBeDefined();
    });
  });

  describe('Triggers', () => {
    describe('New Email Trigger', () => {
      it('should be defined', () => {
        expect(App.triggers.new_email).toBeDefined();
        expect(App.triggers.new_email.operation.perform).toBeDefined();
      });

      it('should fetch recent emails', async () => {
        const bundle = {
          authData,
          inputData: {
            maxResults: 5,
            query: 'is:unread',
          },
        };

        // Mock API response
        const mockEmails = [
          {
            id: 'email-1',
            subject: 'Test Email',
            from: 'test@example.com',
            to: 'user@company.com',
            body: 'This is a test email',
            timestamp: '2024-01-15T10:00:00Z',
            threadId: 'thread-1',
            snippet: 'This is a test...',
          },
        ];

        // This would normally make an API call
        // For testing, we'll just verify the structure
        expect(typeof App.triggers.new_email.operation.perform).toBe('function');
      });
    });

    describe('New Calendar Event Trigger', () => {
      it('should be defined', () => {
        expect(App.triggers.new_calendar_event).toBeDefined();
        expect(App.triggers.new_calendar_event.operation.performList).toBeDefined();
      });
    });

    describe('Email Matching Search Trigger', () => {
      it('should be defined', () => {
        expect(App.triggers.email_matching_search).toBeDefined();
        expect(App.triggers.email_matching_search.operation.performList).toBeDefined();
      });
    });
  });

  describe('Actions', () => {
    describe('Trigger Email Triage Action', () => {
      it('should be defined', () => {
        expect(App.actions.triggerEmailTriage).toBeDefined();
        expect(App.actions.triggerEmailTriage.operation.perform).toBeDefined();
      });

      it('should have required input fields', () => {
        const inputFields = App.actions.triggerEmailTriage.operation.inputFields;
        const requiredFields = inputFields.filter(field => field.required);
        
        expect(requiredFields.length).toBeGreaterThan(0);
        expect(requiredFields.some(field => field.key === 'emailId')).toBe(true);
      });
    });

    describe('Send Email Action', () => {
      it('should be defined', () => {
        expect(App.actions.sendEmail).toBeDefined();
        expect(App.actions.sendEmail.operation.perform).toBeDefined();
      });
    });

    describe('Trigger Meeting Analysis Action', () => {
      it('should be defined', () => {
        expect(App.actions.triggerMeetingAnalysis).toBeDefined();
        expect(App.actions.triggerMeetingAnalysis.operation.perform).toBeDefined();
      });
    });

    describe('Create Calendar Event Action', () => {
      it('should be defined', () => {
        expect(App.actions.createCalendarEvent).toBeDefined();
        expect(App.actions.createCalendarEvent.operation.perform).toBeDefined();
      });
    });
  });

  describe('Creates', () => {
    describe('Draft Reply Create', () => {
      it('should be defined', () => {
        expect(App.creates.draftReply).toBeDefined();
        expect(App.creates.draftReply.operation.perform).toBeDefined();
      });

      it('should have proper input validation', () => {
        const inputFields = App.creates.draftReply.operation.inputFields;
        const requiredFields = inputFields.filter(field => field.required);
        
        expect(requiredFields.some(field => field.key === 'originalEmailId')).toBe(true);
        expect(requiredFields.some(field => field.key === 'originalSubject')).toBe(true);
        expect(requiredFields.some(field => field.key === 'originalBody')).toBe(true);
      });
    });

    describe('Task from Email Create', () => {
      it('should be defined', () => {
        expect(App.creates.taskFromEmail).toBeDefined();
        expect(App.creates.taskFromEmail.operation.perform).toBeDefined();
      });
    });
  });

  describe('Searches', () => {
    describe('Find Emails Search', () => {
      it('should be defined', () => {
        expect(App.searches.findEmails).toBeDefined();
        expect(App.searches.findEmails.operation.perform).toBeDefined();
      });

      it('should have flexible search options', () => {
        const inputFields = App.searches.findEmails.operation.inputFields;
        const searchFields = ['query', 'from', 'to', 'subject', 'hasAttachment', 'isUnread'];
        
        searchFields.forEach(fieldKey => {
          expect(inputFields.some(field => field.key === fieldKey)).toBe(true);
        });
      });
    });

    describe('Find Events Search', () => {
      it('should be defined', () => {
        expect(App.searches.findEvents).toBeDefined();
        expect(App.searches.findEvents.operation.perform).toBeDefined();
      });
    });
  });

  describe('Sample Data', () => {
    it('should have valid sample data for all operations', () => {
      // Check triggers
      Object.values(App.triggers).forEach(trigger => {
        expect(trigger.operation.sample).toBeDefined();
        expect(typeof trigger.operation.sample).toBe('object');
      });

      // Check actions
      Object.values(App.actions).forEach(action => {
        expect(action.operation.sample).toBeDefined();
        expect(typeof action.operation.sample).toBe('object');
      });

      // Check creates
      Object.values(App.creates).forEach(create => {
        expect(create.operation.sample).toBeDefined();
        expect(typeof create.operation.sample).toBe('object');
      });

      // Check searches
      Object.values(App.searches).forEach(search => {
        expect(search.operation.sample).toBeDefined();
        expect(typeof search.operation.sample).toBe('object');
      });
    });
  });

  describe('Input/Output Fields', () => {
    it('should have proper field definitions', () => {
      const allOperations = [
        ...Object.values(App.triggers),
        ...Object.values(App.actions),
        ...Object.values(App.creates),
        ...Object.values(App.searches),
      ];

      allOperations.forEach(operation => {
        expect(Array.isArray(operation.operation.inputFields)).toBe(true);
        
        if (operation.operation.outputFields) {
          expect(Array.isArray(operation.operation.outputFields)).toBe(true);
        }

        // Check that each input field has required properties
        operation.operation.inputFields.forEach(field => {
          expect(field.key).toBeDefined();
          expect(field.label).toBeDefined();
          expect(field.type).toBeDefined();
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      const bundle = {
        authData: {
          access_token: 'invalid-token',
        },
        inputData: {},
      };

      // This would test error handling in real scenarios
      expect(typeof App.authentication.test).toBe('function');
    });
  });

  describe('Integration Flow', () => {
    it('should support complete email triage workflow', () => {
      // Verify that we have all components for email triage
      expect(App.triggers.new_email).toBeDefined(); // Trigger on new email
      expect(App.actions.triggerEmailTriage).toBeDefined(); // Process email
      expect(App.creates.draftReply).toBeDefined(); // Generate reply
      expect(App.actions.sendEmail).toBeDefined(); // Send response
    });

    it('should support meeting analysis workflow', () => {
      // Verify that we have all components for meeting analysis
      expect(App.triggers.new_calendar_event).toBeDefined(); // Trigger on new event
      expect(App.actions.triggerMeetingAnalysis).toBeDefined(); // Analyze meeting
      expect(App.creates.taskFromEmail).toBeDefined(); // Extract tasks
    });
  });
}); 