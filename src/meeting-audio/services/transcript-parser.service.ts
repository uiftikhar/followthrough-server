import { Injectable, Logger } from '@nestjs/common';
import { MeetingTranscript, MeetingParticipant, ConversationSegment } from '../interfaces/meeting-transcript.interface';

@Injectable()
export class TranscriptParserService {
  private readonly logger = new Logger(TranscriptParserService.name);

  // Predefined voice assignments for common speaker names
  private readonly defaultVoiceAssignments = {
    // Male voices
    'Alex': 'pMsXgVXv3BLzUgSXRplE',
    'Markus': 'VR6AewLTigWG4xSOukaG',
    'Jamie': 'ErXwobaYiN019PkySvjV',
    'Jason': 'flq6f7yk4E4fJM5XTYuZ',
    'Marcus': 'VR6AewLTigWG4xSOukaG',
    'Adrian': 'pMsXgVXv3BLzUgSXRplE',
    'David': 'ErXwobaYiN019PkySvjV',
    'Ethan': 'flq6f7yk4E4fJM5XTYuZ',
    'Leo': 'VR6AewLTigWG4xSOukaG',
    'Michael': 'pMsXgVXv3BLzUgSXRplE',
    'Tom': 'ErXwobaYiN019PkySvjV',
    'Ravi': 'flq6f7yk4E4fJM5XTYuZ',
    
    // Female voices
    'Priya': 'EXAVITQu4vr4xnSDxMaL',
    'Sofia': 'MF3mGyEYCl7XYWbV9V6O',
    'Elena': 'pqHfZKP75CvOlQylNhV4',
    'Rachel': 'ThT5KcBeYPX3keUQqHPh',
    'Olivia': 'EXAVITQu4vr4xnSDxMaL',
    'Sophia': 'MF3mGyEYCl7XYWbV9V6O',
    'Maria': 'pqHfZKP75CvOlQylNhV4',
    'Emily': 'ThT5KcBeYPX3keUQqHPh',
    'Clara': 'EXAVITQu4vr4xnSDxMaL',
    'Julia': 'MF3mGyEYCl7XYWbV9V6O',
    'Fatima': 'pqHfZKP75CvOlQylNhV4',
    'Nina': 'ThT5KcBeYPX3keUQqHPh',
    'Samantha': 'EXAVITQu4vr4xnSDxMaL',
    'Mia': 'MF3mGyEYCl7XYWbV9V6O',
    'Aisha': 'pqHfZKP75CvOlQylNhV4',
    'Dimitri': 'ErXwobaYiN019PkySvjV' // Assuming male
  };

  /**
   * Parse raw transcript text into structured meeting data
   */
  async parseTranscript(
    transcriptText: string,
    meetingId: string,
    meetingType?: string
  ): Promise<MeetingTranscript> {
    this.logger.log(`Parsing transcript for meeting: ${meetingId}`);

    const lines = transcriptText.trim().split('\n').filter(line => line.trim());
    
    const segments: ConversationSegment[] = [];
    const speakerSet = new Set<string>();
    let currentTime = 5; // Start at 5 seconds

    for (const line of lines) {
      if (line.trim()) {
        const segment = this.parseTranscriptLine(line, currentTime);
        if (segment) {
          segments.push(segment);
          speakerSet.add(segment.speaker);
          currentTime += (segment.estimated_duration || 3) + (segment.pause_after || 1);
        }
      }
    }

    const participants = this.createParticipants(Array.from(speakerSet));
    const inferredMeetingType = meetingType || this.inferMeetingType(transcriptText);

    const meetingTranscript: MeetingTranscript = {
      meeting_id: meetingId,
      meeting_type: inferredMeetingType as any,
      duration_estimate: currentTime,
      participants,
      conversation_segments: segments,
      metadata: {
        generated_at: new Date(),
        total_speakers: participants.length,
      }
    };

    this.logger.log(`Parsed transcript: ${segments.length} segments, ${participants.length} speakers, ~${Math.round(currentTime/60)} minutes`);
    return meetingTranscript;
  }

  /**
   * Parse a single line of transcript
   */
  private parseTranscriptLine(line: string, timestamp: number): ConversationSegment | null {
    // Match patterns like [Speaker]: text or Speaker: text
    const speakerMatch = line.match(/^\[?([^\]]+)\]?:\s*(.+)$/);
    if (!speakerMatch) {
      return null;
    }

    const [, speaker, text] = speakerMatch;
    const cleanSpeaker = this.cleanSpeakerName(speaker);
    const cleanText = text.trim();

    if (!cleanText) {
      return null;
    }

    const wordCount = cleanText.split(/\s+/).length;
    const speakingTime = this.estimateSpeakingTime(wordCount);
    
    return {
      timestamp: this.formatTimestamp(timestamp),
      speaker: cleanSpeaker,
      text: cleanText,
      emotion: this.detectEmotion(cleanText),
      pace: this.detectPace(cleanText),
      pause_after: this.calculatePause(cleanText, speakingTime),
      word_count: wordCount,
      estimated_duration: speakingTime
    };
  }

  /**
   * Clean and normalize speaker names
   */
  private cleanSpeakerName(speaker: string): string {
    // Remove any role information in parentheses
    return speaker.replace(/\s*\([^)]*\)/, '').trim();
  }

  /**
   * Estimate speaking time based on word count (150 words per minute average)
   */
  private estimateSpeakingTime(wordCount: number): number {
    const wordsPerMinute = 150;
    return Math.max(1, Math.round((wordCount / wordsPerMinute) * 60));
  }

  /**
   * Detect emotion from text content
   */
  private detectEmotion(text: string): ConversationSegment['emotion'] {
    const lowerText = text.toLowerCase();
    
    if (this.containsWords(lowerText, ['urgent', 'critical', 'problem', 'error', 'bug', 'issue', 'broken'])) {
      return 'concerned';
    }
    if (this.containsWords(lowerText, ['great', 'excellent', 'perfect', 'awesome', 'fantastic', 'love'])) {
      return 'positive';
    }
    if (this.containsWords(lowerText, ['excited', 'amazing', 'incredible', 'wonderful'])) {
      return 'excited';
    }
    if (text.includes('?')) {
      return 'questioning';
    }
    
    return 'neutral';
  }

  /**
   * Detect speaking pace from text content
   */
  private detectPace(text: string): ConversationSegment['pace'] {
    const lowerText = text.toLowerCase();
    
    if (this.containsWords(lowerText, ['quickly', 'urgent', 'immediate', 'asap', 'right now'])) {
      return 'fast';
    }
    if (this.containsWords(lowerText, ['let me think', 'well', 'hmm', 'uh', 'so...', 'actually...'])) {
      return 'slow';
    }
    
    return 'normal';
  }

  /**
   * Calculate natural pause after speaking
   */
  private calculatePause(text: string, speakingTime: number): number {
    // Question gets longer pause for response
    if (text.includes('?')) {
      return Math.min(2.5, Math.max(1.5, speakingTime * 0.3));
    }
    
    // Statement ending with period gets medium pause
    if (text.endsWith('.')) {
      return Math.min(1.5, Math.max(0.8, speakingTime * 0.2));
    }
    
    // Comma or continuation gets short pause
    if (text.includes(',') || text.endsWith('...')) {
      return Math.min(1.0, Math.max(0.3, speakingTime * 0.1));
    }
    
    // Default pause
    return Math.min(1.2, Math.max(0.5, speakingTime * 0.15));
  }

  /**
   * Format timestamp as MM:SS
   */
  private formatTimestamp(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Create participant objects from speaker names
   */
  private createParticipants(speakers: string[]): MeetingParticipant[] {
    return speakers.map(speaker => ({
      name: speaker,
      role: this.inferRole(speaker),
      voice_id: this.assignVoice(speaker),
      gender: this.inferGender(speaker),
      personality: this.inferPersonality(speaker)
    }));
  }

  /**
   * Infer role from speaker name context (basic implementation)
   */
  private inferRole(speaker: string): string {
    // This could be enhanced with more sophisticated role detection
    const roleKeywords = {
      'lead': ['Lead', 'Manager', 'PM'],
      'developer': ['Dev', 'Engineer'],
      'designer': ['UX', 'UI', 'Design'],
      'qa': ['QA', 'Test'],
      'product': ['Product']
    };

    for (const [role, keywords] of Object.entries(roleKeywords)) {
      if (keywords.some(keyword => speaker.includes(keyword))) {
        return role;
      }
    }

    return 'Team Member';
  }

  /**
   * Assign voice ID to speaker
   */
  private assignVoice(speaker: string): string {
    return this.defaultVoiceAssignments[speaker] || this.getRandomVoice();
  }

  /**
   * Infer gender from name (basic implementation)
   */
  private inferGender(speaker: string): 'male' | 'female' {
    const femaleNames = ['Priya', 'Sofia', 'Elena', 'Rachel', 'Olivia', 'Sophia', 'Maria', 'Emily', 'Clara', 'Julia', 'Fatima', 'Nina', 'Samantha', 'Mia', 'Aisha'];
    return femaleNames.includes(speaker) ? 'female' : 'male';
  }

  /**
   * Infer personality from role and context
   */
  private inferPersonality(speaker: string): string {
    const role = this.inferRole(speaker);
    const personalityMap = {
      'Lead': 'authoritative, collaborative',
      'Manager': 'organized, decisive',
      'developer': 'technical, detail-oriented',
      'designer': 'creative, user-focused',
      'qa': 'analytical, thorough',
      'product': 'strategic, business-focused'
    };

    return personalityMap[role] || 'professional, collaborative';
  }

  /**
   * Infer meeting type from content
   */
  private inferMeetingType(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (this.containsWords(lowerText, ['bug', 'error', 'fix', 'issue', 'problem'])) {
      return 'bug_triage';
    }
    if (this.containsWords(lowerText, ['design', 'ux', 'ui', 'mockup', 'prototype'])) {
      return 'design_review';
    }
    if (this.containsWords(lowerText, ['sprint', 'backlog', 'story', 'epic', 'scrum'])) {
      return 'sprint_planning';
    }
    if (this.containsWords(lowerText, ['product', 'feature', 'rollout', 'launch', 'pdp'])) {
      return 'product_planning';
    }
    if (this.containsWords(lowerText, ['refinement', 'grooming', 'estimate'])) {
      return 'cross_team_refinement';
    }
    
    return 'general_meeting';
  }

  /**
   * Get random voice for unassigned speakers
   */
  private getRandomVoice(): string {
    const voices = Object.values(this.defaultVoiceAssignments);
    return voices[Math.floor(Math.random() * voices.length)];
  }

  /**
   * Check if text contains any of the given words
   */
  private containsWords(text: string, words: string[]): boolean {
    return words.some(word => text.includes(word.toLowerCase()));
  }
} 