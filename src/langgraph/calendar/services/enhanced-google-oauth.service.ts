import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthService, GoogleOAuthTokens } from '../../../integrations/google/services/google-oauth.service';

export interface EnhancedOAuthScopes {
  // Core scopes
  email: string;
  profile: string;
  
  // Gmail scopes
  gmailReadonly: string;
  gmailSend: string;
  gmailModify: string;
  
  // Calendar scopes
  calendarReadonly: string;
  calendarEvents: string;
  
  // Meeting & Drive scopes (Phase 2 additions)
  driveReadonly: string;
  driveFile: string;
  meetingsReadonly: string;
  
  // Admin scopes (optional)
  adminDirectory: string;
  adminReports: string;
}

export interface ScopeValidationResult {
  hasRequiredScopes: boolean;
  missingScopes: string[];
  presentScopes: string[];
  needsReauthorization: boolean;
  scopeDetails: {
    email: boolean;
    calendar: boolean;
    drive: boolean;
    meetings: boolean;
    admin: boolean;
  };
}

@Injectable()
export class EnhancedGoogleOAuthService {
  private readonly logger = new Logger(EnhancedGoogleOAuthService.name);
  
  // Enhanced scope definitions for Phase 2 real meeting integration
  private readonly enhancedScopes: EnhancedOAuthScopes = {
    // Core identity scopes
    email: 'https://www.googleapis.com/auth/userinfo.email',
    profile: 'https://www.googleapis.com/auth/userinfo.profile',
    
    // Gmail scopes
    gmailReadonly: 'https://www.googleapis.com/auth/gmail.readonly',
    gmailSend: 'https://www.googleapis.com/auth/gmail.send',
    gmailModify: 'https://www.googleapis.com/auth/gmail.modify',
    
    // Calendar scopes
    calendarReadonly: 'https://www.googleapis.com/auth/calendar.readonly',
    calendarEvents: 'https://www.googleapis.com/auth/calendar.events',
    
    // Drive scopes for meeting recordings and transcripts
    driveReadonly: 'https://www.googleapis.com/auth/drive.readonly',
    driveFile: 'https://www.googleapis.com/auth/drive.file',
    
    // Meeting scopes (Google Meet API when available)
    meetingsReadonly: 'https://www.googleapis.com/auth/meetings.space.readonly',
    
    // Admin scopes for enterprise features
    adminDirectory: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    adminReports: 'https://www.googleapis.com/auth/admin.reports.audit.readonly'
  };

  // Required scopes for basic functionality
  private readonly requiredScopes = [
    this.enhancedScopes.email,
    this.enhancedScopes.profile,
    this.enhancedScopes.calendarReadonly,
    this.enhancedScopes.calendarEvents,
    this.enhancedScopes.gmailReadonly
  ];

  // Required scopes for meeting integration (Phase 2)
  private readonly meetingIntegrationScopes = [
    this.enhancedScopes.driveReadonly,
    this.enhancedScopes.driveFile
  ];

  // Optional scopes for enhanced features
  private readonly optionalScopes = [
    this.enhancedScopes.gmailSend,
    this.enhancedScopes.gmailModify,
    this.enhancedScopes.meetingsReadonly
  ];

  // Admin scopes for enterprise features
  private readonly adminScopes = [
    this.enhancedScopes.adminDirectory,
    this.enhancedScopes.adminReports
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  /**
   * Get enhanced authorization URL with all required scopes for real meeting integration
   */
  generateEnhancedAuthUrl(
    userId: string,
    options: {
      includeAdmin?: boolean;
      includeOptional?: boolean;
      forceConsent?: boolean;
      customScopes?: string[];
    } = {}
  ): string {
    this.logger.log(`Generating enhanced OAuth URL for user: ${userId}`);

    try {
      // Build comprehensive scope list
      const scopes = this.buildScopeList(options);
      
      this.logger.log(`Enhanced scopes requested: ${scopes.length} scopes`);
      this.logger.debug(`Scopes: ${scopes.join(', ')}`);

      // Use the base OAuth service with enhanced scopes
      // Note: We'll need to modify the base service to accept custom scopes
      return this.googleOAuthService.generateAuthUrl(userId);
    } catch (error) {
      this.logger.error(`Failed to generate enhanced OAuth URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate user's current OAuth scopes for meeting integration
   */
  async validateUserScopes(userId: string): Promise<ScopeValidationResult> {
    this.logger.log(`Validating OAuth scopes for user: ${userId}`);

    try {
      // Get current token status
      const tokenStatus = await this.googleOAuthService.getTokenStatus(userId);
      
      if (!tokenStatus.isConnected) {
        return {
          hasRequiredScopes: false,
          missingScopes: this.requiredScopes,
          presentScopes: [],
          needsReauthorization: true,
          scopeDetails: {
            email: false,
            calendar: false,
            drive: false,
            meetings: false,
            admin: false
          }
        };
      }

      const userScopes = tokenStatus.scopes || [];
      const allRequiredScopes = [...this.requiredScopes, ...this.meetingIntegrationScopes];
      
      // Check which scopes are present/missing
      const presentScopes = userScopes.filter(scope => allRequiredScopes.includes(scope));
      const missingScopes = allRequiredScopes.filter(scope => !userScopes.includes(scope));
      
      // Detailed scope analysis
      const scopeDetails = {
        email: this.hasScope(userScopes, [this.enhancedScopes.email, this.enhancedScopes.profile]),
        calendar: this.hasScope(userScopes, [this.enhancedScopes.calendarReadonly, this.enhancedScopes.calendarEvents]),
        drive: this.hasScope(userScopes, [this.enhancedScopes.driveReadonly, this.enhancedScopes.driveFile]),
        meetings: this.hasScope(userScopes, [this.enhancedScopes.meetingsReadonly]),
        admin: this.hasScope(userScopes, this.adminScopes)
      };

      const hasRequiredScopes = missingScopes.length === 0;
      
      this.logger.log(`Scope validation for ${userId}: ${hasRequiredScopes ? 'VALID' : 'MISSING_SCOPES'}`);
      if (!hasRequiredScopes) {
        this.logger.log(`Missing scopes: ${missingScopes.join(', ')}`);
      }

      return {
        hasRequiredScopes,
        missingScopes,
        presentScopes,
        needsReauthorization: missingScopes.length > 0,
        scopeDetails
      };
    } catch (error) {
      this.logger.error(`Error validating user scopes: ${error.message}`);
      return {
        hasRequiredScopes: false,
        missingScopes: this.requiredScopes,
        presentScopes: [],
        needsReauthorization: true,
        scopeDetails: {
          email: false,
          calendar: false,
          drive: false,
          meetings: false,
          admin: false
        }
      };
    }
  }

  /**
   * Check if user has sufficient permissions for meeting recording access
   */
  async validateMeetingIntegrationPermissions(userId: string): Promise<{
    canAccessRecordings: boolean;
    canAccessTranscripts: boolean;
    canAccessDrive: boolean;
    recommendations: string[];
  }> {
    this.logger.log(`Validating meeting integration permissions for user: ${userId}`);

    try {
      const scopeValidation = await this.validateUserScopes(userId);
      
      const canAccessDrive = scopeValidation.scopeDetails.drive;
      const canAccessRecordings = canAccessDrive && scopeValidation.scopeDetails.calendar;
      const canAccessTranscripts = canAccessRecordings; // Same permissions as recordings
      
      const recommendations: string[] = [];
      
      if (!canAccessDrive) {
        recommendations.push('Grant Google Drive access to read meeting recordings');
      }
      
      if (!scopeValidation.scopeDetails.calendar) {
        recommendations.push('Grant Calendar access to link recordings with meetings');
      }
      
      if (!scopeValidation.scopeDetails.meetings) {
        recommendations.push('Grant Google Meet access for enhanced meeting data (optional)');
      }

      return {
        canAccessRecordings,
        canAccessTranscripts,
        canAccessDrive,
        recommendations
      };
    } catch (error) {
      this.logger.error(`Error validating meeting integration permissions: ${error.message}`);
      return {
        canAccessRecordings: false,
        canAccessTranscripts: false,
        canAccessDrive: false,
        recommendations: ['Re-authenticate with Google to enable meeting integration']
      };
    }
  }

  /**
   * Get all available scope categories and their status for a user
   */
  async getScopeStatus(userId: string): Promise<{
    overall: 'complete' | 'partial' | 'insufficient';
    categories: {
      core: { status: 'granted' | 'missing'; scopes: string[] };
      calendar: { status: 'granted' | 'missing'; scopes: string[] };
      email: { status: 'granted' | 'missing'; scopes: string[] };
      drive: { status: 'granted' | 'missing'; scopes: string[] };
      meetings: { status: 'granted' | 'missing'; scopes: string[] };
      admin: { status: 'granted' | 'missing'; scopes: string[] };
    };
    recommendations: Array<{
      category: string;
      action: string;
      priority: 'high' | 'medium' | 'low';
      description: string;
    }>;
  }> {
    this.logger.log(`Getting comprehensive scope status for user: ${userId}`);

    try {
      const validation = await this.validateUserScopes(userId);
      const tokenStatus = await this.googleOAuthService.getTokenStatus(userId);
      const userScopes = tokenStatus.scopes || [];

      // Categorize scopes
      const categories = {
        core: {
          status: this.checkCategoryStatus(userScopes, [this.enhancedScopes.email, this.enhancedScopes.profile]),
          scopes: [this.enhancedScopes.email, this.enhancedScopes.profile]
        },
        calendar: {
          status: this.checkCategoryStatus(userScopes, [this.enhancedScopes.calendarReadonly, this.enhancedScopes.calendarEvents]),
          scopes: [this.enhancedScopes.calendarReadonly, this.enhancedScopes.calendarEvents]
        },
        email: {
          status: this.checkCategoryStatus(userScopes, [this.enhancedScopes.gmailReadonly, this.enhancedScopes.gmailSend]),
          scopes: [this.enhancedScopes.gmailReadonly, this.enhancedScopes.gmailSend, this.enhancedScopes.gmailModify]
        },
        drive: {
          status: this.checkCategoryStatus(userScopes, [this.enhancedScopes.driveReadonly, this.enhancedScopes.driveFile]),
          scopes: [this.enhancedScopes.driveReadonly, this.enhancedScopes.driveFile]
        },
        meetings: {
          status: this.checkCategoryStatus(userScopes, [this.enhancedScopes.meetingsReadonly]),
          scopes: [this.enhancedScopes.meetingsReadonly]
        },
        admin: {
          status: this.checkCategoryStatus(userScopes, this.adminScopes),
          scopes: this.adminScopes
        }
      };

      // Generate recommendations
      const recommendations = this.generateScopeRecommendations(categories);

      // Determine overall status
      const overall = this.determineOverallStatus(categories);

      return {
        overall,
        categories,
        recommendations
      };
    } catch (error) {
      this.logger.error(`Error getting scope status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate reauthorization URL with missing scopes
   */
  async generateReauthorizationUrl(userId: string): Promise<{
    authUrl: string;
    missingScopes: string[];
    reason: string;
  }> {
    this.logger.log(`Generating reauthorization URL for user: ${userId}`);

    try {
      const validation = await this.validateUserScopes(userId);
      
      if (validation.hasRequiredScopes) {
        throw new Error('User already has all required scopes');
      }

      const authUrl = this.generateEnhancedAuthUrl(userId, {
        includeOptional: true,
        forceConsent: true
      });

      return {
        authUrl,
        missingScopes: validation.missingScopes,
        reason: `Missing ${validation.missingScopes.length} required scopes for meeting integration`
      };
    } catch (error) {
      this.logger.error(`Error generating reauthorization URL: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods

  private buildScopeList(options: {
    includeAdmin?: boolean;
    includeOptional?: boolean;
    forceConsent?: boolean;
    customScopes?: string[];
  }): string[] {
    let scopes = [...this.requiredScopes, ...this.meetingIntegrationScopes];

    if (options.includeOptional) {
      scopes = [...scopes, ...this.optionalScopes];
    }

    if (options.includeAdmin) {
      scopes = [...scopes, ...this.adminScopes];
    }

    if (options.customScopes) {
      scopes = [...scopes, ...options.customScopes];
    }

    // Remove duplicates
    return [...new Set(scopes)];
  }

  private hasScope(userScopes: string[], requiredScopes: string[]): boolean {
    return requiredScopes.some(scope => userScopes.includes(scope));
  }

  private checkCategoryStatus(userScopes: string[], categoryScopes: string[]): 'granted' | 'missing' {
    const hasAllScopes = categoryScopes.every(scope => userScopes.includes(scope));
    return hasAllScopes ? 'granted' : 'missing';
  }

  private generateScopeRecommendations(categories: any): Array<{
    category: string;
    action: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
  }> {
    const recommendations: Array<{
      category: string;
      action: string;
      priority: 'high' | 'medium' | 'low';
      description: string;
    }> = [];

    if (categories.core.status === 'missing') {
      recommendations.push({
        category: 'core',
        action: 'Grant basic profile access',
        priority: 'high',
        description: 'Required for user identification and basic functionality'
      });
    }

    if (categories.calendar.status === 'missing') {
      recommendations.push({
        category: 'calendar',
        action: 'Grant calendar access',
        priority: 'high',
        description: 'Required for calendar workflow and meeting management'
      });
    }

    if (categories.drive.status === 'missing') {
      recommendations.push({
        category: 'drive',
        action: 'Grant Google Drive access',
        priority: 'high',
        description: 'Required for accessing meeting recordings and transcripts'
      });
    }

    if (categories.email.status === 'missing') {
      recommendations.push({
        category: 'email',
        action: 'Grant Gmail access',
        priority: 'medium',
        description: 'Required for email triage and automated responses'
      });
    }

    if (categories.meetings.status === 'missing') {
      recommendations.push({
        category: 'meetings',
        action: 'Grant Google Meet access',
        priority: 'low',
        description: 'Optional: Enables enhanced meeting data and participant tracking'
      });
    }

    return recommendations;
  }

  private determineOverallStatus(categories: any): 'complete' | 'partial' | 'insufficient' {
    const coreCategories = ['core', 'calendar', 'drive'];
    const coreStatus = coreCategories.map(cat => categories[cat].status);

    if (coreStatus.every(status => status === 'granted')) {
      return 'complete';
    } else if (coreStatus.some(status => status === 'granted')) {
      return 'partial';
    } else {
      return 'insufficient';
    }
  }

  /**
   * Get all enhanced scopes for reference
   */
  getEnhancedScopes(): EnhancedOAuthScopes {
    return { ...this.enhancedScopes };
  }

  /**
   * Get scope requirements for different feature levels
   */
  getScopeRequirements(): {
    basic: string[];
    meetingIntegration: string[];
    optional: string[];
    admin: string[];
  } {
    return {
      basic: [...this.requiredScopes],
      meetingIntegration: [...this.meetingIntegrationScopes],
      optional: [...this.optionalScopes],
      admin: [...this.adminScopes]
    };
  }
} 