# Requirements: Requirements Foundry - AWS Migration

**Defined:** 2026-03-05
**Core Value:** The application runs reliably on AWS infrastructure, accessible to internal corporate users, with all existing features working identically.

## v1 Requirements

Requirements for AWS migration. Each maps to roadmap phases.

### Application Code

- [x] **CODE-01**: Storage adapter uses S3 SDK (`@aws-sdk/client-s3`) instead of `@vercel/blob` for file upload, download, and deletion
- [x] **CODE-02**: AI provider uses Bedrock SDK (`@anthropic-ai/bedrock-sdk`) with correct model IDs instead of direct Anthropic SDK
- [x] **CODE-03**: Database connection uses standard PostgreSQL connection string without Vercel/Neon SSL detection logic
- [x] **CODE-04**: Dockerfile produces a working standalone Next.js container image with static assets and public directory
- [ ] **CODE-05**: Self-continuation HTTP pattern (fire-and-confirm) replaced with direct async calls in all generative flows
- [x] **CODE-06**: Health check endpoint returns 200 for ALB and ECS health monitoring
- [x] **CODE-07**: All Vercel-specific environment variables and config removed (`VERCEL_URL`, `BATCH_STORY_SECRET`, `VERCEL_AUTOMATION_BYPASS_SECRET`)
- [x] **CODE-08**: Package dependencies updated (add AWS SDKs, remove `@vercel/blob` and `@anthropic-ai/sdk`)

### Networking

- [ ] **NET-01**: VPC with private subnets across 2 availability zones in us-east-1
- [ ] **NET-02**: Internal Application Load Balancer accessible from corporate network only
- [ ] **NET-03**: NAT Gateway for outbound internet access from private subnets
- [ ] **NET-04**: Security groups enforce ALB accepts corporate CIDR only, ECS accepts ALB only, RDS accepts ECS only
- [ ] **NET-05**: S3 Gateway VPC Endpoint for free S3 access from private subnets
- [ ] **NET-06**: Bedrock Interface VPC Endpoint to keep AI traffic on AWS backbone

### Database

- [ ] **DB-01**: RDS PostgreSQL instance (db.t4g.micro, single-AZ) in private subnet
- [ ] **DB-02**: Database subnet group using private subnets
- [ ] **DB-03**: Database migrated from Neon to RDS via pg_dump/pg_restore
- [ ] **DB-04**: Prisma migrations run successfully against RDS instance

### Storage

- [ ] **STOR-01**: S3 bucket for file uploads with private access only
- [ ] **STOR-02**: Presigned URL upload flow replaces Vercel Blob handleUpload for client-side uploads
- [ ] **STOR-03**: Server-side S3 operations (get, delete) work from ECS container via IAM role

### AI Integration

- [ ] **AI-01**: Bedrock invokes Claude with correct model ID format (`anthropic.claude-sonnet-4-20250514-v1:0`)
- [ ] **AI-02**: ECS task role has `bedrock:InvokeModel` permission via IAM (no API keys)
- [x] **AI-03**: Mock mode continues to work without Bedrock access
- [ ] **AI-04**: Bedrock model access enabled in us-east-1 (FTU form completed)

### Secrets and Configuration

- [ ] **SEC-01**: DATABASE_URL stored in AWS Secrets Manager and injected into ECS container
- [ ] **SEC-02**: Non-sensitive config (S3 bucket name, region, app name) stored in SSM Parameter Store
- [ ] **SEC-03**: IAM task execution role can pull ECR images and read secrets
- [ ] **SEC-04**: IAM task role has permissions for S3, Bedrock, and CloudWatch Logs

### Compute

- [ ] **CMP-01**: ECS Fargate service runs the Next.js container (0.5 vCPU / 1GB RAM)
- [ ] **CMP-02**: ECS cluster created in us-east-1
- [ ] **CMP-03**: ECR repository stores container images with lifecycle policy (keep last 10)
- [ ] **CMP-04**: Container logs sent to CloudWatch via awslogs driver

### CI/CD

- [ ] **CICD-01**: GitHub Actions workflow builds Docker image, pushes to ECR, and deploys to ECS on push to main
- [ ] **CICD-02**: OIDC authentication between GitHub Actions and AWS (no long-lived credentials)
- [ ] **CICD-03**: ECS rolling deployment with minimumHealthyPercent=100, maximumPercent=200

### Scheduled Tasks

- [ ] **CRON-01**: Stale run recovery executes periodically (replaces Vercel Cron)

### Operations

- [ ] **OPS-01**: CloudWatch Container Insights enabled on ECS cluster
- [ ] **OPS-02**: CloudWatch alarms for critical metrics (task count = 0, ALB unhealthy targets, RDS CPU > 80%)
- [ ] **OPS-03**: SNS topic delivers alarm notifications to email

### Infrastructure as Code

- [ ] **IAC-01**: All AWS infrastructure defined in CDK (TypeScript) -- VPC, subnets, ALB, ECS, RDS, S3, IAM, security groups, secrets, log groups
- [ ] **IAC-02**: CDK project bootstrapped and deployable from local machine

### Validation

- [ ] **VAL-01**: End-to-end smoke test passes: upload document, analyze cards, generate epics, generate stories, generate subtasks, JIRA export
- [ ] **VAL-02**: MSS taxonomy import and mapping works on AWS
- [ ] **VAL-03**: All existing data accessible after database migration
- [ ] **VAL-04**: Application accessible from corporate network via internal ALB

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Authentication

- **AUTH-01**: Cognito user pool with Okta SAML federation for SSO
- **AUTH-02**: User sessions tied to authenticated identity
- **AUTH-03**: Role-based access control for projects

### Production Hardening

- **PROD-01**: Multi-AZ RDS for database high availability
- **PROD-02**: Auto-scaling policies for ECS based on CPU/memory
- **PROD-03**: Custom domain via Route 53 with ACM certificate
- **PROD-04**: Terraform remote state (S3 + DynamoDB) for team IaC collaboration
- **PROD-05**: Separate staging environment

### Advanced Operations

- **ADV-01**: ECS Exec via SSM Session Manager for container debugging
- **ADV-02**: CloudWatch log metric filters for error rates and AI call durations
- **ADV-03**: Custom CloudWatch dashboard with combined metrics
- **ADV-04**: S3 versioning for document recovery

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| CloudFront CDN | Internal-only app, no public users |
| WAF | Corporate firewall/VPN handles perimeter security |
| Lambda@Edge | Next.js middleware runs in container |
| Multi-region deployment | POC, single region acceptable |
| ElastiCache/Redis | App uses polling, no session cache needed |
| ECS Service Connect / App Mesh | Single service, no mesh needed |
| RDS Proxy | Prisma prepared statements cause connection pinning |
| VPC flow log analysis | Enable logs to S3 but don't build analysis |
| Separate staging environment | Get one environment working first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CODE-01 | Phase 21 | Complete |
| CODE-02 | Phase 21 | Complete |
| CODE-03 | Phase 21 | Complete |
| CODE-04 | Phase 21 | Complete |
| CODE-05 | Phase 21 | Pending |
| CODE-06 | Phase 21 | Complete |
| CODE-07 | Phase 21 | Complete |
| CODE-08 | Phase 21 | Complete |
| NET-01 | Phase 22 | Pending |
| NET-02 | Phase 22 | Pending |
| NET-03 | Phase 22 | Pending |
| NET-04 | Phase 22 | Pending |
| NET-05 | Phase 22 | Pending |
| NET-06 | Phase 22 | Pending |
| DB-01 | Phase 22 | Pending |
| DB-02 | Phase 22 | Pending |
| DB-03 | Phase 25 | Pending |
| DB-04 | Phase 25 | Pending |
| STOR-01 | Phase 22 | Pending |
| STOR-02 | Phase 23 | Pending |
| STOR-03 | Phase 23 | Pending |
| AI-01 | Phase 23 | Pending |
| AI-02 | Phase 23 | Pending |
| AI-03 | Phase 21 | Complete |
| AI-04 | Phase 23 | Pending |
| SEC-01 | Phase 22 | Pending |
| SEC-02 | Phase 22 | Pending |
| SEC-03 | Phase 22 | Pending |
| SEC-04 | Phase 22 | Pending |
| CMP-01 | Phase 23 | Pending |
| CMP-02 | Phase 22 | Pending |
| CMP-03 | Phase 22 | Pending |
| CMP-04 | Phase 23 | Pending |
| CICD-01 | Phase 24 | Pending |
| CICD-02 | Phase 24 | Pending |
| CICD-03 | Phase 24 | Pending |
| CRON-01 | Phase 24 | Pending |
| OPS-01 | Phase 24 | Pending |
| OPS-02 | Phase 24 | Pending |
| OPS-03 | Phase 24 | Pending |
| IAC-01 | Phase 22 | Pending |
| IAC-02 | Phase 22 | Pending |
| VAL-01 | Phase 25 | Pending |
| VAL-02 | Phase 25 | Pending |
| VAL-03 | Phase 25 | Pending |
| VAL-04 | Phase 25 | Pending |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation (traceability complete)*
