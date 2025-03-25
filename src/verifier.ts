import crypto from 'crypto';
import fs from 'fs-extra';
import logger from './logger';

export interface VerificationResult {
  valid: boolean;
  checksum?: string;
  size?: number;
  path?: string;
  error?: string;
}

class IntegrityVerifier {
  private checksumAlgorithm: string;

  constructor() {
    this.checksumAlgorithm = 'sha256';
  }

  // Calculate checksum of a file
  async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(this.checksumAlgorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  // Verify backup integrity
  async verifyBackup(backupPath: string): Promise<VerificationResult> {
    try {
      logger.info(`Verifying backup integrity: ${backupPath}`);
      
      // check file exists
      const exists = await fs.pathExists(backupPath);
      if (!exists) {
        logger.error(`Backup file not found: ${backupPath}`);
        return { valid: false, error: 'File not found' };
      }

      // check file size
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        logger.error(`Backup file is empty: ${backupPath}`);
        return { valid: false, error: 'Empty file' };
      }

      // calculate checksum
      const checksum = await this.calculateChecksum(backupPath);
      
      // store checksum alongside backup
      const checksumFile = `${backupPath}.sha256`;
      await fs.writeFile(checksumFile, checksum);

      logger.info(`Backup verified successfully: ${backupPath}`);
      logger.info(`Checksum: ${checksum}`);

      return {
        valid: true,
        checksum,
        size: stats.size,
        path: backupPath
      };
    } catch (error: any) {
      logger.error(`Error verifying backup: ${error.message}`);
      return { valid: false, error: error.message };
    }
  }

  // Verify checksum against stored value
  async verifyChecksum(backupPath: string): Promise<boolean> {
    try {
      const checksumFile = `${backupPath}.sha256`;
      const exists = await fs.pathExists(checksumFile);
      
      if (!exists) {
        logger.warn(`No checksum file found for: ${backupPath}`);
        return false;
      }

      const storedChecksum = (await fs.readFile(checksumFile, 'utf8')).trim();
      const currentChecksum = await this.calculateChecksum(backupPath);

      const valid = storedChecksum === currentChecksum;
      
      if (valid) {
        logger.info(`Checksum verification passed: ${backupPath}`);
      } else {
        logger.error(`Checksum mismatch for: ${backupPath}`);
        logger.error(`Expected: ${storedChecksum}, Got: ${currentChecksum}`);
      }

      return valid;
    } catch (error: any) {
      logger.error(`Error verifying checksum: ${error.message}`);
      return false;
    }
  }
}

export default IntegrityVerifier;
