# Feature Landscape: Next.js AWS Migration (Vercel to ECS Fargate)

**Domain:** Corporate internal deployment -- migrating Next.js app from Vercel to AWS
**Researched:** 2026-03-05

## Table Stakes

Features that are non-negotiable for a working corporate AWS deployment. Missing any of these means the app cannot run or cannot be accessed.

### Compute and Container Infrastructure

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Dockerfile with standalone output | Next.js requires `output: "standalone"` for container deployment; produces minimal image with only runtime files | Low | Use `node:20-alpine` base, single-stage build is fine since CI handles the build step. Port 3000. |
| ECR repository | Container images must be stored somewhere AWS can pull from | Low | One repo, tag with commit SHA for traceability |
| ECS Fargate service + task definition | The actual compute. Fargate = no server management, just define CPU/memory | Medium | Start with 0.5 vCPU / 1GB RAM, adjust based on load. Single task for POC. |
| ECS cluster | Logical grouping for Fargate tasks | Low | One cluster, one service |
| Health check endpoint | ALB and ECS need to verify the app is alive | Low | Simple `/api/health` route returning 200. ECS uses this to restart unhealthy tasks. |

### Networking and Access

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| VPC with private subnets | Corporate internal-only access requires private networking | Medium | Minimum 2 private subnets across 2 AZs (AWS requires this even for single-task POC). No public subnets needed if using VPN/DirectConnect. |
| Internal Application Load Balancer | Routes traffic to ECS tasks, provides stable endpoint | Medium | Internal scheme ALB. Listener on port 80 (or 443 with ACM cert). Target group pointing to ECS service on port 3000. |
| NAT Gateway OR VPC Endpoints | Tasks in private subnets need outbound access to AWS services (ECR, S3, Bedrock, CloudWatch) | Medium | **Decision point:** NAT Gateway is simpler but costs ~$32/mo + data transfer. VPC endpoints are cheaper for steady traffic but require more setup. For POC, NAT Gateway is the pragmatic choice. |
| Security groups | Network-level access control between ALB, ECS tasks, RDS, and VPC endpoints | Medium | Minimum 3 SGs: ALB (inbound from corporate CIDR), ECS tasks (inbound from ALB SG only), RDS (inbound from ECS SG only). |

### Database

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| RDS PostgreSQL instance | Direct replacement for current Neon/Vercel Postgres. Prisma works identically. | Medium | `db.t4g.micro` for POC. Single-AZ. Private subnet group. No public accessibility. |
| Database subnet group | RDS requires subnets to be explicitly designated | Low | Use the same private subnets as ECS |
| Database migration path | Existing data from Neon needs to come over | Medium | `pg_dump` from Neon, `pg_restore` to RDS. Run Prisma migrations after. One-time operation. |

### File Storage

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| S3 bucket for file uploads | Drop-in replacement for `@vercel/blob`. Documents are uploaded and extracted. | Low | Private bucket, no public access. Use AWS SDK v3 `@aws-sdk/client-s3` with presigned URLs for uploads if needed, or server-side upload from the API route. |
| S3 storage adapter | Code change to replace `@vercel/blob` calls with S3 SDK calls | Medium | Replace `put()`, `del()`, `list()` in `lib/storage/index.ts`. The adapter pattern already exists -- swap implementation. |

### AI Integration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Amazon Bedrock for Claude | Replaces direct Anthropic API. Keeps all AI traffic within AWS network. | Medium | Use `@aws-sdk/client-bedrock-runtime`. The API shape is similar but not identical to Anthropic SDK -- `InvokeModel` / `InvokeModelWithResponseStream` instead of `messages.create()`. Must complete Anthropic FTU (First Time Use) form in Bedrock console. |
| IAM role for Bedrock access | ECS task role needs permission to invoke Bedrock models | Low | `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on the model ARN. No API keys needed -- uses IAM credential chain automatically. |

### Secrets and Configuration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| AWS Secrets Manager for sensitive values | Database credentials, any API keys. ECS natively injects from Secrets Manager into container env vars at task startup. | Low | Store `DATABASE_URL`, any remaining API keys. Reference in task definition via `secrets` block. |
| SSM Parameter Store for non-sensitive config | App configuration that isn't secret (region, bucket name, feature flags) | Low | Free tier. Reference in task definition via `secrets` block (same mechanism). Use for `S3_BUCKET_NAME`, `AWS_REGION`, `APP_ENV`, etc. |
| IAM task execution role | ECS needs permissions to pull images from ECR and read secrets | Low | Standard `AmazonECSTaskExecutionRolePolicy` plus Secrets Manager / SSM read permissions. |
| IAM task role | The running container needs permissions for S3, Bedrock, CloudWatch | Low | Separate from execution role. Principle of least privilege. |

### Logging

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CloudWatch Logs via awslogs driver | ECS Fargate natively sends container stdout/stderr to CloudWatch Logs. Zero application code changes. | Low | Configure `logConfiguration` in task definition with `awslogs` driver. Log group `/ecs/requirements-foundry`. |
| Structured logging from Next.js | JSON-formatted logs so CloudWatch can parse and filter them | Low | `console.log(JSON.stringify({...}))` or use `pino` with JSON output. Not strictly required for POC but makes debugging much easier. |

### CI/CD Pipeline

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| GitHub Actions workflow | Build, push to ECR, deploy to ECS on push to main | Medium | Use official AWS actions: `aws-actions/configure-aws-credentials` (OIDC), `aws-actions/amazon-ecr-login`, `aws-actions/amazon-ecs-render-task-definition`, `aws-actions/amazon-ecs-deploy-task-definition`. |
| OIDC authentication for GitHub Actions | No long-lived AWS credentials stored in GitHub. IAM OIDC provider trusts GitHub. | Medium | More secure than access keys. One-time setup of IAM OIDC provider + IAM role with trust policy for the specific repo. |
| ECR image lifecycle policy | Prevent unbounded image storage costs | Low | Keep last 10 tagged images, expire untagged after 1 day |

### Scheduled Tasks

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ECS Scheduled Task or EventBridge rule for stale run recovery | Replaces Vercel Cron. The app has a `/api/cron/recover-stale-runs` endpoint that must run periodically. | Medium | EventBridge rule triggers ECS RunTask on schedule. Alternatively, could be a simple `curl` from a Lambda on a schedule hitting the API endpoint through the ALB. Lambda approach is simpler for POC. |

### Infrastructure as Code

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Terraform or CloudFormation for all infrastructure | Reproducibility, version control, no ClickOps | High | This is the single highest-complexity table-stakes item. Covers VPC, subnets, ALB, ECS, RDS, S3, IAM, security groups, secrets, log groups. Terraform recommended over CloudFormation for better DX and state management. |

## Differentiators

Features that improve operations and reliability but are not strictly required for POC launch.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| CloudWatch Container Insights | CPU/memory metrics per task, service-level dashboards, deployment tracking | Low | Toggle on at cluster level. ~$0.50/month for a single service. Worth enabling from day one. |
| CloudWatch alarms for critical metrics | Get notified when tasks fail, CPU spikes, or unhealthy targets appear | Medium | Alarms on: ECS service running task count = 0, ALB target unhealthy count > 0, RDS CPU > 80%. SNS topic to email. |
| Blue/green or rolling deployment in ECS | Zero-downtime deployments. ECS supports rolling update by default. | Low | ECS rolling update is actually the default -- just configure `minimumHealthyPercent: 100` and `maximumPercent: 200` in service config. Free. |
| RDS automated backups | Point-in-time recovery for the database | Low | Enabled by default on RDS. 7-day retention is free. Just don't disable it. |
| CloudWatch log metric filters | Extract application-level metrics from logs (error rates, AI call durations) | Medium | Create metric filters on log group patterns like `"level":"error"` or `"duration"`. Feeds into alarms. |
| Multi-AZ RDS | Database survives AZ failure | Low | Toggle on RDS creation. Doubles cost (~$15/mo to ~$30/mo for t4g.micro). Not needed for POC but easy to enable later. |
| S3 versioning | Recover accidentally deleted uploaded documents | Low | Toggle on bucket. Minimal cost for internal app volume. |
| SSM Session Manager for ECS Exec | Shell into running container for debugging without SSH | Medium | Requires `enableExecuteCommand` on ECS service + SSM VPC endpoint. Very useful for debugging but not launch-critical. |
| Terraform remote state (S3 + DynamoDB) | State locking and team collaboration for IaC | Medium | S3 bucket for state file, DynamoDB table for locking. Standard practice but can start with local state for POC. |
| GitHub Actions environment protection rules | Require approval before deploying to production | Low | GitHub-native feature. Add manual approval gate on the deploy job. |
| Custom CloudWatch dashboard | Single-pane view of app health | Medium | Combine ECS metrics, ALB metrics, RDS metrics, error log counts. Nice for demos and monitoring but not required. |

## Anti-Features

Features to explicitly NOT build for the POC migration. These add complexity without value at this stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| CloudFront CDN | Internal-only app, no public internet users. CloudFront adds complexity and cost for zero benefit on VPN-accessed apps. | Serve static assets directly from Next.js via ALB. |
| WAF (Web Application Firewall) | Internal network already protected by corporate firewall/VPN. WAF rules add cost and debugging complexity. | Rely on security groups and private networking. |
| Route 53 custom domain | Requires DNS zone setup, certificate management, and potentially cross-account delegation. Overkill for POC. | Use ALB DNS name directly (or add a CNAME in corporate DNS manually if needed). |
| Auto-scaling policies | Single internal team of users. Traffic is predictable and low. Auto-scaling adds config complexity. | Fixed task count of 1 (or 2 if availability matters). Scale manually if needed. |
| Multi-region deployment | POC runs in us-east-1 only. Multi-region adds massive complexity for DR scenarios irrelevant to an internal tool. | Single region, accept the risk for POC. |
| Custom VPC flow logs analysis | Useful for security audits but excessive for POC. Generates high volume of log data. | Enable flow logs to S3 (cheap) but don't build analysis tooling. |
| ElastiCache / Redis | The app uses polling, not sessions. No caching layer needed. | PostgreSQL handles all data. Next.js in-memory cache is sufficient. |
| ECS Service Connect / App Mesh | Service mesh is for multi-service architectures. This is a single service. | Direct ALB-to-ECS routing. |
| Cognito + Okta SSO | Explicitly deferred to a future milestone per project constraints. Architecture should accommodate it but don't build it now. | No auth for POC. Ensure ALB and security groups restrict to corporate network. |
| Lambda@Edge for middleware | Over-engineering. Next.js middleware runs fine in the container. | Standard Next.js middleware in the container. |
| RDS Proxy | Useful for serverless with many short-lived connections. ECS Fargate tasks are long-lived -- single Prisma connection pool is fine. | Prisma connection pooling in the container (already configured). |
| Separate staging environment | Focus on getting one environment working first. Staging can be a second ECS service later. | Single environment. Use feature flags if needed. |

## Feature Dependencies

```
Dockerfile (standalone build)
  --> ECR repository
    --> ECS task definition (references ECR image)
      --> ECS service (runs task definition)
        --> ALB target group (routes to ECS service)

VPC + Subnets
  --> Security groups (reference VPC)
  --> NAT Gateway or VPC Endpoints (enable outbound from private subnets)
  --> ALB (deployed into subnets)
  --> ECS service (deployed into subnets)
  --> RDS instance (deployed into DB subnet group)

IAM task execution role
  --> ECS task definition (pulls images, reads secrets)

IAM task role
  --> S3 access (file uploads)
  --> Bedrock access (AI calls)
  --> CloudWatch Logs (container logging)

Secrets Manager + Parameter Store
  --> ECS task definition (injects env vars at startup)
  --> Requires: DATABASE_URL, S3_BUCKET_NAME, AWS_REGION, etc.

RDS PostgreSQL
  --> DATABASE_URL secret in Secrets Manager
  --> Prisma schema migration (one-time)

S3 bucket
  --> Storage adapter code change (replaces @vercel/blob)

Bedrock access
  --> AI provider code change (replaces @anthropic-ai/sdk)
  --> FTU form completion in Bedrock console

GitHub Actions CI/CD
  --> OIDC provider in IAM
  --> ECR repository (push target)
  --> ECS service (deploy target)

EventBridge scheduled rule
  --> Stale run recovery (replaces Vercel Cron)
  --> Requires: ECS service running first
```

## MVP Recommendation

### Phase 1: Infrastructure Foundation
Prioritize in this order:
1. **VPC, subnets, security groups, NAT Gateway** -- nothing works without networking
2. **RDS PostgreSQL** -- database must exist before the app can start
3. **S3 bucket** -- file storage must exist before uploads work
4. **Secrets Manager entries** -- credentials must be stored before task definition references them
5. **IAM roles** (execution + task) -- permissions must exist before ECS can run

### Phase 2: Application Containerization
1. **Dockerfile with standalone output** -- build the container
2. **Code changes: S3 adapter, Bedrock provider, database connection** -- make the app AWS-native
3. **ECR repository** -- push the image
4. **ECS task definition + service** -- run the container
5. **Internal ALB** -- expose the app to the corporate network

### Phase 3: CI/CD and Operations
1. **GitHub Actions workflow** -- automate build and deploy
2. **OIDC authentication** -- secure the pipeline
3. **CloudWatch Logs** -- see what the app is doing
4. **EventBridge scheduled task** -- restore cron functionality
5. **Container Insights** -- basic operational visibility

### Phase 4: IaC Codification
1. **Terraform modules for all infrastructure** -- make it reproducible
2. **Remote state backend** -- enable team collaboration

**Defer:** Cognito/Okta SSO, custom domain, auto-scaling, multi-AZ RDS, WAF, CloudFront, staging environment. All are future milestone material.

## Sources

- [AWS ECS Fargate private subnet setup](https://repost.aws/knowledge-center/ecs-fargate-tasks-private-subnet) -- HIGH confidence
- [ECS task networking for Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html) -- HIGH confidence
- [VPC endpoints for ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/vpc-endpoints.html) -- HIGH confidence
- [CloudWatch logging for ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html) -- HIGH confidence
- [Passing secrets to ECS tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html) -- HIGH confidence
- [GitHub Actions ECS deployment](https://docs.github.com/en/actions/deployment/deploying-to-your-cloud-provider/deploying-to-amazon-elastic-container-service) -- HIGH confidence
- [AWS blog: CI/CD for ECS with GitHub Actions](https://aws.amazon.com/blogs/containers/create-a-ci-cd-pipeline-for-amazon-ecs-with-github-actions-and-aws-codebuild-tests/) -- HIGH confidence
- [Secrets Manager vs Parameter Store](https://aws.amazon.com/blogs/security/how-to-choose-the-right-aws-service-for-managing-secrets-and-configurations/) -- HIGH confidence
- [Claude on Amazon Bedrock](https://platform.claude.com/docs/en/build-with-claude/claude-on-amazon-bedrock) -- HIGH confidence
- [Next.js standalone deployment docs](https://nextjs.org/docs/app/getting-started/deploying) -- HIGH confidence
- [Container Insights for ECS](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html) -- HIGH confidence
- [Configuring ECS Fargate with private subnets](https://tinfoilcipher.co.uk/2025/01/29/configuring-ecs-fargate-and-ecr-with-private-subnets/) -- MEDIUM confidence
- [Next.js ECS Fargate deployment guide](https://medium.com/@redrobotdev/next-js-deployment-using-ecs-with-fargate-1a730a8d0cb1) -- MEDIUM confidence
- [Best practices for secrets management in ECS Fargate](https://elasticscale.com/blog/best-practices-for-secrets-management-in-ecs-fargate-at-scale/) -- MEDIUM confidence
