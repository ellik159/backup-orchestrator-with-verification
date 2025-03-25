import RetentionManager from '../src/retention';
import fs from 'fs-extra';
import path from 'path';

describe('RetentionManager', () => {
  let retention: RetentionManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, 'tmp-backups');
    await fs.ensureDir(testDir);
    retention = new RetentionManager(testDir);
    (retention as any).retentionDays = 7;
    (retention as any).maxBackups = 5;
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should get backup files correctly', async () => {
    // create some test backup files
    await fs.writeFile(path.join(testDir, 'backup1.backup'), 'data');
    await fs.writeFile(path.join(testDir, 'backup2.sql'), 'data');
    
    const files = await retention.getBackupFiles();
    
    expect(files.length).toBe(2);
    expect(files[0]).toHaveProperty('name');
    expect(files[0]).toHaveProperty('size');
  });

  test('should exclude checksum files', async () => {
    await fs.writeFile(path.join(testDir, 'backup.backup'), 'data');
    await fs.writeFile(path.join(testDir, 'backup.backup.sha256'), 'checksum');
    
    const files = await retention.getBackupFiles();
    
    expect(files.length).toBe(1);
    expect(files[0].name).toBe('backup.backup');
  });

  test('should get stats correctly', async () => {
    await fs.writeFile(path.join(testDir, 'test.backup'), 'test content');
    
    const stats = await retention.getStats();
    
    expect(stats.count).toBe(1);
    expect(stats.totalSize).toBeGreaterThan(0);
    expect(stats.backups.length).toBe(1);
  });

  test('should delete backup and checksum', async () => {
    const backupPath = path.join(testDir, 'test.backup');
    const checksumPath = `${backupPath}.sha256`;
    
    await fs.writeFile(backupPath, 'data');
    await fs.writeFile(checksumPath, 'checksum');
    
    await retention.deleteBackup(backupPath);
    
    expect(await fs.pathExists(backupPath)).toBe(false);
    expect(await fs.pathExists(checksumPath)).toBe(false);
  });
});
