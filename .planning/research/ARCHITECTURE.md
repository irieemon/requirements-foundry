# Architecture Patterns

**Domain:** Internal corporate Next.js application on AWS ECS Fargate
**Researched:** 2026-03-05
**Overall confidence:** HIGH

## Recommended Architecture

### Network Topology: Internal-Only VPC with Private Subnets + NAT

```
Corporate Network (VPN/DirectConnect)
        |
        v
+-----------------------------------------------+
|  VPC: 10.0.0.0/16  (us-east-1)               |
|                                                |
|  +-- Private Subnets (Application) ----------+ |
|  |  10.0.1.0/24 (us-east-1a)                 | |
|  |  10.0.2.0/24 (us-east-1b)                 | |
|  |                                             | |
|  |  [Internal ALB] <-- corporate traffic       | |
|  |       |                                     | |
|  |       v                                     | |
|  |  [ECS Fargate Service]                      | |
|  |    Task 1 (Next.js container)               | |
|  |    Task 2 (Next.js container)               | |
|  |       |          |           |              | |
|  |       v          v           v              | |
|  |   [RDS PG]   [S3 Endpt]  [Bedrock Endpt]   | |
|  +---------------------------------------------+ |
|                                                |
|  +-- Private Subnets (Database) -------------+ |
|  |  10.0.3.0/24 (us-east-1a)                 | |
|  |  10.0.4.0/24 (us-east-1b)                 | |
|  |                                             | |
|  |  [RDS PostgreSQL]                           | |
|  +---------------------------------------------+ |
|                                                |
|  +-- Private Subnets (NAT/Egress) -----------+ |
|  |  10.0.5.0/24 (us-east-1a)                 | |
|  |                                             | |
|  |  [NAT Gateway] --> Internet Gateway         | |
|  |  (for ECR pulls, npm, external APIs)        | |
|  +---------------------------------------------+ |
+-----------------------------------------------+

VPC Endpoints (PrivateLink):
  - com.amazonaws.us-east-1.s3 (Gateway - FREE)
  - com.amazonaws.us-east-1.bedrock-runtime (Interface)
  - com.amazonaws.us-east-1.ecr.api (Interface)
  - com.amazonaws.us-east-1.ecr.dkr (Interface)
  - com.amazonaws.us-east-1.logs (Interface)
  - com.amazonaws.us-east-1.secretsmanager (Interface)
```

**Why this topology:** The app is internal-only (corporate VPN access), so the ALB is internal (no internet-facing). A NAT Gateway in a separate subnet provides outbound internet for container image pulls from ECR and any external dependencies. VPC endpoints keep AWS service traffic (S3, Bedrock, ECR, Secrets Manager) on the AWS backbone network, reducing NAT costs and improving security. RDS sits in its own subnet group for network isolation.

**POC simplification:** For the initial POC, a single AZ is acceptable per the project constraints. The architecture above shows two AZs because ALB requires a minimum of two subnets in different AZs, but only one AZ needs active ECS tasks and RDS can be single-AZ (no Multi-AZ failover).

### Component Boundaries

| Component | Responsibility | Communicates With | Subnet |
|-----------|---------------|-------------------|--------|
| Internal ALB | Route HTTP/HTTPS traffic from corporate network to ECS tasks | ECS Fargate tasks | Private (app) |
| ECS Fargate Service | Run Next.js container (SSR + API routes) | ALB (inbound), RDS, S3, Bedrock, Secrets Manager | Private (app) |
| RDS PostgreSQL | Persistent data store (projects, uploads, cards, epics, stories, runs, MSS) | ECS tasks (inbound only) | Private (database) |
| S3 Bucket | File storage for uploaded documents (replaces @vercel/blob) | ECS tasks via Gateway Endpoint | N/A (AWS service) |
| Amazon Bedrock | AI inference - Claude models (replaces direct Anthropic SDK) | ECS tasks via Interface Endpoint | N/A (AWS service) |
| ECR | Container image registry for Next.js Docker image | ECS tasks (image pull), GitHub Actions (image push) | N/A (AWS service) |
| Secrets Manager | Store DATABASE_URL, S3 config, Bedrock config | ECS task definition (injected at startup) | N/A (AWS service) |
| NAT Gateway | Outbound internet access for tasks needing external resources | Internet Gateway | Private (NAT) |
| EventBridge + ECS Scheduled Task | Cron replacement for stale run recovery (replaces Vercel Cron) | RDS (via same VPC) | Private (app) |

### Data Flow

#### Document Upload Flow
```
User (corporate network)
  --> Internal ALB (HTTPS/443)
    --> ECS Task (Next.js API route: /api/upload)
      --> S3 PutObject (via Gateway Endpoint) -- store file
      --> RDS INSERT (Upload record with S3 key)
      --> Return upload ID to client
```

#### AI Analysis Flow (Card Extraction)
```
User triggers analysis
  --> ECS Task (Next.js server action)
    --> RDS: Create Run record (status=RUNNING)
    --> S3 GetObject: Retrieve document content
    --> Bedrock InvokeModel: Send to Claude (via Interface Endpoint)
    --> RDS: Write Card records, update Run status
    --> Client polls /api/runs/[id] for progress
```

#### Epic/Story/Subtask Generation Flow
```
User triggers generation
  --> ECS Task (server action, fire-and-confirm pattern)
    --> RDS: Create Run, set heartbeat
    --> Loop: For each item (epic/story)
      --> Bedrock InvokeModel: Generate content
      --> RDS: Write results, update progress, heartbeat
    --> RDS: Mark Run complete
    --> Client polls for progress (existing polling pattern)
```

#### Stale Run Recovery Flow
```
EventBridge Rule (every 5 minutes)
  --> ECS Scheduled Task (same container image, different command)
    --> RDS: Query runs WHERE status=RUNNING AND heartbeatAt < NOW() - 5min
    --> RDS: Mark stale runs as FAILED
```

#### JIRA Export Flow
```
User triggers export
  --> ECS Task (server action)
    --> RDS: Read epics/stories/subtasks with MSS mappings
    --> Generate CSV/JSON export payload
    --> Return to client for download
```

### Security Groups

| Security Group | Inbound | Outbound | Attached To |
|----------------|---------|----------|-------------|
| `sg-alb` | TCP/443 from corporate CIDR (e.g., 10.0.0.0/8) | TCP/3000 to `sg-ecs` | Internal ALB |
| `sg-ecs` | TCP/3000 from `sg-alb` | TCP/5432 to `sg-rds`, TCP/443 to VPC endpoints, TCP/443 to NAT | ECS Tasks |
| `sg-rds` | TCP/5432 from `sg-ecs` | None needed | RDS Instance |
| `sg-endpoints` | TCP/443 from `sg-ecs` | N/A | VPC Interface Endpoints |

**Port 3000:** Next.js default port inside the container. The ALB listens on 443 (HTTPS) and forwards to target group on port 3000.

## Patterns to Follow

### Pattern 1: Storage Abstraction Swap (S3 for Vercel Blob)

**What:** Replace `@vercel/blob` with AWS S3 SDK using the existing storage abstraction layer in `lib/storage/index.ts`.

**Why:** The codebase already has a clean `StorageMode` abstraction (`local` | `blob`). Add `s3` as a third mode or replace `blob` entirely. The interface (`uploadToStorage`, `getFileBuffer`, `deleteFromStorage`) maps 1:1 to S3 operations.

**Example:**
```typescript
// lib/storage/index.ts - S3 mode
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET_NAME!;

export async function uploadToStorage(buffer: Buffer, filename: string, contentType: string): Promise<UploadResult> {
  const key = `uploads/${Date.now()}-${filename}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return { blobUrl: key, blobPathname: key };
}
```

### Pattern 2: Bedrock Provider (Replace Anthropic SDK)

**What:** Add a `BedrockProvider` class implementing the existing `AIProvider` interface in `lib/ai/provider.ts`.

**Why:** The provider pattern is already in place (`AnthropicProvider`, `MockProvider`). Bedrock uses `@aws-sdk/client-bedrock-runtime` with `InvokeModelCommand`. The prompt format is identical -- Bedrock's Claude endpoint accepts the same Messages API format. Select provider via environment variable.

**Example:**
```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

class BedrockProvider implements AIProvider {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
  }

  async generateEpics(cards: CardData[]): Promise<GenerationResult<EpicData[]>> {
    const response = await this.client.send(new InvokeModelCommand({
      modelId: "anthropic.claude-sonnet-4-20250514-v1:0",
      contentType: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    }));
    // Parse response.body same as Anthropic SDK
  }
}
```

### Pattern 3: Database Connection Simplification

**What:** Remove Vercel/Neon SSL detection from `lib/db.ts`. On ECS, the container connects to RDS via private DNS hostname within the VPC. No SSL complexity needed for internal traffic (though RDS SSL is still recommended).

**Why:** The current code has conditional SSL logic for Vercel (`isVercel` check). On AWS, `DATABASE_URL` is injected from Secrets Manager into the ECS task definition. The connection is straightforward: `postgresql://user:pass@rds-hostname:5432/requirements_foundry`.

### Pattern 4: Secrets Injection via Task Definition

**What:** Use AWS Secrets Manager to store sensitive config. Reference secrets in the ECS Task Definition so they are injected as environment variables at container startup.

**Why:** Avoids baking secrets into Docker images or `.env` files. ECS natively supports `valueFrom` in container definitions pointing to Secrets Manager ARNs.

```json
{
  "containerDefinitions": [{
    "secrets": [
      { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:rf/database-url" },
      { "name": "S3_BUCKET_NAME", "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:rf/s3-bucket" }
    ]
  }]
}
```

### Pattern 5: Container Health Check + ALB Target Group

**What:** Add a `/api/health` endpoint to Next.js that checks database connectivity. Configure ALB target group health check to hit this endpoint.

**Why:** ECS needs to know if a task is healthy to route traffic and replace unhealthy tasks. The health endpoint should verify the RDS connection is alive (lightweight `SELECT 1` query).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Public Subnets for ECS Tasks

**What:** Placing ECS Fargate tasks in public subnets with public IPs.
**Why bad:** This is an internal-only app. Public IPs are unnecessary, create attack surface, and contradict the internal-only requirement.
**Instead:** Use private subnets for everything. Internal ALB for inbound traffic. NAT Gateway for outbound (ECR pulls).

### Anti-Pattern 2: Fully Isolated VPC (No NAT) for POC

**What:** Running with zero internet access using only VPC endpoints for everything.
**Why bad:** While technically possible, it requires VPC endpoints for every AWS service the container touches (ECR, CloudWatch Logs, Secrets Manager, STS, etc.). Each Interface Endpoint costs ~$7.50/month per AZ. For a POC, a single NAT Gateway ($32/month + data) is simpler and cheaper than 5+ endpoints ($37.50+/month).
**Instead:** Use a NAT Gateway for general outbound access plus a free S3 Gateway Endpoint. Add Interface Endpoints selectively only where cost savings justify it (Bedrock endpoint is worth it to keep AI traffic internal).

### Anti-Pattern 3: Storing Files in RDS

**What:** Storing uploaded document files as BLOBs in PostgreSQL.
**Why bad:** The codebase already stores `rawContent` (extracted text) in RDS. Storing original files in RDS bloats the database, slows backups, and limits file size. The existing `blobUrl`/`blobPathname` fields on the Upload model are designed for external storage.
**Instead:** Use S3 for file storage. Store the S3 key in the existing `blobUrl`/`blobPathname` columns.

### Anti-Pattern 4: Running Next.js in Lambda

**What:** Deploying the Next.js app as Lambda functions (like OpenNext or SST).
**Why bad:** The app has long-running AI generation flows (epics/stories processing takes minutes). Lambda has a 15-minute hard timeout and cold start penalties. The existing continuation pattern was designed to work around Vercel's 300s timeout -- on ECS there is no timeout, so the continuation complexity can eventually be simplified.
**Instead:** ECS Fargate has no timeout limit. A single container handles both SSR and API routes. The fire-and-confirm pattern still works but is no longer strictly necessary.

### Anti-Pattern 5: Multi-Container Task Definition

**What:** Running separate containers for "frontend" and "API" in the same ECS task.
**Why bad:** Next.js 16 serves both SSR pages and API routes from a single process. Splitting creates unnecessary complexity and inter-container networking.
**Instead:** Single container per task. Next.js handles everything. Scale by adding more tasks behind the ALB.

## Build Order (Dependencies Between Components)

Components must be built in this order because each layer depends on the previous:

```
Phase 1: Foundation (no AWS dependency)
  [1] Dockerfile + local Docker testing
  [2] /api/health endpoint
  [3] S3 storage adapter (lib/storage)
  [4] Bedrock AI provider (lib/ai/provider.ts)
  [5] Remove Vercel-specific code (lib/db.ts SSL logic)

Phase 2: AWS Infrastructure (Terraform/CloudFormation)
  [6] VPC + Subnets + NAT Gateway + Internet Gateway
  [7] Security Groups
  [8] S3 Bucket (+ Gateway Endpoint)
  [9] RDS PostgreSQL instance (+ DB subnet group)
  [10] ECR Repository
  [11] Bedrock VPC Interface Endpoint
  [12] Secrets Manager secrets

Phase 3: Compute + Networking
  [13] Internal ALB + Target Group + Listener
  [14] ECS Cluster
  [15] ECS Task Definition (references ECR, Secrets Manager)
  [16] ECS Service (references ALB, subnets, security groups)

Phase 4: CI/CD + Operations
  [17] GitHub Actions: Build -> Push ECR -> Deploy ECS
  [18] EventBridge Rule + ECS Scheduled Task (stale run recovery)
  [19] CloudWatch Log Group (basic logging)

Phase 5: Validation
  [20] Smoke test all flows (upload, analyze, generate, export)
  [21] Database migration (Prisma migrate on RDS)
```

**Critical path:** Steps 1-5 can happen in parallel with steps 6-12 (code changes vs. infrastructure). Steps 13-16 depend on 6-12. Step 17 depends on 10 (ECR) and 13-16 (ECS infra). Step 21 depends on 9 (RDS).

## ECS Task Definition Sizing (POC)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| CPU | 512 (0.5 vCPU) | Next.js SSR is not CPU-intensive; AI calls are I/O-bound (waiting on Bedrock) |
| Memory | 1024 MB | Next.js + Prisma client + document parsing. Increase if OOM occurs |
| Desired count | 1 | POC, single instance acceptable |
| Min/Max (autoscaling) | 1/2 | Optional: scale to 2 under load |
| Platform version | LATEST | Use current Fargate platform |
| Assign public IP | false | Private subnet, no public IP needed |

## Scalability Considerations

| Concern | POC (now) | Production (future) |
|---------|-----------|---------------------|
| Availability | Single AZ, 1 task | Multi-AZ, 2+ tasks, RDS Multi-AZ |
| Authentication | None (VPN-only access) | Cognito + Okta SAML (ALB auth integration) |
| DNS | ALB DNS name directly | Route 53 alias record + custom domain |
| HTTPS | ACM cert on ALB | Same, with custom domain |
| Monitoring | CloudWatch Logs basic | CloudWatch metrics, alarms, dashboards |
| File storage | Single S3 bucket, no lifecycle | S3 lifecycle rules, versioning |
| AI rate limits | 2-3 concurrent Bedrock calls | Request Bedrock quota increase |
| Database | db.t3.micro or t4g.micro | db.r6g.large+ with read replicas |
| Cron | ECS Scheduled Task | Same, with monitoring/alerting |
| WAF/DDoS | Not needed (internal) | AWS WAF if ever exposed publicly |

## Environment Variables (Container)

| Variable | Source | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Secrets Manager | PostgreSQL connection string for RDS |
| `AWS_REGION` | Task Definition env | `us-east-1` |
| `S3_BUCKET_NAME` | Secrets Manager or env | Upload storage bucket |
| `UPLOAD_STORAGE` | Task Definition env | Set to `s3` (new mode) |
| `AI_PROVIDER` | Task Definition env | Set to `bedrock` to select BedrockProvider |
| `NODE_ENV` | Task Definition env | `production` |
| `PORT` | Task Definition env | `3000` (Next.js default) |

**Note:** Bedrock does not need an API key when running on ECS. The task's IAM execution role grants `bedrock:InvokeModel` permission. The AWS SDK automatically uses the task role credentials.

## Sources

- [Run ECS tasks on Fargate in private subnet](https://repost.aws/knowledge-center/ecs-fargate-tasks-private-subnet) - AWS re:Post
- [Access container apps privately on ECS with PrivateLink](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/access-container-applications-privately-on-amazon-ecs-by-using-aws-fargate-aws-privatelink-and-a-network-load-balancer.html) - AWS Prescriptive Guidance
- [Amazon Bedrock VPC Interface Endpoints](https://docs.aws.amazon.com/bedrock/latest/userguide/vpc-interface-endpoints.html) - AWS Docs
- [Use AWS PrivateLink for private access to Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/use-aws-privatelink-to-set-up-private-access-to-amazon-bedrock/) - AWS Blog
- [ECS cluster with isolated VPC and no NAT Gateway](https://containersonaws.com/pattern/ecs-cluster-isolated-vpc-no-nat-gateway/) - Containers on AWS
- [Best practices for connecting ECS to AWS services from inside VPC](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/networking-connecting-vpc.html) - AWS Docs
- [ECS Interface VPC Endpoints](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/vpc-endpoints.html) - AWS Docs
- [Next.js deployment using ECS with Fargate](https://medium.com/@redrobotdev/next-js-deployment-using-ecs-with-fargate-1a730a8d0cb1) - Medium
- [Deploy Next.js on AWS Fargate with Terraform](https://blog.oscars.dev/posts/deploy_nextjs_app_on_fargate_with_terraform/) - Oscar's Blog
- [Optimizing ECS Fargate Network Costs with S3 VPC Endpoints](https://mhdez.com/notes/optimizing-ecs-fargate-network-costs-with-s3-vpc-endpoints/) - Miguel Hernandez
