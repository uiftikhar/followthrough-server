import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService {
  private baseStoragePath: string;
  private transcriptsPath: string;
  private meetingsPath: string;
  private teamsPath: string;
  private resultsPath: string;
  private sessionsPath: string;
  private memoryPath: string;

  constructor(private readonly configService: ConfigService) {
    // Initialize paths
    this.initializePaths();
    // Ensure storage directories exist
    this.initializeStorageFolders();
  }

  private initializePaths(): void {
    // Get base storage path from config
    this.baseStoragePath =
      this.configService.get<string>('STORAGE_PATH') || './data/file-storage';

    // Define all subdirectories
    this.transcriptsPath = path.join(this.baseStoragePath, 'transcripts');
    this.meetingsPath = path.join(this.baseStoragePath, 'meetings');
    this.teamsPath = path.join(this.baseStoragePath, 'teams');
    this.resultsPath = path.join(this.baseStoragePath, 'results');
    this.sessionsPath = path.join(this.baseStoragePath, 'sessions');
    this.memoryPath = path.join(this.baseStoragePath, 'memory');
  }

  private async initializeStorageFolders(): Promise<void> {
    // Create all required directories
    await this.ensureDir(this.baseStoragePath);
    await this.ensureDir(this.transcriptsPath);
    await this.ensureDir(this.meetingsPath);
    await this.ensureDir(this.teamsPath);
    await this.ensureDir(this.resultsPath);
    await this.ensureDir(this.sessionsPath);
    await this.ensureDir(this.memoryPath);
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async saveFile(filePath: string, content: string | Buffer): Promise<void> {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, which is fine for delete operation
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async listFiles(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.ensureDir(dirPath);
        return [];
      }
      throw error;
    }
  }

  getTranscriptsPath(): string {
    return this.transcriptsPath;
  }

  getMeetingsPath(): string {
    return this.meetingsPath;
  }

  getTeamsPath(): string {
    return this.teamsPath;
  }

  getResultsPath(): string {
    return this.resultsPath;
  }

  getSessionsPath(): string {
    return this.sessionsPath;
  }

  getMemoryPath(): string {
    return this.memoryPath;
  }
}
