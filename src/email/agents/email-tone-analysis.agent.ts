import { Injectable, Logger, Inject } from "@nestjs/common";
import { LLM_SERVICE } from "../../langgraph/llm/constants/injection-tokens";
import { LlmService } from "../../langgraph/llm/llm.service";
import { RAG_SERVICE } from "../../rag/constants/injection-tokens";
import { RagService } from "../../rag/rag.service";
import { VectorIndexes } from "../../pinecone/pinecone-index.service";
import {
  ToneFeatures,
  UserToneProfile,
  EmailToneAnalysisConfig,
} from "../dtos/email-triage.dto";

/**
 * EmailToneAnalysisAgent - Phase 3: Analyzes user communication patterns
 * Builds and maintains user tone profiles for personalized reply generation
 */
@Injectable()
export class EmailToneAnalysisAgent {
  private readonly logger = new Logger(EmailToneAnalysisAgent.name);

  private readonly config: EmailToneAnalysisConfig = {
    name: "Email Tone Analysis Agent",
    systemPrompt: `You are an AI specialized in analyzing communication tone and style patterns from emails.
    Extract detailed tone characteristics to build personalized user profiles for better communication matching.`,
    minSamplesForProfile: 3,
    maxSamplesAnalyzed: 50,
  };

  constructor(
    @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    @Inject(RAG_SERVICE) private readonly ragService: RagService,
  ) {}

  /**
   * Analyze a single email's tone characteristics
   */
  async extractToneFeatures(emailContent: string, metadata: any): Promise<ToneFeatures> {
    this.logger.log(`Extracting tone features from email: ${metadata.subject || 'No subject'}`);

    const prompt = `Analyze the communication tone and style of this email:

Subject: ${metadata.subject || 'No subject'}
From: ${metadata.from || 'Unknown'}
Content: ${emailContent}

Extract these tone characteristics:

1. **Formality**: very_formal, formal, casual, very_casual
2. **Warmth**: cold, neutral, warm, very_warm  
3. **Urgency**: relaxed, normal, urgent, critical
4. **Directness**: indirect, balanced, direct, very_direct
5. **Technical Level**: basic, intermediate, advanced, expert
6. **Emotional Tone**: neutral, empathetic, enthusiastic, concerned
7. **Response Length Preference**: brief, moderate, detailed, comprehensive
8. **Keywords**: Extract 5-10 characteristic words/phrases they use
9. **Signature Phrases**: Extract 3-5 unique phrases or expressions

Respond in JSON format:
{
  "formality": "formal|casual|etc",
  "warmth": "neutral|warm|etc", 
  "urgency": "normal|urgent|etc",
  "directness": "balanced|direct|etc",
  "technicalLevel": "intermediate|advanced|etc",
  "emotionalTone": "neutral|empathetic|etc",
  "responseLength": "moderate|detailed|etc",
  "keywords": ["word1", "word2", "word3"],
  "phrases": ["phrase1", "phrase2", "phrase3"]
}`;

    try {
      const model = this.llmService.getChatModel({
        temperature: 0.2,
        maxTokens: 400,
      });

      const response = await model.invoke([
        { role: "system", content: this.config.systemPrompt },
        { role: "user", content: prompt },
      ]);

      const content = response.content.toString();
      let parsedContent = content;

      // Extract JSON from response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       content.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        parsedContent = jsonMatch[1];
      }

      const toneFeatures = JSON.parse(parsedContent);
      this.logger.log(`Tone features extracted successfully`);
      return toneFeatures;
    } catch (error) {
      this.logger.error(`Failed to extract tone features: ${error.message}`);

      // Return default tone features
      return {
        formality: "formal",
        warmth: "neutral",
        urgency: "normal",
        directness: "balanced",
        technicalLevel: "intermediate",
        emotionalTone: "neutral",
        responseLength: "moderate",
        keywords: [],
        phrases: [],
      };
    }
  }

  /**
   * Analyze user's email history to build comprehensive tone profile
   */
  async analyzeUserTone(
    userId: string,
    userEmail: string,
    emailHistory: Array<{ content: string; metadata: any }>,
  ): Promise<UserToneProfile> {
    this.logger.log(`Building tone profile for user: ${userEmail}`);

    if (emailHistory.length < this.config.minSamplesForProfile) {
      this.logger.warn(`Insufficient email samples (${emailHistory.length}) for reliable tone profile`);
      return this.createDefaultToneProfile(userId, userEmail);
    }

    try {
      // Analyze tone features from multiple emails
      const toneAnalyses = await Promise.all(
        emailHistory.slice(0, this.config.maxSamplesAnalyzed).map(email =>
          this.extractToneFeatures(email.content, email.metadata)
        )
      );

      // Aggregate tone characteristics
      const aggregatedTone = this.aggregateToneFeatures(toneAnalyses);

      // Create priority-specific patterns
      const responsePatterns = await this.createResponsePatterns(emailHistory, toneAnalyses);

      // Extract common phrases and preferred tones
      const commonPhrases = this.extractCommonPhrases(toneAnalyses);
      const preferredTones = this.identifyPreferredTones(toneAnalyses);

      const profile: UserToneProfile = {
        userId,
        userEmail,
        communicationStyle: aggregatedTone,
        preferredTones,
        commonPhrases,
        responsePatterns,
        lastUpdated: new Date(),
        sampleCount: emailHistory.length,
        confidence: this.calculateProfileConfidence(emailHistory.length, toneAnalyses),
      };

      this.logger.log(`Tone profile created for ${userEmail} with ${profile.confidence.toFixed(2)} confidence`);
      return profile;
    } catch (error) {
      this.logger.error(`Failed to analyze user tone: ${error.message}`);
      return this.createDefaultToneProfile(userId, userEmail);
    }
  }

  /**
   * Store user tone profile in vector database for RAG retrieval
   */
  async storeToneProfile(profile: UserToneProfile): Promise<void> {
    try {
      this.logger.log(`Storing tone profile for user: ${profile.userEmail}`);

      const profileDocument = {
        id: `tone-profile-${profile.userId}`,
        content: this.createToneProfileContent(profile),
        metadata: {
          userId: profile.userId,
          userEmail: profile.userEmail,
          sampleCount: profile.sampleCount,
          confidence: profile.confidence,
          lastUpdated: profile.lastUpdated.toISOString(),
          type: "user_tone_profile",
          formality: profile.communicationStyle.formality,
          warmth: profile.communicationStyle.warmth,
          urgency: profile.communicationStyle.urgency,
          directness: profile.communicationStyle.directness,
        },
      };

      await this.ragService.processDocumentsForRag([profileDocument], {
        indexName: VectorIndexes.EMAIL_TRIAGE,
        namespace: "user-tone-profiles",
      });

      this.logger.log(`Tone profile stored successfully for ${profile.userEmail}`);
    } catch (error) {
      this.logger.error(`Failed to store tone profile: ${error.message}`);
    }
  }

  /**
   * Retrieve user tone profile for personalized reply generation
   */
  async getUserToneProfile(userEmail: string): Promise<UserToneProfile | undefined> {
    try {
      this.logger.log(`Retrieving tone profile for user: ${userEmail}`);

      const query = `User tone profile for email: ${userEmail}`;
      const results = await this.ragService.getContext(query, {
        indexName: VectorIndexes.EMAIL_TRIAGE,
        namespace: "user-tone-profiles",
        topK: 1,
        minScore: 0.8,
        filter: { type: "user_tone_profile", userEmail },
      });

      if (results.length > 0) {
        const profileData = results[0];
        this.logger.log(`Found tone profile for ${userEmail}`);
        return this.reconstructToneProfileFromRAG(profileData);
      }

      this.logger.log(`No tone profile found for ${userEmail}`);
      return undefined;
    } catch (error) {
      this.logger.error(`Failed to retrieve tone profile: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Helper: Aggregate tone features from multiple analyses
   */
  private aggregateToneFeatures(analyses: ToneFeatures[]): ToneFeatures {
    // Simple majority voting for categorical features
    const getMostCommon = (field: keyof ToneFeatures) => {
      const counts = analyses.reduce((acc, analysis) => {
        const value = analysis[field];
        if (typeof value === 'string') {
          acc[value] = (acc[value] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(counts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';
    };

    // Aggregate keywords and phrases
    const allKeywords = analyses.flatMap(a => a.keywords || []);
    const allPhrases = analyses.flatMap(a => a.phrases || []);

    return {
      formality: getMostCommon('formality') as any,
      warmth: getMostCommon('warmth') as any,
      urgency: getMostCommon('urgency') as any,
      directness: getMostCommon('directness') as any,
      technicalLevel: getMostCommon('technicalLevel') as any,
      emotionalTone: getMostCommon('emotionalTone') as any,
      responseLength: getMostCommon('responseLength') as any,
      keywords: [...new Set(allKeywords)].slice(0, 15),
      phrases: [...new Set(allPhrases)].slice(0, 10),
    };
  }

  /**
   * Helper: Create priority-specific response patterns
   */
  private async createResponsePatterns(
    emailHistory: Array<{ content: string; metadata: any }>,
    toneAnalyses: ToneFeatures[],
  ) {
    // For now, use the aggregated tone for all priorities
    // In a full implementation, we'd analyze emails by their implied priority
    const defaultPattern = this.aggregateToneFeatures(toneAnalyses);

    return {
      urgent: { ...defaultPattern, urgency: 'urgent' as const },
      normal: defaultPattern,
      low: { ...defaultPattern, urgency: 'relaxed' as const },
    };
  }

  /**
   * Helper: Extract most common phrases
   */
  private extractCommonPhrases(analyses: ToneFeatures[]): string[] {
    const allPhrases = analyses.flatMap(a => a.phrases || []);
    const phraseCounts = allPhrases.reduce((acc, phrase) => {
      acc[phrase] = (acc[phrase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(phraseCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([phrase]) => phrase);
  }

  /**
   * Helper: Identify preferred communication tones
   */
  private identifyPreferredTones(analyses: ToneFeatures[]): string[] {
    const tones = analyses.map(a => `${a.formality}-${a.warmth}-${a.emotionalTone}`);
    const uniqueTones = [...new Set(tones)];
    return uniqueTones.slice(0, 5);
  }

  /**
   * Helper: Calculate profile confidence based on sample size and consistency
   */
  private calculateProfileConfidence(sampleCount: number, analyses: ToneFeatures[]): number {
    const sampleConfidence = Math.min(sampleCount / 10, 1); // Max confidence at 10+ samples
    
    // Calculate consistency (simplified)
    const consistencyScore = analyses.length > 1 ? 0.8 : 0.5;
    
    return sampleConfidence * consistencyScore;
  }

  /**
   * Helper: Create default tone profile for new users
   */
  private createDefaultToneProfile(userId: string, userEmail: string): UserToneProfile {
    const defaultTone: ToneFeatures = {
      formality: "formal",
      warmth: "neutral",
      urgency: "normal",
      directness: "balanced",
      technicalLevel: "intermediate",
      emotionalTone: "neutral",
      responseLength: "moderate",
      keywords: [],
      phrases: [],
    };

    return {
      userId,
      userEmail,
      communicationStyle: defaultTone,
      preferredTones: ["formal-neutral-neutral"],
      commonPhrases: [],
      responsePatterns: {
        urgent: { ...defaultTone, urgency: 'urgent' },
        normal: defaultTone,
        low: { ...defaultTone, urgency: 'relaxed' },
      },
      lastUpdated: new Date(),
      sampleCount: 0,
      confidence: 0.3, // Low confidence for default profile
    };
  }

  /**
   * Helper: Create searchable content for tone profile storage
   */
  private createToneProfileContent(profile: UserToneProfile): string {
    return `User Tone Profile: ${profile.userEmail}

Communication Style:
- Formality: ${profile.communicationStyle.formality}
- Warmth: ${profile.communicationStyle.warmth}
- Urgency: ${profile.communicationStyle.urgency}
- Directness: ${profile.communicationStyle.directness}
- Technical Level: ${profile.communicationStyle.technicalLevel}
- Emotional Tone: ${profile.communicationStyle.emotionalTone}
- Response Length: ${profile.communicationStyle.responseLength}

Preferred Tones: ${profile.preferredTones.join(', ')}
Common Phrases: ${profile.commonPhrases.join(', ')}

Keywords: ${profile.communicationStyle.keywords.join(', ')}

Sample Count: ${profile.sampleCount}
Confidence: ${profile.confidence}
Last Updated: ${profile.lastUpdated.toISOString()}`;
  }

  /**
   * Reconstruct user tone profile from RAG data
   */
  async reconstructToneProfileFromRAG(profileData: any): Promise<UserToneProfile | undefined> {
    try {
      // Extract metadata from the RAG document
      const metadata = profileData.metadata || {};
      
      if (!metadata.userId || !metadata.userEmail) {
        this.logger.warn("Insufficient metadata to reconstruct tone profile");
        return undefined;
      }

      // Create default ToneFeatures structure
      const createToneFeatures = (overrides: Partial<ToneFeatures> = {}): ToneFeatures => ({
        formality: "formal",
        warmth: "neutral",
        urgency: "normal",
        directness: "balanced",
        technicalLevel: "intermediate",
        emotionalTone: "neutral",
        responseLength: "moderate",
        keywords: [],
        phrases: [],
        ...overrides,
      });

      // Reconstruct the tone profile from the stored data
      const toneProfile: UserToneProfile = {
        userId: metadata.userId,
        userEmail: metadata.userEmail,
        communicationStyle: createToneFeatures({
          formality: metadata.formality || "formal",
          warmth: metadata.warmth || "neutral",
          urgency: metadata.urgency || "normal",
          directness: metadata.directness || "balanced",
          keywords: this.extractKeywords(profileData.content),
          phrases: this.extractPhrases(profileData.content),
        }),
        preferredTones: this.extractPreferredTones(profileData.content),
        commonPhrases: this.extractPhrases(profileData.content),
        responsePatterns: {
          urgent: createToneFeatures({ 
            formality: "formal", 
            warmth: "neutral", 
            urgency: "urgent", 
            directness: "direct" 
          }),
          normal: createToneFeatures({ 
            formality: "formal", 
            warmth: "warm", 
            urgency: "normal", 
            directness: "balanced" 
          }),
          low: createToneFeatures({ 
            formality: "casual", 
            warmth: "warm", 
            urgency: "relaxed", 
            directness: "indirect" 
          }),
        },
        lastUpdated: new Date(metadata.lastUpdated || Date.now()),
        sampleCount: metadata.sampleCount || 1,
        confidence: metadata.confidence || 0.5,
      };

      return toneProfile;
    } catch (error) {
      this.logger.error(`Failed to reconstruct tone profile: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Extract preferred tones from profile content
   */
  private extractPreferredTones(content: string): string[] {
    // Simple extraction - in production, this would be more sophisticated
    const tones = ["professional", "friendly", "formal", "casual"];
    return tones.filter(tone => content.toLowerCase().includes(tone));
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was', 'with'];
    return words
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, 10); // Top 10 keywords
  }

  /**
   * Extract common phrases from content
   */
  private extractPhrases(content: string): string[] {
    // Simple phrase extraction - in production, this would use NLP
    const sentences = content.split(/[.!?]+/);
    return sentences
      .map(s => s.trim())
      .filter(s => s.length > 10 && s.length < 50)
      .slice(0, 5); // Top 5 phrases
  }
} 