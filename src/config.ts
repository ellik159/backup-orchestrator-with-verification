// TODO: refactor this config mess
// started simple but grew over time

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database?: string;
}

export interface MongoDBConfig {
  uri: string;
}

export interface BackupConfig {
  dir: string;
  schedule: string;
  retentionDays: number;
  maxBackups: number;
  compression: boolean;
  verify: boolean;
}

export interface RestoreTestConfig {
  enabled: boolean;
  schedule: string;
  testDbSuffix: string;
}

export interface LoggingConfig {
  level: string;
  dir: string;
  maxFiles: number;
}

export interface Config {
  databases: {
    postgres: DatabaseConfig;
    mysql: DatabaseConfig;
    mongodb: MongoDBConfig;
  };
  backup: BackupConfig;
  restoreTest: RestoreTestConfig;
  logging: LoggingConfig;
}

// hack: using process.env directly here, should probably validate
const config: Config = {
  // Database configs
  databases: {
    postgres: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    },
    mysql: {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DB
    },
    mongodb: {
      uri: process.env.MONGO_URI || 'mongodb://localhost:27017'
    }
  },

  // Backup settings
  backup: {
    dir: process.env.BACKUP_DIR || './backups',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // 2am daily
    retentionDays: parseInt(process.env.RETENTION_DAYS || '30'),
    maxBackups: parseInt(process.env.MAX_BACKUPS || '10'),
    compression: true,
    verify: process.env.VERIFY_BACKUPS === 'true'
  },

  // Restore testing
  restoreTest: {
    enabled: process.env.AUTO_RESTORE_TEST === 'true',
    schedule: process.env.RESTORE_TEST_SCHEDULE || '0 4 * * 0', // sundays 4am
    testDbSuffix: '_restore_test'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
    maxFiles: 30
  }
};

// debug: console.log('config loaded:', config.backup.dir); // left from debugging

export default config;
