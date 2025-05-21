import { Injectable } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import * as path from 'path';

interface StateCheckpoint {
  id: string;
  state: unknown;
  timestamp: number;
}

@Injectable()
export class StateStorageService {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Save a state checkpoint to disk
   */
  async saveState(
    sessionId: string,
    checkpointId: string,
    state: unknown,
  ): Promise<void> {
    const checkpoint: StateCheckpoint = {
      id: checkpointId,
      state,
      timestamp: Date.now(),
    };

    const checkpointPath = this.getCheckpointPath(sessionId, checkpointId);
    await this.storageService.saveFile(
      checkpointPath,
      JSON.stringify(checkpoint),
    );
  }

  /**
   * Load a state checkpoint from disk
   */
  async loadState(sessionId: string, checkpointId: string): Promise<unknown> {
    const checkpointPath = this.getCheckpointPath(sessionId, checkpointId);

    if (await this.storageService.fileExists(checkpointPath)) {
      const data = await this.storageService.readFile(checkpointPath);
      const checkpoint = JSON.parse(data.toString()) as StateCheckpoint;
      return checkpoint.state;
    }

    return null;
  }

  /**
   * Delete a state checkpoint from disk
   */
  async deleteState(sessionId: string, checkpointId: string): Promise<void> {
    const checkpointPath = this.getCheckpointPath(sessionId, checkpointId);
    await this.storageService.deleteFile(checkpointPath);
  }

  /**
   * List all checkpoints for a session
   */
  async listCheckpoints(sessionId: string): Promise<string[]> {
    const sessionDir = path.join(
      this.storageService.getSessionsPath(),
      sessionId,
    );

    try {
      const files = await this.storageService.listFiles(sessionDir);
      return files
        .filter((file) => file.endsWith('.json'))
        .map((file) => path.basename(file, '.json'));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get the path for a checkpoint file
   */
  private getCheckpointPath(sessionId: string, checkpointId: string): string {
    return path.join(
      this.storageService.getSessionsPath(),
      sessionId,
      `${checkpointId}.json`,
    );
  }
}
