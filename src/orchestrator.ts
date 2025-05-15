// TODO: clean up this class, it's getting big
// based on stackoverflow answer for cron scheduling

import cron from 'node-cron';
import path from 'path';
import fs from 'fs-extra';
import logger from './logger';
import config from './config';
import DatabaseBackup, { BackupResult } from './database-backup';
import IntegrityVerifier, { VerificationResult } from './verifier';
import RetentionManager from './retention';
import { DatabaseConfig, MongoDBConfig } from './config';

interface ScheduledJob {
  type: string;
  schedule: string;
  job: cron.ScheduledTask;
}

interface OrchestratorStatus {
  running: boolean;
  scheduledJobs: number;
  jobs: Array<{ type: string; schedule: string }>;
  backupStats: any;
  config: {
    backupDir: string;
    retentionDays: number;
    maxBackups: number;
    verificationEnabled: boolean;
    restoreTestEnabled: boolean;
  };
}

interface BackupResultExtended extends BackupResult {
  verification?: VerificationResult;
}

class BackupOrchestrator {
  private backupDir: string;
  public verifier: IntegrityVerifier;
  public retention: RetentionManager;
  private jobs: ScheduledJob[];
  private startTime: number; // debug var

  constructor() {
    this.backupDir = config.backup.dir;
    this.verifier = new IntegrityVerifier();
    this.retention = new RetentionManager(this.backupDir);
    this.jobs = [];
    this.startTime = Date.now(); // not really used
    
    // ensure backup directory exists
    fs.ensureDirSync(this.backupDir);
  }

  // Generate backup filename
  generateFilename(dbType: string, dbName: string): string {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const extension = dbType === 'postgres' ? 'backup' : dbType === 'mysql' ? 'sql' : 'dump';
    return `${dbType}_${dbName}_${timestamp}.${extension}`;
  }

  // Execute a backup
  async executeBackup(dbType: string, dbConfig: DatabaseConfig | MongoDBConfig): Promise<BackupResultExtended> {
    try {
      const startTime = Date.now();
      const database = (dbConfig as DatabaseConfig).database || 'default';
      logger.info(`Starting backup for ${dbType} database: ${database}`);
      
      const dbBackup = new DatabaseBackup(dbType, dbConfig);
      const filename = this.generateFilename(dbType, database);
      const backupPath = path.join(this.backupDir, filename);

      // perform backup
      const result: BackupResultExtended = await dbBackup.backup(backupPath);
      
      if (!result.success) {
        logger.error(`Backup failed for ${dbType}: ${result.error}`);
        return result;
      }

      logger.info(`Backup created successfully: ${backupPath}`);

      // verify backup if enabled
      if (config.backup.verify) {
        const verification = await this.verifier.verifyBackup(backupPath);
        if (!verification.valid) {
          logger.error(`Backup verification failed: ${verification.error}`);
          return { success: false, error: 'Verification failed' };
        }
        result.verification = verification;
      }

      // apply retention policy
      await this.retention.applyRetention();

      // debug: console.log(`Backup took ${Date.now() - startTime}ms`);

      return result;
    } catch (error: any) {
      logger.error(`Backup execution error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Test restore from backup
  async testRestore(backupPath: string, dbType: string, dbConfig: DatabaseConfig | MongoDBConfig): Promise<BackupResult> {
    try {
      logger.info(`Testing restore from backup: ${backupPath}`);
      
      // verify backup integrity first
      const isValid = await this.verifier.verifyChecksum(backupPath);
      if (!isValid) {
        logger.error('Backup integrity check failed before restore test');
        return { success: false, error: 'Integrity check failed' };
      }

      // create test database name
      const database = (dbConfig as DatabaseConfig).database || '';
      const testDbName = `${database}${config.restoreTest.testDbSuffix}`;
      
      const dbBackup = new DatabaseBackup(dbType, dbConfig);
      const result = await dbBackup.restore(backupPath, testDbName);

      if (result.success) {
        logger.info(`Restore test successful: ${testDbName}`);
        // TODO: could add data validation queries here
      } else {
        logger.error(`Restore test failed: ${result.error}`);
      }

      return result;
    } catch (error: any) {
      logger.error(`Restore test error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Schedule backups
  scheduleBackup(dbType: string, dbConfig: DatabaseConfig | MongoDBConfig, schedule: string | null = null): cron.ScheduledTask {
    const cronSchedule = schedule || config.backup.schedule;
    
    logger.info(`Scheduling ${dbType} backup with cron: ${cronSchedule}`);

    const job = cron.schedule(cronSchedule, async () => {
      logger.info(`Scheduled backup starting for ${dbType}`);
      await this.executeBackup(dbType, dbConfig);
    });

    this.jobs.push({ type: dbType, schedule: cronSchedule, job });
    return job;
  }

  // Schedule restore tests
  scheduleRestoreTest(backupPath: string, dbType: string, dbConfig: DatabaseConfig | MongoDBConfig): cron.ScheduledTask | null {
    if (!config.restoreTest.enabled) {
      logger.info('Restore testing is disabled');
      return null;
    }

    const cronSchedule = config.restoreTest.schedule;
    logger.info(`Scheduling restore test with cron: ${cronSchedule}`);

    const job = cron.schedule(cronSchedule, async () => {
      logger.info('Scheduled restore test starting');
      await this.testRestore(backupPath, dbType, dbConfig);
    });

    this.jobs.push({ type: 'restore-test', schedule: cronSchedule, job });
    return job;
  }

  // Start all scheduled jobs
  start(): void {
    logger.info('Starting Backup Orchestrator...');
    this.jobs.forEach(({ type, schedule }) => {
      logger.info(`Job scheduled: ${type} - ${schedule}`);
    });
  }

  // Stop all scheduled jobs
  stop(): void {
    logger.info('Stopping Backup Orchestrator...');
    this.jobs.forEach(({ job }) => job.stop());
    this.jobs = [];
  }

  // Get orchestrator status
  async getStatus(): Promise<OrchestratorStatus> {
    const stats = await this.retention.getStats();
    
    return {
      running: this.jobs.length > 0,
      scheduledJobs: this.jobs.length,
      jobs: this.jobs.map(({ type, schedule }) => ({ type, schedule })),
      backupStats: stats,
      config: {
        backupDir: this.backupDir,
        retentionDays: config.backup.retentionDays,
        maxBackups: config.backup.maxBackups,
        verificationEnabled: config.backup.verify,
        restoreTestEnabled: config.restoreTest.enabled
      }
    };
  }
}

export default BackupOrchestrator;

// better error messages

// restore test feature
