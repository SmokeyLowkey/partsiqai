# PartsIQ Background Workers

This directory contains BullMQ workers for processing background jobs in the PartsIQ application.

## Workers

### 1. Parts Search Worker (`parts-search-worker.ts`)
- **Queue**: `parts-search`
- **Purpose**: Executes multi-agent parts search using PostgreSQL, Pinecone, and Neo4j
- **Concurrency**: 5 jobs
- **Rate Limit**: 10 jobs per 60 seconds
- **Triggers**: API calls from chat interface and search endpoints

**What it does:**
- Initializes multi-agent orchestrator
- Runs parallel search across all configured agents
- Formats results for UI display
- Saves results to conversation history

### 2. Email Monitor Worker (`email-monitor-worker.ts`)
- **Queue**: `email-monitor`
- **Purpose**: Monitors Gmail for new supplier emails
- **Concurrency**: 3 jobs
- **Rate Limit**: 5 jobs per 60 seconds (respects Gmail API limits)
- **Triggers**: Cron job (every 5 minutes)

**What it does:**
- Fetches new emails from Gmail API
- Parses email content to identify type (quote, order, etc.)
- Matches emails to suppliers by email address
- Creates/updates email threads
- Queues quote extraction jobs for quote emails
- Updates email sync state

### 3. Quote Extraction Worker (`quote-extraction-worker.ts`)
- **Queue**: `quote-extraction`
- **Purpose**: Extracts structured quote data from supplier emails using LLM
- **Concurrency**: 3 jobs
- **Rate Limit**: 10 jobs per 60 seconds
- **Triggers**: Email monitor worker when quote emails are detected

**What it does:**
- Uses LLM to extract quote information:
  - Quote number, total amount, currency
  - Line items (part number, description, quantity, price)
  - Payment terms, shipping method, notes
- Creates QuoteRequest and QuoteRequestItem records
- Updates email thread status to PROCESSED

## Running Workers

### Development
```bash
npm run workers:dev
```
This starts all workers with auto-reload on file changes.

### Production
```bash
npm run workers:start
```
This starts all workers in production mode.

## Architecture

```
┌─────────────────┐
│   Next.js App   │
│  (API Routes)   │
└────────┬────────┘
         │ Enqueue Jobs
         ▼
┌─────────────────┐
│  Upstash Redis  │
│  (Job Queues)   │
└────────┬────────┘
         │ Process Jobs
         ▼
┌─────────────────┐
│     Workers     │
│  (This Process) │
└────────┬────────┘
         │ Store Results
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   (Database)    │
└─────────────────┘
```

## Environment Variables

Required for workers to function:

```bash
# Upstash Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Database
DATABASE_URL=postgresql://...

# Credentials Encryption
CREDENTIALS_ENCRYPTION_KEY=...

# Gmail OAuth (stored per-org in database)
GMAIL_OAUTH_REDIRECT_URI=http://localhost:3000/api/integrations/gmail/callback
```

## Job Queue Database Records

All jobs are tracked in the `JobQueue` table:

```prisma
model JobQueue {
  id             String    @id @default(cuid())
  jobId          String    @unique
  queueName      String
  jobType        String
  status         JobStatus
  organizationId String
  data           Json?
  result         Json?
  error          String?
  attempts       Int
  startedAt      DateTime?
  completedAt    DateTime?
  failedAt       DateTime?
}
```

## Monitoring

Workers log extensively to help with debugging:

```
[Parts Search] Job abc123 started processing
[Parts Search] Job abc123 progress: 50%
[Parts Search] Job abc123 completed
```

Health checks run every 5 minutes showing uptime.

## Graceful Shutdown

Workers handle shutdown signals gracefully:

```bash
# Stop workers
Ctrl+C  # or kill -TERM <pid>
```

This will:
1. Stop accepting new jobs
2. Finish processing current jobs
3. Close connections
4. Exit cleanly

## Error Handling

- Failed jobs are automatically retried (max 3 attempts by default)
- Errors are logged and stored in database
- Failed jobs remain in queue for inspection
- Workers continue processing other jobs on failure

## Deployment

### Option 1: Separate Process (Recommended)
Run workers as a separate long-running process:

```bash
# Using PM2
pm2 start npm --name "partsiq-workers" -- run workers:start

# Using systemd
systemctl start partsiq-workers
```

### Option 2: Docker Container
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

CMD ["npm", "run", "workers:start"]
```

### Option 3: Serverless Workers
For serverless deployments, consider:
- AWS Lambda with EventBridge triggers
- Google Cloud Functions with Pub/Sub
- Vercel Cron Jobs (for lightweight tasks)

Note: Background workers work best as long-running processes.

## Scaling

To handle more load:

1. **Increase Concurrency**: Edit worker files to increase `concurrency` setting
2. **Multiple Instances**: Run multiple worker processes
3. **Horizontal Scaling**: Deploy workers across multiple servers
4. **Queue Priority**: Implement job priorities for critical operations

## Troubleshooting

### Workers not processing jobs
- Check Redis connection: `UPSTASH_REDIS_REST_URL` and token
- Verify database connection
- Check worker logs for errors

### Jobs failing repeatedly
- Check organization has required credentials configured
- Verify API rate limits not exceeded
- Review job data in `JobQueue` table

### High memory usage
- Reduce concurrency settings
- Implement job timeouts
- Monitor for memory leaks in custom code

## Adding New Workers

1. Create new worker file: `workers/my-new-worker.ts`
2. Define queue and job processor
3. Add event handlers (completed, failed, etc.)
4. Import in `workers/index.ts`
5. Add to `workers` array
6. Test thoroughly before deploying

## API Integration

Workers are triggered by API routes:

```typescript
// Example: Queue a parts search job
import { partsSearchQueue } from '@/lib/queue/queues';

await partsSearchQueue.add('search', {
  organizationId: 'org_123',
  conversationId: 'conv_456',
  query: 'hydraulic pump',
});
```

## Related Files

- `/lib/queue/queues.ts` - Queue definitions
- `/lib/queue/types.ts` - Job data schemas
- `/lib/queue/connection.ts` - Redis connection
- `/app/api/parts/search/route.ts` - Parts search API
- `/app/api/cron/*` - Cron job triggers
