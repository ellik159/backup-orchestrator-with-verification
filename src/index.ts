import 'dotenv/config';
import logger from './logger';
import config from './config';
import BackupOrchestrator from './orchestrator';

async function main(): Promise<void> {
  logger.info('=== Backup Orchestrator Starting ===');
  logger.info(`Backup directory: ${config.backup.dir}`);
  logger.info(`Retention: ${config.backup.retentionDays} days / ${config.backup.maxBackups} max backups`);

  const orchestrator = new BackupOrchestrator();

  // Schedule backups based on environment config
  if (process.env.DB_TYPE === 'postgres' && process.env.DB_NAME) {
    logger.info('Scheduling PostgreSQL backups');
    orchestrator.scheduleBackup('postgres', config.databases.postgres);
  }

  if (process.env.MYSQL_DB) {
    logger.info('Scheduling MySQL backups');
    orchestrator.scheduleBackup('mysql', config.databases.mysql);
  }

  if (process.env.MONGO_URI) {
    logger.info('Scheduling MongoDB backups');
    orchestrator.scheduleBackup('mongodb', config.databases.mongodb);
  }

  // Start the orchestrator
  orchestrator.start();

  // Display status
  const status = await orchestrator.getStatus();
  logger.info('Orchestrator Status:', status);

  // Keep process running
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, stopping orchestrator...');
    orchestrator.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, stopping orchestrator...');
    orchestrator.stop();
    process.exit(0);
  });

  logger.info('Backup Orchestrator running. Press Ctrl+C to stop.');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
