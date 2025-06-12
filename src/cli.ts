#!/usr/bin/env node

import 'dotenv/config';
import logger from './logger';
import config from './config';
import BackupOrchestrator from './orchestrator';
import path from 'path';
import { DatabaseConfig, MongoDBConfig } from './config';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

async function backup(): Promise<void> {
  const dbType = args[1] || process.env.DB_TYPE || 'postgres';
  
  logger.info(`Running manual backup for ${dbType}`);
  
  const orchestrator = new BackupOrchestrator();
  let dbConfig: DatabaseConfig | MongoDBConfig;

  switch(dbType) {
    case 'postgres':
      dbConfig = config.databases.postgres;
      break;
    case 'mysql':
      dbConfig = config.databases.mysql;
      break;
    case 'mongodb':
      dbConfig = config.databases.mongodb;
      break;
    default:
      logger.error(`Unknown database type: ${dbType}`);
      process.exit(1);
  }

  const result = await orchestrator.executeBackup(dbType, dbConfig);
  
  if (result.success) {
    logger.info('Backup completed successfully');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } else {
    logger.error('Backup failed');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

async function restore(): Promise<void> {
  const backupFile = args[1];
  const dbType = args[2] || process.env.DB_TYPE || 'postgres';

  if (!backupFile) {
    logger.error('Usage: npm run restore <backup-file> [db-type]');
    process.exit(1);
  }

  const backupPath = path.isAbsolute(backupFile) 
    ? backupFile 
    : path.join(config.backup.dir, backupFile);

  logger.info(`Restoring from: ${backupPath}`);
  
  const orchestrator = new BackupOrchestrator();
  let dbConfig: DatabaseConfig | MongoDBConfig;

  switch(dbType) {
    case 'postgres':
      dbConfig = config.databases.postgres;
      break;
    case 'mysql':
      dbConfig = config.databases.mysql;
      break;
    case 'mongodb':
      dbConfig = config.databases.mongodb;
      break;
    default:
      logger.error(`Unknown database type: ${dbType}`);
      process.exit(1);
  }

  const result = await orchestrator.testRestore(backupPath, dbType, dbConfig);
  
  if (result.success) {
    logger.info('Restore completed successfully');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } else {
    logger.error('Restore failed');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

async function verify(): Promise<void> {
  const backupFile = args[1];

  if (!backupFile) {
    logger.error('Usage: npm run verify <backup-file>');
    process.exit(1);
  }

  const backupPath = path.isAbsolute(backupFile) 
    ? backupFile 
    : path.join(config.backup.dir, backupFile);

  logger.info(`Verifying: ${backupPath}`);
  
  const orchestrator = new BackupOrchestrator();
  const isValid = await orchestrator.verifier.verifyChecksum(backupPath);
  
  if (isValid) {
    logger.info('✓ Backup verification passed');
    process.exit(0);
  } else {
    logger.error('✗ Backup verification failed');
    process.exit(1);
  }
}

async function status(): Promise<void> {
  const orchestrator = new BackupOrchestrator();
  const statusResult = await orchestrator.getStatus();
  
  console.log('\n=== Backup Orchestrator Status ===\n');
  console.log(JSON.stringify(statusResult, null, 2));
  process.exit(0);
}

// Command router
async function main(): Promise<void> {
  switch(command) {
    case 'backup':
      await backup();
      break;
    case 'restore':
      await restore();
      break;
    case 'verify':
      await verify();
      break;
    case 'status':
      await status();
      break;
    default:
      console.log('Backup Orchestrator CLI');
      console.log('');
      console.log('Usage:');
      console.log('  npm run backup [db-type]           - Run manual backup');
      console.log('  npm run restore <file> [db-type]   - Restore from backup');
      console.log('  npm run verify <file>              - Verify backup integrity');
      console.log('  npm start                          - Start scheduled backups');
      console.log('');
      console.log('Database types: postgres, mysql, mongodb');
      process.exit(command ? 1 : 0);
  }
}

main().catch(error => {
  logger.error('CLI error:', error);
  process.exit(1);
});

// cleanup
