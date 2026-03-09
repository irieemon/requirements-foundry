# Phase 23: Compute and Deployment - Research

**Researched:** 2026-03-05
**Domain:** ECS Fargate deployment, CDK service definition, container entrypoint, deploy scripting
**Confidence:** HIGH

## Summary

Phase 23 wires the ECS Fargate service to Phase 22's infrastructure (VPC, ALB, RDS, S3, ECR, IAM roles), deploys the Docker image from Phase 21, and validates the application runs end-to-end on AWS. The work breaks down into four areas: (1) CDK additions for task definition, Fargate service, and log group, (2) entrypoint.js for secret retrieval and migration at container startup, (3) Dockerfile modifications and dependency additions, and (4) a deploy script for build/push/deploy workflow.

The ALB already has a forwarding rule at priority 1 pointing to the target group -- the default 503 is only reached when no targets are registered. Once the Fargate service registers healthy targets, traffic flows automatically. No listener modification is needed in CDK.

**Primary recommendation:** Add FargateTaskDefinition and FargateService to the existing CDK stack (not a new stack), create entrypoint.js that reads RDS credentials from Secrets Manager and composes DATABASE_URL, and build a deploy.sh script for the initial manual deployment workflow.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep server-side FormData upload (client -> server -> S3 PutObject) -- do NOT switch to presigned URLs
- Current flow in `app/api/uploads/route.ts` and `lib/storage/index.ts` is already working and sufficient for internal users
- No file size cap needed -- internal app, small team, documents are typically a few MB
- Update STOR-02 requirement text to reflect "Server-side S3 upload via FormData" instead of "presigned URL upload flow"
- Node.js entrypoint script (`entrypoint.js`) that: reads RDS credentials from Secrets Manager, composes DATABASE_URL, runs `npx prisma migrate deploy`, exec's `node server.js`
- No AWS CLI installation needed -- AWS SDK is already in the Docker image
- Dockerfile CMD changes from `["node", "server.js"]` to `["node", "entrypoint.js"]`
- ECS service starts with `desiredCount=1` -- service retries until image appears in ECR
- Include a deploy script (`scripts/deploy.sh`) with manual steps: build, tag, push to ECR, trigger ECS deployment
- Fail loudly if Bedrock access is denied -- AI endpoints return clear error, non-AI features still work
- Do NOT fall back to mock mode automatically in production
- Bedrock FTU form must be submitted BEFORE deployment validation -- include as prerequisite step in plan
- Phase 23 is NOT complete until AI features (card analysis, epic generation) actually work on Bedrock
- AI-01, AI-02, AI-04 remain in Phase 23 scope -- not deferred to Phase 25

### Claude's Discretion
- CDK task definition and Fargate service configuration details
- ALB listener rule changes (switching from 503 to forwarding)
- CloudWatch log group configuration for container logs
- Environment variables passed to container (S3_BUCKET_NAME, AWS_REGION, etc.)
- Deploy script implementation details
- How to handle the initial "no image in ECR" period gracefully

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMP-01 | ECS Fargate service runs the Next.js container (0.5 vCPU / 1GB RAM) | CDK FargateTaskDefinition with cpu=512, memoryLimitMiB=1024; FargateService with desiredCount=1 |
| CMP-04 | Container logs sent to CloudWatch via awslogs driver | CDK ecs.LogDrivers.awsLogs() with streamPrefix and log group |
| AI-01 | Bedrock invokes Claude with correct model ID format | Already implemented in provider.ts with `anthropic.claude-sonnet-4-20250514-v1:0`; validate end-to-end on AWS |
| AI-02 | ECS task role has bedrock:InvokeModel permission via IAM | Already configured in Phase 22 CDK stack; task role has bedrock:InvokeModel and InvokeModelWithResponseStream |
| AI-04 | Bedrock model access enabled in us-east-1 (FTU form completed) | Manual prerequisite -- submit FTU form before deployment validation |
| STOR-02 | Server-side S3 upload via FormData (updated from presigned URLs) | Already implemented in lib/storage/index.ts and app/api/uploads/route.ts; validate end-to-end on AWS |
| STOR-03 | Server-side S3 operations (get, delete) work from ECS container via IAM role | Already implemented in lib/storage/index.ts; task role has S3 read/write; validate end-to-end on AWS |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| aws-cdk-lib (aws_ecs) | ^2.241.0 | FargateTaskDefinition, FargateService, LogDriver | Already in infra/package.json; native ECS Fargate constructs |
| @aws-sdk/client-secrets-manager | ^3.1002.0 | Read RDS credentials in entrypoint.js | AWS SDK v3 modular client for Secrets Manager |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-s3 | ^3.1002.0 | S3 file operations | Already a dependency; used by storage adapter |
| @aws-sdk/credential-providers | ^3.1002.0 | fromNodeProviderChain for IAM auth | Already a dependency; used by storage and AI providers |
| @anthropic-ai/bedrock-sdk | ^0.26.4 | Bedrock Claude invocations | Already a dependency; used by AI provider |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| entrypoint.js with SDK | ECS container secrets injection | Container secrets are for simple key=value; composing DATABASE_URL from JSON secret requires custom logic |
| Manual deploy script | CDK deploy pipeline | Phase 24 adds CI/CD; manual script is appropriate for Phase 23 |

**Installation:**
```bash
# In the app root (for entrypoint.js runtime dependency)
npm install @aws-sdk/client-secrets-manager
```

## Architecture Patterns

### CDK Stack Extension

The Fargate service components are added to the existing `RequirementsFoundryStack` in `infra/lib/requirements-foundry-stack.ts`. No separate stack needed -- all resources reference each other directly.

```
infra/lib/requirements-foundry-stack.ts  # Extended with TaskDef + Service + LogGroup
entrypoint.js                            # New file in project root (copied into Docker image)
scripts/deploy.sh                        # New deploy automation script
Dockerfile                               # Modified CMD + add entrypoint.js COPY + npm install secrets-manager
```

### Pattern 1: CDK Task Definition with Imported Roles

**What:** Create FargateTaskDefinition referencing the IAM roles already defined in the stack, add a container with ECR image and environment variables, attach to ALB target group via FargateService.

**When to use:** When IAM roles, cluster, and ALB target group are in the same stack.

**Example:**
```typescript
// Source: AWS CDK FargateTaskDefinition docs + FargateService docs
import * as logs from 'aws-cdk-lib/aws-logs';

// CloudWatch Log Group (CMP-04)
const logGroup = new logs.LogGroup(this, 'AppLogGroup', {
  logGroupName: '/ecs/requirements-foundry-prod',
  retention: logs.RetentionDays.TWO_WEEKS,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

// Task Definition (CMP-01)
const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
  cpu: 512,        // 0.5 vCPU
  memoryLimitMiB: 1024,  // 1 GB RAM
  executionRole: taskExecutionRole,
  taskRole: taskRole,
  family: 'requirements-foundry-prod',
});

// Container
const container = taskDefinition.addContainer('app', {
  image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
  logging: ecs.LogDrivers.awsLogs({
    streamPrefix: 'app',
    logGroup,
  }),
  environment: {
    NODE_ENV: 'production',
    PORT: '3000',
    AWS_REGION: 'us-east-1',
    S3_BUCKET_NAME: bucket.bucketName,
    RDS_SECRET_NAME: 'requirements-foundry-prod/rds-credentials',
  },
  portMappings: [{ containerPort: 3000 }],
});

// Fargate Service
const service = new ecs.FargateService(this, 'Service', {
  serviceName: 'requirements-foundry-prod-service',
  cluster,
  taskDefinition,
  desiredCount: 1,
  securityGroups: [this.ecsSg],
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  assignPublicIp: false,
});

// Register with ALB target group
service.attachToApplicationTargetGroup(targetGroup);
```

### Pattern 2: Entrypoint Script for Secret Composition

**What:** A Node.js script that reads the RDS credentials JSON from Secrets Manager, composes a DATABASE_URL, sets it as an environment variable, runs Prisma migrations, then exec's the main server process.

**When to use:** When DATABASE_URL must be composed from a multi-field JSON secret at runtime.

**Example:**
```javascript
// entrypoint.js
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync, execFileSync } = require('child_process');

async function main() {
  console.log('Starting entrypoint...');

  // 1. Read RDS credentials from Secrets Manager
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
  const response = await client.send(new GetSecretValueCommand({
    SecretId: process.env.RDS_SECRET_NAME || 'requirements-foundry-prod/rds-credentials',
  }));

  const secret = JSON.parse(response.SecretString);
  const databaseUrl = `postgresql://${secret.username}:${encodeURIComponent(secret.password)}@${secret.host}:${secret.port}/${secret.dbname || 'requirements_foundry'}`;

  // 2. Export DATABASE_URL
  process.env.DATABASE_URL = databaseUrl;
  console.log('DATABASE_URL composed from Secrets Manager');

  // 3. Run Prisma migrations
  console.log('Running prisma migrate deploy...');
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    console.log('Migrations complete');
  } catch (error) {
    console.error('Migration failed:', error.message);
    // Continue anyway -- migrations may not exist yet or may already be applied
  }

  // 4. Start the application
  console.log('Starting server...');
  require('./server.js');
}

main().catch((error) => {
  console.error('Entrypoint failed:', error);
  process.exit(1);
});
```

### Pattern 3: Deploy Script

**What:** A bash script that builds the Docker image, authenticates with ECR, pushes the image, and triggers an ECS service update.

**Example:**
```bash
#!/bin/bash
set -euo pipefail

# Configuration
AWS_REGION="us-east-1"
ECR_REPO="requirements-foundry-prod"
CLUSTER="requirements-foundry-prod-cluster"
SERVICE="requirements-foundry-prod-service"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

# 1. Build Docker image
docker build -t ${ECR_REPO}:latest .

# 2. Authenticate with ECR
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# 3. Tag and push
docker tag ${ECR_REPO}:latest ${ECR_URI}:latest
docker push ${ECR_URI}:latest

# 4. Force new deployment
aws ecs update-service --cluster ${CLUSTER} --service ${SERVICE} --force-new-deployment --region ${AWS_REGION}

echo "Deployment initiated. Monitor with:"
echo "  aws ecs describe-services --cluster ${CLUSTER} --services ${SERVICE} --region ${AWS_REGION}"
```

### Anti-Patterns to Avoid
- **Creating a separate CDK stack for ECS service:** All resources reference each other directly (VPC, SGs, roles, target group) -- a second stack would require cross-stack references for everything, adding unnecessary complexity.
- **Using ECS container secrets for DATABASE_URL:** The RDS secret is a JSON object with individual fields (username, password, host, port, dbname); ECS secrets injection can only map a single string value, not compose a URL from parts.
- **Using `exec` to replace the Node process:** Use `require('./server.js')` instead of `exec('node server.js')` -- this keeps the same process, so ECS SIGTERM handling works correctly with Next.js's built-in graceful shutdown.
- **Hardcoding the ECR image tag in CDK:** Use `'latest'` tag in CDK; the deploy script pushes with `:latest` and forces a new deployment. This avoids CDK needing to change on every deploy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CloudWatch log routing | Custom log shipping | `ecs.LogDrivers.awsLogs()` in CDK | Fargate awslogs driver is native; handles log group creation, stream naming, buffering |
| ECR authentication | Manual token management | `aws ecr get-login-password` piped to `docker login` | Standard ECR auth pattern; tokens expire in 12 hours |
| Fargate networking | Manual ENI/IP configuration | CDK FargateService with `assignPublicIp: false` + VPC subnets | CDK manages awsvpc networking automatically |
| Service health monitoring | Custom health check polling | ALB target group health checks on `/api/health` | Already configured in Phase 22 CDK stack |

**Key insight:** ECS Fargate with CDK handles networking, logging, and service registration automatically. The only custom code needed is the entrypoint.js for secret composition and migration.

## Common Pitfalls

### Pitfall 1: Standalone Output Missing entrypoint.js Dependencies
**What goes wrong:** The `@aws-sdk/client-secrets-manager` package is not in node_modules of the standalone output because Next.js only traces imports from application code.
**Why it happens:** Next.js standalone mode traces `require`/`import` from server code to determine which node_modules to include. The entrypoint.js is not part of the Next.js build, so its dependencies are not traced.
**How to avoid:** Add `@aws-sdk/client-secrets-manager` to the app's package.json AND copy it explicitly in the Dockerfile. Two options:
  1. Add `serverExternalPackages: ["@aws-sdk/client-secrets-manager"]` to next.config.ts AND import it somewhere in app code (creates trace)
  2. (Simpler) In the Dockerfile runner stage, copy the specific package from the builder's node_modules: `COPY --from=builder /app/node_modules/@aws-sdk/client-secrets-manager ./node_modules/@aws-sdk/client-secrets-manager` plus its transitive dependencies
  3. (Simplest) Install it separately in the runner stage: `RUN npm install --no-save @aws-sdk/client-secrets-manager` -- but this adds build time and network dependency

  **Recommended approach:** The AWS SDK v3 client-secrets-manager shares many transitive deps with client-s3 (which IS traced). The safest approach is to copy the full node_modules from builder for the specific package, or use `outputFileTracingIncludes` in next.config.ts:
  ```typescript
  outputFileTracingIncludes: {
    '/': ['./node_modules/@aws-sdk/client-secrets-manager/**/*'],
  }
  ```
**Warning signs:** Container crashes at startup with `MODULE_NOT_FOUND` error for `@aws-sdk/client-secrets-manager`.

### Pitfall 2: Prisma CLI Not Available in Standalone Output
**What goes wrong:** `npx prisma migrate deploy` fails because prisma CLI binary is not in the standalone node_modules.
**Why it happens:** Same reason as above -- Prisma CLI is a devDependency and not traced by Next.js standalone mode.
**How to avoid:** The Dockerfile already copies `prisma/` and `node_modules/.prisma/` (the generated client). For migrations, also copy the prisma CLI: `COPY --from=builder /app/node_modules/prisma ./node_modules/prisma` and `COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma`. Or use `npx` which will download if missing (slower but reliable).
**Warning signs:** `prisma: command not found` or `npx: prisma not found` at container startup.

### Pitfall 3: Password Special Characters in DATABASE_URL
**What goes wrong:** RDS auto-generated passwords can contain special characters (`@`, `/`, `#`, etc.) that break the PostgreSQL connection URL.
**Why it happens:** Secrets Manager generates passwords with special characters by default; these must be URL-encoded in the connection string.
**How to avoid:** Use `encodeURIComponent(secret.password)` when composing the DATABASE_URL in entrypoint.js.
**Warning signs:** Prisma connection errors mentioning "invalid connection string" or "authentication failed".

### Pitfall 4: Container Starts Before ECR Image Exists
**What goes wrong:** ECS service is created by CDK deploy but no image exists in ECR yet, causing task failures.
**Why it happens:** CDK deploys infrastructure before the Docker image is built and pushed.
**How to avoid:** This is expected behavior. ECS will retry failed tasks. The deploy script pushes the image and forces a new deployment. The service will stabilize once the image is available. Set `circuitBreaker: { rollback: false }` on the service to prevent ECS from marking it as failed during the initial bootstrap period.
**Warning signs:** ECS events showing "CannotPullContainerError" -- this is normal before first image push.

### Pitfall 5: Bedrock Access Not Enabled
**What goes wrong:** AI features return AccessDeniedException even though IAM permissions are correct.
**Why it happens:** Bedrock model access requires a separate First-Time Use (FTU) approval in the AWS Console, independent of IAM permissions.
**How to avoid:** Submit the Bedrock FTU form in the AWS Console (Bedrock > Model access > Manage model access) BEFORE running deployment validation. Request access for `Anthropic Claude Sonnet 4` in us-east-1.
**Warning signs:** HTTP 403 with "You don't have access to the model with the specified model ID" error.

### Pitfall 6: AI Provider Falls Back to MockProvider in Production
**What goes wrong:** The current `getAIProvider()` in `lib/ai/provider.ts` falls back to MockProvider when credentials are detected but Bedrock access is denied. In production, this silently returns fake data.
**Why it happens:** The credential check passes (ECS task role has valid credentials), but Bedrock throws at invocation time, which is caught by the try/catch in the Bedrock provider methods.
**How to avoid:** Per user decision, fail loudly -- do NOT fall back to mock mode. The current code actually handles this correctly: credential detection succeeds so BedrockProvider is used, and BedrockProvider's methods return `{ success: false, error: ... }` on failure. The concern is more about `MOCK_MODE` -- ensure it is NOT set in the container environment variables.
**Warning signs:** Generations returning suspiciously fast with identical generic data.

## Code Examples

### CDK: FargateTaskDefinition with ECR Image and CloudWatch Logging

```typescript
// Source: AWS CDK docs - FargateTaskDefinition, FargateService, LogDriver
import * as logs from 'aws-cdk-lib/aws-logs';

// Log group for container output
const logGroup = new logs.LogGroup(this, 'AppLogGroup', {
  logGroupName: '/ecs/requirements-foundry-prod',
  retention: logs.RetentionDays.TWO_WEEKS,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

// Task definition: 0.5 vCPU / 1 GB RAM
const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
  family: 'requirements-foundry-prod',
  cpu: 512,
  memoryLimitMiB: 1024,
  executionRole: taskExecutionRole,
  taskRole: taskRole,
});

// Container definition
const container = taskDefinition.addContainer('app', {
  image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
  logging: ecs.LogDrivers.awsLogs({
    streamPrefix: 'app',
    logGroup,
  }),
  environment: {
    NODE_ENV: 'production',
    PORT: '3000',
    AWS_REGION: 'us-east-1',
    S3_BUCKET_NAME: bucket.bucketName,
    RDS_SECRET_NAME: 'requirements-foundry-prod/rds-credentials',
  },
  portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
});

// Fargate service
const service = new ecs.FargateService(this, 'Service', {
  serviceName: 'requirements-foundry-prod-service',
  cluster,
  taskDefinition,
  desiredCount: 1,
  securityGroups: [this.ecsSg],
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  assignPublicIp: false,
  circuitBreaker: { rollback: false },  // Don't rollback during initial bootstrap
});

// Register service with ALB target group
service.attachToApplicationTargetGroup(targetGroup);
```

### Secrets Manager: GetSecretValue in Node.js

```javascript
// Source: AWS SDK for JavaScript v3 - SecretsManagerClient docs
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({ region: 'us-east-1' });
const response = await client.send(
  new GetSecretValueCommand({ SecretId: 'requirements-foundry-prod/rds-credentials' })
);

// RDS-generated secret structure:
// { username, password, host, port, dbname, engine }
const secret = JSON.parse(response.SecretString);
const url = `postgresql://${secret.username}:${encodeURIComponent(secret.password)}@${secret.host}:${secret.port}/${secret.dbname}`;
```

### Dockerfile Modifications

```dockerfile
# In the runner stage, BEFORE USER nextjs:
# Copy entrypoint script
COPY entrypoint.js ./

# Copy Secrets Manager SDK (not traced by Next.js standalone)
COPY --from=builder /app/node_modules/@aws-sdk/client-secrets-manager ./node_modules/@aws-sdk/client-secrets-manager

# Change CMD
CMD ["node", "entrypoint.js"]
```

### Deploy Script: ECR Push and ECS Force Deploy

```bash
# Source: AWS CLI docs - ecr get-login-password, ecs update-service
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com"

docker build -t requirements-foundry-prod:latest .
docker tag requirements-foundry-prod:latest "${ECR_URI}:latest"
docker push "${ECR_URI}:latest"

aws ecs update-service \
  --cluster requirements-foundry-prod-cluster \
  --service requirements-foundry-prod-service \
  --force-new-deployment \
  --region us-east-1
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ECS with EC2 launch type | ECS Fargate (serverless) | GA 2018, dominant by 2022 | No EC2 instance management needed |
| Docker Compose for local + ECS | CDK-native ECS constructs | CDK v2 stable 2022 | Type-safe infrastructure, better DX |
| AWS SDK v2 (monolithic) | AWS SDK v3 (modular) | v3 GA 2021 | Tree-shakeable, smaller bundles |
| env files for secrets | Secrets Manager + entrypoint composition | Best practice 2020+ | No secrets in code, automatic rotation support |

**Deprecated/outdated:**
- `ApplicationLoadBalancedFargateService` L3 construct: Convenient but too opinionated for this use case (we need existing ALB, target group, and security groups). Use L2 constructs (FargateTaskDefinition + FargateService) for full control.

## Open Questions

1. **Secrets Manager SDK transitive dependencies in standalone output**
   - What we know: `@aws-sdk/client-secrets-manager` shares core deps with `@aws-sdk/client-s3` which IS traced. The shared `@aws-sdk/core`, `@smithy/*` packages may already be in standalone output.
   - What's unclear: Whether copying just the `client-secrets-manager` folder is sufficient, or if missing transitive deps will cause MODULE_NOT_FOUND.
   - Recommendation: Test locally by building the Docker image and running `node -e "require('@aws-sdk/client-secrets-manager')"` in the container. If it fails, also copy `@aws-sdk/middleware-*` and `@smithy/*` packages. Alternatively, use `outputFileTracingIncludes` in next.config.ts as the most reliable approach.

2. **Prisma migrate deploy in standalone container**
   - What we know: The Dockerfile copies `prisma/` schema and `node_modules/.prisma/` (generated client). But `prisma migrate deploy` needs the prisma CLI binary.
   - What's unclear: Whether `npx prisma` will find/download the CLI in the standalone environment, or if explicit copying is needed.
   - Recommendation: Copy prisma CLI explicitly: `COPY --from=builder /app/node_modules/prisma ./node_modules/prisma` and ensure `node_modules/.bin/prisma` symlink exists. Test in Docker build.

3. **ALB listener forwarding rule behavior**
   - What we know: The ALB listener has a default action of 503 AND a priority-1 rule forwarding `/*` to the target group. When the target group has healthy targets, the priority-1 rule matches first.
   - What's unclear: Whether the target group starts forwarding immediately when the service registers, or if there's a delay while health checks pass.
   - Recommendation: No CDK changes needed. The priority-1 rule already forwards to the target group. Once ECS registers healthy targets, traffic flows. Allow 60-90 seconds for initial health check pass (30s interval x 2 healthy threshold).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (infra tests), Vitest (app tests) |
| Config file | `infra/jest.config.js` (CDK tests), `vitest.config.ts` (app tests) |
| Quick run command | `cd infra && npx jest --testPathPattern=requirements-foundry-stack` |
| Full suite command | `cd infra && npx jest` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMP-01 | ECS Fargate task def with 512 CPU / 1024 MiB | unit (CDK assertion) | `cd infra && npx jest --testPathPattern=requirements-foundry-stack -t "TaskDefinition"` | Wave 0 -- add to existing test file |
| CMP-04 | Container logs via awslogs driver | unit (CDK assertion) | `cd infra && npx jest --testPathPattern=requirements-foundry-stack -t "LogGroup"` | Wave 0 -- add to existing test file |
| AI-01 | Bedrock invokes Claude with correct model ID | manual-only | Validate via deploy + test generation in browser | N/A -- runtime validation |
| AI-02 | ECS task role has bedrock:InvokeModel | unit (CDK assertion) | `cd infra && npx jest --testPathPattern=requirements-foundry-stack -t "Bedrock"` | Exists (Phase 22 tests) |
| AI-04 | Bedrock model access enabled (FTU form) | manual-only | AWS Console check + test generation in browser | N/A -- manual prerequisite |
| STOR-02 | Server-side S3 upload via FormData works from ECS | manual-only | Upload a document via browser, verify in S3 | N/A -- runtime validation |
| STOR-03 | Server-side S3 get/delete works from ECS | manual-only | Verify uploaded file is retrievable and deletable | N/A -- runtime validation |

### Sampling Rate
- **Per task commit:** `cd infra && npx jest --testPathPattern=requirements-foundry-stack`
- **Per wave merge:** `cd infra && npx jest`
- **Phase gate:** CDK tests green + manual end-to-end validation on AWS

### Wave 0 Gaps
- [ ] Add CDK assertions for FargateTaskDefinition (cpu=512, memory=1024) to `infra/test/requirements-foundry-stack.test.ts`
- [ ] Add CDK assertions for FargateService (desiredCount=1, securityGroups, subnets) to same file
- [ ] Add CDK assertions for CloudWatch LogGroup (`/ecs/requirements-foundry-prod`) to same file
- [ ] Add CDK assertion that container has port mapping 3000

## Sources

### Primary (HIGH confidence)
- [AWS CDK FargateTaskDefinition docs](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateTaskDefinition.html) - Constructor props, CPU/memory valid combinations
- [AWS CDK FargateService docs](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateService.html) - Service props, attachToApplicationTargetGroup method
- [AWS CDK LogDriver docs](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.LogDriver.html) - awsLogs driver configuration
- [AWS SDK v3 SecretsManagerClient docs](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/secrets-manager/) - GetSecretValueCommand API
- [aws-cdk-examples fargate-service-with-logging](https://github.com/aws-samples/aws-cdk-examples/blob/main/typescript/ecs/fargate-service-with-logging/index.ts) - Complete TypeScript example

### Secondary (MEDIUM confidence)
- [Next.js standalone output docs](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output) - node_modules tracing behavior
- [Next.js serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages) - outputFileTracingIncludes config
- [AWS ECS awslogs docs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html) - Log driver configuration options

### Tertiary (LOW confidence)
- Next.js standalone + Prisma CLI interaction needs Docker-level validation (multiple GitHub discussions, no definitive official guide)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - CDK ECS constructs are well-documented; AWS SDK v3 is stable
- Architecture: HIGH - Entrypoint pattern is standard for ECS + Secrets Manager; CDK extension approach is straightforward
- Pitfalls: HIGH - Standalone output tracing issues are well-known; special character encoding is a classic pitfall
- Validation: MEDIUM - Manual validation steps depend on AWS environment access and Bedrock FTU approval

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain; CDK and AWS SDK versions stable)
