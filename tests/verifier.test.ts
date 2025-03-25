import IntegrityVerifier from '../src/verifier';
import fs from 'fs-extra';
import path from 'path';

describe('IntegrityVerifier', () => {
  let verifier: IntegrityVerifier;
  let testFile: string;
  let testDir: string;

  beforeEach(async () => {
    verifier = new IntegrityVerifier();
    testDir = path.join(__dirname, 'tmp');
    await fs.ensureDir(testDir);
    testFile = path.join(testDir, 'test.backup');
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should calculate checksum correctly', async () => {
    await fs.writeFile(testFile, 'test data');
    const checksum = await verifier.calculateChecksum(testFile);
    
    expect(checksum).toBeDefined();
    expect(checksum.length).toBe(64); // sha256 hash length
  });

  test('should verify backup successfully', async () => {
    await fs.writeFile(testFile, 'backup content');
    
    const result = await verifier.verifyBackup(testFile);
    
    expect(result.valid).toBe(true);
    expect(result.checksum).toBeDefined();
    expect(result.size).toBeGreaterThan(0);
  });

  test('should fail verification for non-existent file', async () => {
    const result = await verifier.verifyBackup('/non/existent/file.backup');
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('File not found');
  });

  test('should verify checksum against stored value', async () => {
    await fs.writeFile(testFile, 'content to verify');
    const checksum = await verifier.calculateChecksum(testFile);
    await fs.writeFile(`${testFile}.sha256`, checksum);
    
    const isValid = await verifier.verifyChecksum(testFile);
    
    expect(isValid).toBe(true);
  });

  test('should detect checksum mismatch', async () => {
    await fs.writeFile(testFile, 'original content');
    await fs.writeFile(`${testFile}.sha256`, 'wrong_checksum');
    
    const isValid = await verifier.verifyChecksum(testFile);
    
    expect(isValid).toBe(false);
  });
});
