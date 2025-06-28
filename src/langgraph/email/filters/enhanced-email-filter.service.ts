import { Injectable, Logger } from '@nestjs/common';

export interface EmailFilterResult {
  shouldProcess: boolean;
  priority: 'high' | 'medium' | 'low' | 'ignore';
  category: EmailCategory;
  reasoning: string;
  confidence: number;
}

export enum EmailCategory {
  URGENT_BUSINESS = 'urgent_business',
  MEETING_RELATED = 'meeting_related',
  FOLLOW_UP = 'follow_up',
  CUSTOMER_SUPPORT = 'customer_support',
  GITHUB_NOTIFICATION = 'github_notification',
  SLACK_NOTIFICATION = 'slack_notification',
  JIRA_NOTIFICATION = 'jira_notification',
  PROMOTIONAL = 'promotional',
  NEWSLETTER = 'newsletter',
  AUTOMATED_SYSTEM = 'automated_system',
  SPAM = 'spam',
  GENERAL = 'general'
}

export interface EmailData {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  metadata?: any;
}

/**
 * Enhanced Email Filter Service
 * 
 * Implements intelligent multi-layer email filtering to categorize emails
 * and determine processing priority before expensive LLM operations.
 * 
 * Filters are applied in order of importance:
 * 1. Spam Filter - Blocks obvious spam
 * 2. Notification Filter - Catches automated notifications
 * 3. Meeting Filter - Identifies meeting-related emails
 * 4. Urgent Filter - Detects urgent business emails
 * 5. Promotional Filter - Identifies marketing emails
 */
@Injectable()
export class EnhancedEmailFilterService {
  private readonly logger = new Logger(EnhancedEmailFilterService.name);

  async analyzeEmail(email: EmailData): Promise<EmailFilterResult> {
    this.logger.log(`🔍 Analyzing email: "${email.subject}" from ${email.from}`);

    // Apply filters in priority order
    const filters = [
      this.spamFilter,
      this.notificationFilter,
      this.meetingFilter,
      this.urgentFilter,
      this.promotionalFilter
    ];

    for (const filter of filters) {
      const result = await filter.analyze(email);
      if (result.shouldProcess === false || result.priority !== 'medium') {
        this.logger.log(`📋 Filter result: ${result.category} - ${result.reasoning} (confidence: ${result.confidence})`);
        return result;
      }
    }

    // Default to medium priority for unclassified emails
    const defaultResult = {
      shouldProcess: true,
      priority: 'medium' as const,
      category: EmailCategory.GENERAL,
      reasoning: 'Unclassified email, default processing',
      confidence: 0.5
    };

    this.logger.log(`📋 Default classification: ${defaultResult.category} - ${defaultResult.reasoning}`);
    return defaultResult;
  }

  /**
   * Spam Filter - Detects obvious spam patterns
   */
  private spamFilter = {
    analyze: async (email: EmailData): Promise<EmailFilterResult> => {
      const spamIndicators = [
        // Common spam phrases
        /lottery/i, /winner/i, /congratulations.*won/i,
        /nigeria/i, /inheritance/i, /million dollars/i,
        /click here/i, /act now/i, /limited time/i,
        /free money/i, /make money/i, /work from home/i,
        /viagra/i, /casino/i, /gambling/i,
        // Suspicious patterns
        /re: re: re:/i, // Multiple forwards
        /\$\$\$/i, // Multiple dollar signs
        /!!!!/i, // Multiple exclamation marks
        /URGENT.*URGENT/i, // Repeated urgent
      ];

      const bodySpamIndicators = [
        /click.*link.*below/i,
        /verify.*account.*immediately/i,
        /suspended.*account/i,
        /confirm.*identity/i,
        /update.*payment.*method/i
      ];

      const isSubjectSpam = spamIndicators.some(pattern => pattern.test(email.subject));
      const isBodySpam = bodySpamIndicators.some(pattern => pattern.test(email.body));
      const isFromSuspicious = this.isSuspiciousSender(email.from);

      if (isSubjectSpam || isBodySpam || isFromSuspicious) {
        return {
          shouldProcess: false,
          priority: 'ignore',
          category: EmailCategory.SPAM,
          reasoning: `Detected spam patterns: ${isSubjectSpam ? 'subject' : ''} ${isBodySpam ? 'body' : ''} ${isFromSuspicious ? 'sender' : ''}`.trim(),
          confidence: 0.9
        };
      }

      return { shouldProcess: true, priority: 'medium', category: EmailCategory.GENERAL, reasoning: '', confidence: 0 };
    }
  };

  /**
   * Notification Filter - Detects automated notifications from various platforms
   */
  private notificationFilter = {
    analyze: async (email: EmailData): Promise<EmailFilterResult> => {
      const notificationPatterns = {
        github: {
          from: /@(notifications\.)?github\.com/i,
          subject: /^\[.*\]|pull request|issue|commit|push|merge/i,
          body: /github\.com\//i,
          confidence: 0.95
        },
        slack: {
          from: /@slack\.com|slackmail/i,
          subject: /slack|channel|direct message|workspace/i,
          body: /slack\.com/i,
          confidence: 0.95
        },
        jira: {
          from: /@atlassian\.com/i,
          subject: /jira|ticket|issue.*created|issue.*updated/i,
          body: /atlassian\.net|jira/i,
          confidence: 0.9
        },
        trello: {
          from: /@trello\.com/i,
          subject: /trello|card|board/i,
          body: /trello\.com/i,
          confidence: 0.9
        },
        asana: {
          from: /@asana\.com/i,
          subject: /asana|task|project/i,
          body: /asana\.com/i,
          confidence: 0.9
        },
        linear: {
          from: /@linear\.app/i,
          subject: /linear|issue/i,
          body: /linear\.app/i,
          confidence: 0.9
        },
        vercel: {
          from: /@vercel\.com/i,
          subject: /deployment|build|vercel/i,
          body: /vercel\.com/i,
          confidence: 0.95
        },
        aws: {
          from: /@aws\.amazon\.com|@amazon\.com/i,
          subject: /aws|amazon web services|billing|usage/i,
          body: /aws\.amazon\.com/i,
          confidence: 0.9
        }
      };

      for (const [platform, patterns] of Object.entries(notificationPatterns)) {
        const fromMatch = patterns.from.test(email.from);
        const subjectMatch = patterns.subject.test(email.subject);
        const bodyMatch = patterns.body.test(email.body);

        if (fromMatch || (subjectMatch && bodyMatch)) {
          const categoryKey = `${platform.toUpperCase()}_NOTIFICATION` as keyof typeof EmailCategory;
          return {
            shouldProcess: false,
            priority: 'low',
            category: EmailCategory[categoryKey] || EmailCategory.AUTOMATED_SYSTEM,
            reasoning: `Detected ${platform} notification`,
            confidence: patterns.confidence
          };
        }
      }

      // Generic automated email patterns
      const automatedPatterns = [
        /noreply/i, /no-reply/i, /donotreply/i, /do-not-reply/i,
        /notification/i, /automated/i, /system/i,
        /support@.*\.com/i, /admin@.*\.com/i,
        /info@.*\.com/i, /hello@.*\.com/i
      ];

      const isAutomated = automatedPatterns.some(pattern => pattern.test(email.from));
      if (isAutomated) {
        return {
          shouldProcess: false,
          priority: 'low',
          category: EmailCategory.AUTOMATED_SYSTEM,
          reasoning: 'Detected automated system email',
          confidence: 0.8
        };
      }

      return { shouldProcess: true, priority: 'medium', category: EmailCategory.GENERAL, reasoning: '', confidence: 0 };
    }
  };

  /**
   * Meeting Filter - Identifies meeting-related emails (high priority)
   */
  private meetingFilter = {
    analyze: async (email: EmailData): Promise<EmailFilterResult> => {
      const meetingPatterns = {
        subject: [
          /meeting/i, /calendar/i, /invitation/i, /invite/i,
          /reschedule/i, /rescheduled/i, /postpone/i,
          /conference call/i, /video call/i, /zoom/i,
          /teams meeting/i, /google meet/i,
          /standup/i, /daily/i, /weekly/i, /monthly/i,
          /1:1|one.on.one/i, /sync/i, /catch.?up/i
        ],
        body: [
          /zoom\.us/i, /meet\.google\.com/i, /teams\.microsoft/i,
          /webex/i, /gotomeeting/i, /join.*meeting/i,
          /meeting.*link/i, /dial.*in/i, /conference.*room/i,
          /calendar.*invite/i, /when2meet/i, /doodle\.com/i
        ]
      };

      const subjectMatch = meetingPatterns.subject.some(pattern => pattern.test(email.subject));
      const bodyMatch = meetingPatterns.body.some(pattern => pattern.test(email.body));

      if (subjectMatch || bodyMatch) {
        return {
          shouldProcess: true,
          priority: 'high',
          category: EmailCategory.MEETING_RELATED,
          reasoning: 'Detected meeting-related content',
          confidence: 0.9
        };
      }

      return { shouldProcess: true, priority: 'medium', category: EmailCategory.GENERAL, reasoning: '', confidence: 0 };
    }
  };

  /**
   * Urgent Filter - Detects urgent business emails (high priority)
   */
  private urgentFilter = {
    analyze: async (email: EmailData): Promise<EmailFilterResult> => {
      const urgentPatterns = [
        /urgent/i, /asap/i, /emergency/i, /critical/i,
        /immediate/i, /priority/i, /rush/i,
        /deadline/i, /time.?sensitive/i,
        /please.*respond.*today/i, /need.*response.*today/i,
        /escalation/i, /incident/i, /outage/i,
        /production.*down/i, /system.*down/i
      ];

      const customerSupportPatterns = [
        /customer.*complaint/i, /customer.*issue/i,
        /refund.*request/i, /billing.*issue/i,
        /account.*problem/i, /login.*problem/i,
        /bug.*report/i, /error.*report/i
      ];

      const isUrgent = urgentPatterns.some(pattern => 
        pattern.test(email.subject) || pattern.test(email.body)
      );

      const isCustomerSupport = customerSupportPatterns.some(pattern =>
        pattern.test(email.subject) || pattern.test(email.body)
      );

      if (isUrgent) {
        return {
          shouldProcess: true,
          priority: 'high',
          category: EmailCategory.URGENT_BUSINESS,
          reasoning: 'Detected urgent business content',
          confidence: 0.85
        };
      }

      if (isCustomerSupport) {
        return {
          shouldProcess: true,
          priority: 'high',
          category: EmailCategory.CUSTOMER_SUPPORT,
          reasoning: 'Detected customer support request',
          confidence: 0.8
        };
      }

      return { shouldProcess: true, priority: 'medium', category: EmailCategory.GENERAL, reasoning: '', confidence: 0 };
    }
  };

  /**
   * Promotional Filter - Detects marketing/promotional emails (low priority)
   */
  private promotionalFilter = {
    analyze: async (email: EmailData): Promise<EmailFilterResult> => {
      const promotionalPatterns = [
        /unsubscribe/i, /newsletter/i, /subscription/i,
        /marketing/i, /promotion/i, /sale/i, /discount/i,
        /offer/i, /deal/i, /coupon/i, /save.*%/i,
        /black friday/i, /cyber monday/i,
        /limited.*time/i, /expires.*soon/i,
        /free.*shipping/i, /buy.*now/i
      ];

      const isPromotional = promotionalPatterns.some(pattern =>
        pattern.test(email.subject) || pattern.test(email.body)
      );

      // Check for marketing-style sender patterns
      const marketingSenders = [
        /marketing@/i, /promo@/i, /deals@/i,
        /newsletter@/i, /offers@/i, /sales@/i
      ];

      const isMarketingSender = marketingSenders.some(pattern => pattern.test(email.from));

      if (isPromotional || isMarketingSender) {
        return {
          shouldProcess: false,
          priority: 'low',
          category: EmailCategory.PROMOTIONAL,
          reasoning: 'Detected promotional/marketing content',
          confidence: 0.8
        };
      }

      return { shouldProcess: true, priority: 'medium', category: EmailCategory.GENERAL, reasoning: '', confidence: 0 };
    }
  };

  /**
   * Check if sender appears suspicious
   */
  private isSuspiciousSender(from: string): boolean {
    const suspiciousPatterns = [
      /[0-9]{5,}@/i, // Long numbers in email
      /random[a-z0-9]{10,}@/i, // Random strings
      /temp.*@/i, /temporary.*@/i, // Temporary emails
      /\.tk$|\.ml$|\.ga$/i, // Suspicious TLDs
      /[a-z]{1}[0-9]{5,}@/i // Single letter + numbers
    ];

    return suspiciousPatterns.some(pattern => pattern.test(from));
  }

  /**
   * Get filter statistics for monitoring
   */
  getFilterStats(): any {
    return {
      categories: Object.values(EmailCategory),
      priorities: ['high', 'medium', 'low', 'ignore'],
      filterTypes: ['spam', 'notifications', 'meetings', 'urgent', 'promotional']
    };
  }
} 