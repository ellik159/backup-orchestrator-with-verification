# Backup Orchestrator 🔄

Automated backup system for PostgreSQL, MySQL, and MongoDB with integrity checks and restore testing. Started as a side project to learn more about database operations.

## What it does

Backs up databases on a schedule, verifies the backups actually work, and cleans up old ones. Pretty straightforward but took a while to get right.

## Quick Start

```bash
npm install
cp .env.example .env
# fill in your db creds

npm run build
npm start
```

Or run manually:
```bash
npm run backup postgres
npm run verify backup_file.backup
npm run restore backup_file.backup postgres
```

## Features
- PostgreSQL, MySQL, MongoDB support
- SHA256 checksums for integrity
- Retention policies (keep X days, max Y backups)
- Automatic restore testing (optional)
- CLI for manual operations

## How it Works

Runs daily at 2am (configurable):
1. Dumps database using native tools
2. Calculates checksum
3. Applies retention rules
4. Optionally tests restore

## Configuration

Edit `.env`:

```env
DB_TYPE=postgres
DB_HOST=localhost
DB_NAME=mydb
BACKUP_DIR=./backups
RETENTION_DAYS=30
MAX_BACKUPS=10
VERIFY_BACKUPS=true
```

## Architecture

```
src/
├── index.ts          # main entry with scheduler
├── cli.ts            # command line
├── orchestrator.ts   # main logic
├── database-backup.ts # db operations
├── verifier.ts       # checksums
├── retention.ts      # cleanup old backups
├── config.ts         # config
└── logger.ts         # logging
```

## Testing

```bash
npm test
```

Coverage is around 50-60% which is fine for this type of tool. Not testing actual database ops since that needs real DBs.

## TODO
- Add filesystem/volume backups
- Encryption support
- Email notifications
- S3/Azure remote storage
- Web dashboard maybe

## Notes

The restore testing was trickier than expected. Need to create temp databases and clean them up properly.

Retention logic took a few tries to get right - balancing age vs count limits.

Originally tried to do everything in memory but dumps get too big for that.

## Requirements
- Node.js 14+
- TypeScript
- Database tools: pg_dump, mysqldump, mongodump

## License
MIT

<!-- added installation instructions -->

<!-- added examples -->
