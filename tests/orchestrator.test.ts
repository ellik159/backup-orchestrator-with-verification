import BackupOrchestrator from '../src/orchestrator';

describe('BackupOrchestrator', () => {
  let orchestrator: BackupOrchestrator;

  beforeEach(() => {
    orchestrator = new BackupOrchestrator();
  });

  test('should initialize correctly', () => {
    expect(orchestrator).toBeDefined();
    expect((orchestrator as any).backupDir).toBeDefined();
    expect(orchestrator.verifier).toBeDefined();
    expect(orchestrator.retention).toBeDefined();
  });

  test('should generate correct filename', () => {
    const filename = orchestrator.generateFilename('postgres', 'mydb');
    
    expect(filename).toContain('postgres_mydb_');
    expect(filename).toContain('.backup');
  });

  test('should get status', async () => {
    const status = await orchestrator.getStatus();
    
    expect(status).toHaveProperty('running');
    expect(status).toHaveProperty('scheduledJobs');
    expect(status).toHaveProperty('backupStats');
    expect(status).toHaveProperty('config');
  });

  // note: not testing actual db backups as they require real db connections
  // this is good enough coverage for a personal project
});
