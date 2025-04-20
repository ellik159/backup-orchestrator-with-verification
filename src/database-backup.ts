import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger';
import { DatabaseConfig, MongoDBConfig } from './config';

const execPromise = promisify(exec);

export interface BackupResult {
  success: boolean;
  path?: string;
  database?: string;
  error?: string;
}

type DbConfig = DatabaseConfig | MongoDBConfig;

class DatabaseBackup {
  private type: string;
  private config: DbConfig;

  constructor(type: string, config: DbConfig) {
    this.type = type;
    this.config = config;
  }

  // Backup postgres database
  async backupPostgres(outputPath: string): Promise<BackupResult> {
    const config = this.config as DatabaseConfig;
    const { host, port, user, password, database } = config;
    
    logger.info(`Starting PostgreSQL backup: ${database}`);
    
    const env = {
      ...process.env,
      PGPASSWORD: password || ''
    };

    const command = `pg_dump -h ${host} -p ${port} -U ${user} -F c -b -v -f "${outputPath}" ${database}`;

    try {
      const { stdout, stderr } = await execPromise(command, { env });
      logger.info(`PostgreSQL backup completed: ${outputPath}`);
      if (stderr) logger.debug(stderr);
      return { success: true, path: outputPath };
    } catch (error: any) {
      logger.error(`PostgreSQL backup failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Backup MySQL database
  async backupMySQL(outputPath: string): Promise<BackupResult> {
    const config = this.config as DatabaseConfig;
    const { host, port, user, password, database } = config;
    
    logger.info(`Starting MySQL backup: ${database}`);
    // console.log('Debug:', outputPath);

    const command = `mysqldump -h ${host} -P ${port} -u ${user} -p${password} --single-transaction --routines --triggers ${database} > "${outputPath}"`;

    try {
      const { stdout, stderr } = await execPromise(command);
      logger.info(`MySQL backup completed: ${outputPath}`);
      return { success: true, path: outputPath };
    } catch (error: any) {
      logger.error(`MySQL backup failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Backup MongoDB database
  async backupMongoDB(outputPath: string): Promise<BackupResult> {
    const config = this.config as MongoDBConfig;
    const { uri } = config;
    
    logger.info(`Starting MongoDB backup`);

    const command = `mongodump --uri="${uri}" --archive="${outputPath}" --gzip`;

    try {
      const { stdout, stderr } = await execPromise(command);
      logger.info(`MongoDB backup completed: ${outputPath}`);
      return { success: true, path: outputPath };
    } catch (error: any) {
      logger.error(`MongoDB backup failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Main backup method
  async backup(outputPath: string): Promise<BackupResult> {
    switch (this.type) {
      case 'postgres':
        return await this.backupPostgres(outputPath);
      case 'mysql':
        return await this.backupMySQL(outputPath);
      case 'mongodb':
        return await this.backupMongoDB(outputPath);
      default:
        logger.error(`Unsupported database type: ${this.type}`);
        return { success: false, error: 'Unsupported database type' };
    }
  }

  // Restore postgres database
  async restorePostgres(backupPath: string, targetDb: string): Promise<BackupResult> {
    const config = this.config as DatabaseConfig;
    const { host, port, user, password } = config;
    
    logger.info(`Restoring PostgreSQL backup to: ${targetDb}`);
    
    const env = {
      ...process.env,
      PGPASSWORD: password || ''
    };

    // create target db if not exists
    const createDbCmd = `psql -h ${host} -p ${port} -U ${user} -tc "SELECT 1 FROM pg_database WHERE datname = '${targetDb}'" | grep -q 1 || psql -h ${host} -p ${port} -U ${user} -c "CREATE DATABASE ${targetDb}"`;
    
    try {
      await execPromise(createDbCmd, { env });
    } catch (error: any) {
      // db might already exist, continue
      logger.debug(`Database creation step: ${error.message}`);
    }

    const command = `pg_restore -h ${host} -p ${port} -U ${user} -d ${targetDb} -v "${backupPath}"`;

    try {
      const { stdout, stderr } = await execPromise(command, { env });
      logger.info(`PostgreSQL restore completed: ${targetDb}`);
      return { success: true, database: targetDb };
    } catch (error: any) {
      logger.error(`PostgreSQL restore failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Restore MySQL database
  async restoreMySQL(backupPath: string, targetDb: string): Promise<BackupResult> {
    const config = this.config as DatabaseConfig;
    const { host, port, user, password } = config;
    
    logger.info(`Restoring MySQL backup to: ${targetDb}`);

    // Create database if not exists
    const createDbCmd = `mysql -h ${host} -P ${port} -u ${user} -p${password} -e "CREATE DATABASE IF NOT EXISTS ${targetDb}"`;
    
    try {
      await execPromise(createDbCmd);
    } catch (error: any) {
      logger.debug(`Database creation step: ${error.message}`);
    }

    const command = `mysql -h ${host} -P ${port} -u ${user} -p${password} ${targetDb} < "${backupPath}"`;

    try {
      await execPromise(command);
      logger.info(`MySQL restore completed: ${targetDb}`);
      return { success: true, database: targetDb };
    } catch (error: any) {
      logger.error(`MySQL restore failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Restore MongoDB
  async restoreMongoDB(backupPath: string): Promise<BackupResult> {
    const config = this.config as MongoDBConfig;
    const { uri } = config;
    
    logger.info(`Restoring MongoDB backup`);

    const command = `mongorestore --uri="${uri}" --archive="${backupPath}" --gzip --drop`;

    try {
      await execPromise(command);
      logger.info(`MongoDB restore completed`);
      return { success: true };
    } catch (error: any) {
      logger.error(`MongoDB restore failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Main restore method
  async restore(backupPath: string, targetDb: string | null = null): Promise<BackupResult> {
    const config = this.config as DatabaseConfig;
    switch (this.type) {
      case 'postgres':
        return await this.restorePostgres(backupPath, targetDb || config.database || '');
      case 'mysql':
        return await this.restoreMySQL(backupPath, targetDb || config.database || '');
      case 'mongodb':
        return await this.restoreMongoDB(backupPath);
      default:
        logger.error(`Unsupported database type: ${this.type}`);
        return { success: false, error: 'Unsupported database type' };
    }
  }
}

export default DatabaseBackup;

// fix: added missing flag for postgres
