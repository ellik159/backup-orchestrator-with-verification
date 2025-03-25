import fs from 'fs-extra';
import path from 'path';
import logger from './logger';
import config from './config';

interface BackupFile {
  name: string;
  path: string;
  size: number;
  created: Date;
}

interface BackupStats {
  count: number;
  totalSize: number;
  totalSizeMB: string;
  oldest: Date | null;
  newest: Date | null;
  backups: Array<{
    name: string;
    sizeMB: string;
    created: Date;
  }>;
}

class RetentionManager {
  private backupDir: string;
  private retentionDays: number;
  private maxBackups: number;

  constructor(backupDir: string) {
    this.backupDir = backupDir;
    this.retentionDays = config.backup.retentionDays;
    this.maxBackups = config.backup.maxBackups;
  }

  // Get all backup files sorted by date
  async getBackupFiles(): Promise<BackupFile[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      
      // filter backup files only (not checksums)
      const backupFiles = files.filter(f => 
        !f.endsWith('.sha256') && 
        !f.endsWith('.log') &&
        (f.endsWith('.backup') || f.endsWith('.sql') || f.endsWith('.dump') || f.endsWith('.gz'))
      );

      // get file stats
      const fileStats = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.mtime
          };
        })
      );

      // sort by date descending (newest first)
      return fileStats.sort((a, b) => b.created.getTime() - a.created.getTime());
    } catch (error: any) {
      logger.error(`Error getting backup files: ${error.message}`);
      return [];
    }
  }

  // Apply retention policy
  async applyRetention(): Promise<number> {
    logger.info('Applying retention policy...');
    
    const backups = await this.getBackupFiles();
    const now = new Date();
    let deletedCount = 0;

    for (let i = 0; i < backups.length; i++) {
      const backup = backups[i];
      const ageInDays = (now.getTime() - backup.created.getTime()) / (1000 * 60 * 60 * 24);
      
      // Delete if older than retention period
      if (ageInDays > this.retentionDays) {
        await this.deleteBackup(backup.path);
        deletedCount++;
        continue;
      }

      // Delete if exceeds max backups count (keep newest)
      if (i >= this.maxBackups) {
        await this.deleteBackup(backup.path);
        deletedCount++;
      }
    }

    logger.info(`Retention policy applied. Deleted ${deletedCount} old backups.`);
    return deletedCount;
  }

  // Delete a backup and its checksum file
  async deleteBackup(backupPath: string): Promise<boolean> {
    try {
      logger.info(`Deleting old backup: ${backupPath}`);
      
      // delete backup file
      await fs.remove(backupPath);
      
      // delete checksum file if exists
      const checksumPath = `${backupPath}.sha256`;
      if (await fs.pathExists(checksumPath)) {
        await fs.remove(checksumPath);
      }

      return true;
    } catch (error: any) {
      logger.error(`Error deleting backup: ${error.message}`);
      return false;
    }
  }

  // Get backup statistics
  async getStats(): Promise<BackupStats> {
    const backups = await this.getBackupFiles();
    
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const oldest = backups.length > 0 ? backups[backups.length - 1].created : null;
    const newest = backups.length > 0 ? backups[0].created : null;

    return {
      count: backups.length,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      oldest,
      newest,
      backups: backups.map(b => ({
        name: b.name,
        sizeMB: (b.size / 1024 / 1024).toFixed(2),
        created: b.created
      }))
    };
  }
}

export default RetentionManager;
