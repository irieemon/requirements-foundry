# Phase 24: CI/CD and Operations - Research

**Researched:** 2026-03-09
**Domain:** GitHub Actions CI/CD, AWS OIDC, EventBridge/Lambda scheduling, CloudWatch alarms, SNS notifications
**Confidence:** HIGH

## Summary

Phase 24 adds three distinct capabilities to the existing CDK stack: (1) automated application deployment via GitHub Actions with OIDC authentication, (2) scheduled stale run recovery via EventBridge + Lambda replacing Vercel Cron, and (3) CloudWatch alarms with SNS email notification for operational monitoring.

All three are well-established AWS patterns with mature CDK L2 construct support. The existing CDK stack (`infra/lib/requirements-foundry-stack.ts`) already contains all prerequisite resources (ECS service, ALB, RDS, ECR). The cron endpoint (`app/api/cron/recover-stale-runs/route.ts`) already has Bearer token auth. The manual deploy script (`scripts/deploy.sh`) documents the exact build/push/deploy sequence to automate.

**Primary recommendation:** Add all new CDK constructs (OIDC provider, IAM role, Lambda, EventBridge rule, CloudWatch alarms, SNS topic) to the existing single stack. Create a `.github/workflows/deploy.yml` workflow that mirrors the manual deploy.sh steps with OIDC auth. Use `aws ecs update-service --force-new-deployment` rather than the `amazon-ecs-deploy-task-definition` action since the task definition is CDK-managed (not repo JSON).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- EventBridge rule triggers a Lambda function every 5 minutes
- Lambda calls `http://<ALB-DNS>/api/cron/recover-stale-runs` with Bearer token auth
- CRON_SECRET stored in AWS Secrets Manager (consistent with existing secret management pattern)
- Lambda reads secret from Secrets Manager at invocation time
- ALB endpoint used as the call target (currently internet-facing for POC)
- CRON_SECRET also passed to ECS container as environment variable so the cron route can validate it
- Push to `main` triggers the pipeline -- no PR checks, no manual approval gates
- Pipeline: build Docker image, push to ECR, deploy to ECS (no lint/typecheck/test steps)
- Application deploy only -- CDK infrastructure changes deployed manually via `cdk deploy`
- Workflow steps inline in GitHub Actions YAML (not calling deploy.sh) -- deploy.sh remains for manual deploys
- ECS rolling deployment with minimumHealthyPercent=100, maximumPercent=200 (CICD-03)
- SNS topic delivers alarm notifications to a single email address (POC)
- Email address passed via CDK context parameter: `cdk deploy --context alarmEmail=<email>`
- Three required alarms only: ECS running task count = 0, ALB unhealthy target count > 0, RDS CPU > 80%
- All alarms use 1 datapoint in 1 evaluation period -- fire immediately on first breach
- Container Insights already enabled on ECS cluster (no changes needed for OPS-01)
- Personal repo: `irieemon/requirements-foundry` (migrating to org repo later)
- OIDC trust policy scoped to main branch: `repo:irieemon/requirements-foundry:ref:refs/heads/main`
- GitHub OIDC provider and IAM role defined in CDK (version-controlled, reproducible)
- Repo path passed via CDK context parameter: `cdk deploy --context githubRepo=irieemon/requirements-foundry`

### Claude's Discretion
- Lambda runtime and implementation details (Node.js, Python, etc.)
- GitHub Actions workflow YAML structure and job naming
- CloudWatch alarm evaluation periods and metric namespaces
- OIDC IAM role permission boundaries (minimum permissions for ECR push + ECS deploy)
- SNS topic naming and configuration
- Whether Lambda needs VPC access or can call internet-facing ALB directly

### Deferred Ideas (OUT OF SCOPE)
- PR checks workflow (lint, typecheck, tests on pull requests) -- add when team grows
- CDK deployment automation via GitHub Actions -- add when infra changes become frequent
- Org repo migration -- update CDK context parameter `githubRepo` when org access is granted
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CICD-01 | GitHub Actions workflow builds Docker image, pushes to ECR, and deploys to ECS on push to main | GitHub Actions workflow pattern with `aws-actions/configure-aws-credentials`, `aws-actions/amazon-ecr-login`, Docker build/push, and `aws ecs update-service` |
| CICD-02 | OIDC authentication between GitHub Actions and AWS (no long-lived credentials) | CDK `iam.OpenIdConnectProvider` + `iam.Role` with `WebIdentityPrincipal` trust policy |
| CICD-03 | ECS rolling deployment with minimumHealthyPercent=100, maximumPercent=200 | CDK `deploymentConfiguration` property on `FargateService` |
| CRON-01 | Stale run recovery executes periodically (replaces Vercel Cron) | CDK EventBridge `Rule` with `Schedule.rate(Duration.minutes(5))` + Lambda target calling existing cron endpoint |
| OPS-01 | CloudWatch Container Insights enabled on ECS cluster | Already done -- `containerInsights: true` in existing CDK stack |
| OPS-02 | CloudWatch alarms for critical metrics (task count = 0, ALB unhealthy targets, RDS CPU > 80%) | CDK `cloudwatch.Alarm` with `cloudwatch.Metric` for AWS/ECS, AWS/ApplicationELB, AWS/RDS namespaces |
| OPS-03 | SNS topic delivers alarm notifications to email | CDK `sns.Topic` + `sns.Subscription` with email protocol + `alarm.addAlarmAction(new cloudwatch_actions.SnsAction(topic))` |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| aws-cdk-lib | ^2.241.0 | All CDK constructs | Already in infra/package.json |
| constructs | ^10.5.0 | CDK construct base | Already in infra/package.json |

### CDK Modules Used (all from aws-cdk-lib)
| Module | Purpose |
|--------|---------|
| `aws-cdk-lib/aws-iam` | OIDC provider, GitHub Actions IAM role |
| `aws-cdk-lib/aws-lambda` | Lambda function for cron caller |
| `aws-cdk-lib/aws-events` | EventBridge Rule with schedule |
| `aws-cdk-lib/aws-events-targets` | Lambda target for EventBridge |
| `aws-cdk-lib/aws-cloudwatch` | Metric and Alarm constructs |
| `aws-cdk-lib/aws-cloudwatch-actions` | SnsAction for alarm notifications |
| `aws-cdk-lib/aws-sns` | SNS Topic |
| `aws-cdk-lib/aws-sns-subscriptions` | Email subscription |
| `aws-cdk-lib/aws-secretsmanager` | CRON_SECRET (already imported) |

### GitHub Actions
| Action | Version | Purpose |
|--------|---------|---------|
| `actions/checkout` | v4 | Check out repository |
| `aws-actions/configure-aws-credentials` | v4 | Assume OIDC role |
| `aws-actions/amazon-ecr-login` | v2 | Authenticate Docker to ECR |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `aws ecs update-service` CLI | `aws-actions/amazon-ecs-deploy-task-definition` | Task def action requires JSON in repo; since task def is CDK-managed, `update-service --force-new-deployment` is simpler and correct |
| Lambda (Node.js) | Lambda (Python) | Node.js preferred -- consistent with TypeScript CDK stack, no additional runtime to manage |
| `lambda.Function` | `lambda_nodejs.NodejsFunction` | NodejsFunction uses esbuild but adds complexity; for a simple HTTP caller, inline code with `lambda.Function` + `Code.fromInline()` is sufficient |

**Installation:** No new npm packages needed. All modules are part of `aws-cdk-lib`.

## Architecture Patterns

### CDK Stack Additions
All new constructs go in the existing `infra/lib/requirements-foundry-stack.ts` file. Add them after the existing ECS service definition since they reference the service, ALB, and RDS resources.

```
infra/lib/requirements-foundry-stack.ts  (add to existing)
  +-- OIDC Provider + GitHub Actions IAM Role
  +-- CRON_SECRET in Secrets Manager
  +-- Lambda function (cron caller)
  +-- EventBridge Rule (every 5 min)
  +-- SNS Topic + Email Subscription
  +-- CloudWatch Alarms (3)
  +-- ECS Service deployment config update

.github/workflows/deploy.yml  (new file)
```

### Pattern 1: GitHub OIDC Provider + IAM Role in CDK

**What:** Define the OIDC identity provider and an IAM role that GitHub Actions can assume via web identity federation.
**When to use:** Any time GitHub Actions needs AWS access without long-lived credentials.

```typescript
// CDK: OIDC Provider
import * as iam from 'aws-cdk-lib/aws-iam';

const githubRepo = this.node.tryGetContext('githubRepo') || 'irieemon/requirements-foundry';

const oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
  url: 'https://token.actions.githubusercontent.com',
  clientIds: ['sts.amazonaws.com'],
});

const deployRole = new iam.Role(this, 'GitHubActionsRole', {
  roleName: 'requirements-foundry-github-actions',
  assumedBy: new iam.WebIdentityPrincipal(
    oidcProvider.openIdConnectProviderArn,
    {
      StringEquals: {
        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
      },
      StringLike: {
        'token.actions.githubusercontent.com:sub': `repo:${githubRepo}:ref:refs/heads/main`,
      },
    },
  ),
});

// Minimum permissions: ECR push + ECS deploy
repository.grantPush(deployRole);
deployRole.addToPolicy(new iam.PolicyStatement({
  actions: [
    'ecs:UpdateService',
    'ecs:DescribeServices',
    'ecs:DescribeTaskDefinition',
  ],
  resources: ['*'],  // Scope to cluster/service ARNs for production
}));
```

**Important:** Only ONE OIDC provider can exist per URL per AWS account. If another stack already created one for `token.actions.githubusercontent.com`, you must use `OpenIdConnectProvider.fromOpenIdConnectProviderArn()` instead.

### Pattern 2: EventBridge + Lambda for Scheduled HTTP Call

**What:** EventBridge rule triggers a Lambda every 5 minutes. Lambda reads CRON_SECRET from Secrets Manager and calls the ALB endpoint with Bearer auth.
**When to use:** Replacing Vercel Cron or any external cron scheduler.

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

// CRON_SECRET in Secrets Manager
const cronSecret = new secretsmanager.Secret(this, 'CronSecret', {
  secretName: 'requirements-foundry-prod/cron-secret',
  generateSecretString: { excludePunctuation: true, passwordLength: 32 },
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

// Lambda: call the cron endpoint
const cronLambda = new lambda.Function(this, 'CronCallerLambda', {
  functionName: 'requirements-foundry-cron-caller',
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromInline(`
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const http = require('http');

exports.handler = async () => {
  const sm = new SecretsManagerClient({});
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRET_NAME })
  );

  return new Promise((resolve, reject) => {
    const req = http.request(process.env.ENDPOINT_URL, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + SecretString },
      timeout: 25000,
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log('Status:', res.statusCode, 'Body:', body);
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
};
  `),
  environment: {
    SECRET_NAME: cronSecret.secretName,
    ENDPOINT_URL: `http://${alb.loadBalancerDnsName}/api/cron/recover-stale-runs`,
  },
  timeout: cdk.Duration.seconds(30),
  memorySize: 128,
});

// Grant Lambda read access to the secret
cronSecret.grantRead(cronLambda);

// EventBridge rule: every 5 minutes
new events.Rule(this, 'CronSchedule', {
  ruleName: 'requirements-foundry-cron-schedule',
  schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
  targets: [new targets.LambdaFunction(cronLambda)],
});
```

**Key decision -- no VPC access needed:** The ALB is internet-facing (POC), so the Lambda can call it directly without being placed in the VPC. This avoids VPC cold start overhead and NAT Gateway costs.

### Pattern 3: CloudWatch Alarms + SNS

**What:** Three alarms monitoring critical infrastructure, all sending to a single SNS email topic.
**When to use:** POC operational monitoring.

```typescript
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

const alarmEmail = this.node.tryGetContext('alarmEmail');

const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
  topicName: 'requirements-foundry-alarms',
});

if (alarmEmail) {
  alarmTopic.addSubscription(
    new sns_subscriptions.EmailSubscription(alarmEmail)
  );
}

const snsAction = new cloudwatch_actions.SnsAction(alarmTopic);

// Alarm 1: ECS running task count = 0
const taskCountAlarm = new cloudwatch.Alarm(this, 'EcsTaskCountAlarm', {
  alarmName: 'rf-prod-ecs-no-running-tasks',
  metric: new cloudwatch.Metric({
    namespace: 'AWS/ECS',
    metricName: 'RunningTaskCount',
    dimensionsMap: {
      ClusterName: cluster.clusterName,
      ServiceName: service.serviceName,
    },
    statistic: 'Average',
    period: cdk.Duration.minutes(1),
  }),
  threshold: 0,
  comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
  evaluationPeriods: 1,
  datapointsToAlarm: 1,
  treatMissingData: cloudwatch.TreatMissingData.BREACHING,
});
taskCountAlarm.addAlarmAction(snsAction);

// Alarm 2: ALB unhealthy target count > 0
const unhealthyTargetAlarm = new cloudwatch.Alarm(this, 'AlbUnhealthyTargetAlarm', {
  alarmName: 'rf-prod-alb-unhealthy-targets',
  metric: new cloudwatch.Metric({
    namespace: 'AWS/ApplicationELB',
    metricName: 'UnHealthyHostCount',
    dimensionsMap: {
      TargetGroup: targetGroup.targetGroupFullName,
      LoadBalancer: alb.loadBalancerFullName,
    },
    statistic: 'Maximum',
    period: cdk.Duration.minutes(1),
  }),
  threshold: 0,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  evaluationPeriods: 1,
  datapointsToAlarm: 1,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});
unhealthyTargetAlarm.addAlarmAction(snsAction);

// Alarm 3: RDS CPU > 80%
const rdsCpuAlarm = new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
  alarmName: 'rf-prod-rds-high-cpu',
  metric: new cloudwatch.Metric({
    namespace: 'AWS/RDS',
    metricName: 'CPUUtilization',
    dimensionsMap: {
      DBInstanceIdentifier: 'requirements-foundry-prod-rds',
    },
    statistic: 'Average',
    period: cdk.Duration.minutes(1),
  }),
  threshold: 80,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  evaluationPeriods: 1,
  datapointsToAlarm: 1,
  treatMissingData: cloudwatch.TreatMissingData.MISSING,
});
rdsCpuAlarm.addAlarmAction(snsAction);
```

### Pattern 4: GitHub Actions Deploy Workflow

**What:** Workflow triggered on push to main that builds, pushes to ECR, and deploys to ECS.

```yaml
# .github/workflows/deploy.yml
name: Deploy to ECS

on:
  push:
    branches: [main]

permissions:
  id-token: write   # Required for OIDC
  contents: read     # Required for checkout

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: requirements-foundry-prod
  ECS_CLUSTER: requirements-foundry-prod-cluster
  ECS_SERVICE: requirements-foundry-prod-service

jobs:
  deploy:
    name: Build and Deploy
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/requirements-foundry-github-actions
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build --platform linux/amd64 -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment \
            --region $AWS_REGION
```

**Note on platform:** The existing task definition uses `ARM64` (`runtimePlatform` in CDK). The GitHub Actions runner is `ubuntu-latest` (x86_64). The Docker build must use `--platform linux/arm64` to match the task definition, OR the task definition platform must be changed. This is a critical detail -- see Pitfalls section.

### Anti-Patterns to Avoid
- **Storing task definition JSON in repo:** The task definition is CDK-managed. Using `amazon-ecs-deploy-task-definition` would create two sources of truth.
- **Lambda in VPC for ALB calls:** The ALB is internet-facing. Placing Lambda in VPC adds cold start latency and requires NAT Gateway costs.
- **Multiple CDK stacks:** No reason to split -- everything is one application. Keep the single stack pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OIDC trust policy | Manual CloudFormation for OIDC provider | CDK `iam.OpenIdConnectProvider` | Handles thumbprint list automatically, proper IAM trust policy |
| Scheduled invocation | crontab, EC2 scheduler | EventBridge `Rule` + `Schedule.rate()` | Serverless, no infrastructure to maintain, built-in retry |
| Alarm notifications | Custom SNS publish logic | CDK `cloudwatch_actions.SnsAction` | Wires alarm -> SNS automatically with correct permissions |
| ECR login in CI | Manual `aws ecr get-login-password` | `aws-actions/amazon-ecr-login@v2` | Handles token, registry URL, multi-region properly |
| AWS credential config in CI | Manual env var setup | `aws-actions/configure-aws-credentials@v4` | Handles OIDC token exchange, session duration, region |

## Common Pitfalls

### Pitfall 1: ARM64 vs x86_64 Architecture Mismatch
**What goes wrong:** The CDK task definition specifies `CpuArchitecture.ARM64` but GitHub Actions `ubuntu-latest` runners are x86_64. Docker build without explicit `--platform linux/arm64` produces an x86_64 image that fails to start on ARM64 Fargate.
**Why it happens:** Docker defaults to the host architecture.
**How to avoid:** Use `docker build --platform linux/arm64` in the workflow. Alternatively, change the CDK task definition to `CpuArchitecture.X86_64` (simpler, avoids cross-compilation). ARM64 is cheaper on Fargate but cross-compilation is slower in CI.
**Warning signs:** ECS task starts but immediately exits with exec format error.

### Pitfall 2: OIDC Provider Already Exists
**What goes wrong:** `cdk deploy` fails with "Provider with url already exists" if another stack or manual setup already created the GitHub OIDC provider.
**Why it happens:** Only one OIDC provider per URL per AWS account.
**How to avoid:** Use a try/catch approach in CDK or check first. If it exists, use `iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn()`.
**Warning signs:** CloudFormation CREATE_FAILED on the OIDC provider resource.

### Pitfall 3: SNS Email Subscription Requires Manual Confirmation
**What goes wrong:** Alarms appear to work but no emails arrive.
**Why it happens:** SNS email subscriptions require the recipient to click a confirmation link in their inbox. Until confirmed, the subscription is "PendingConfirmation" and no messages are delivered.
**How to avoid:** After `cdk deploy`, immediately check the email inbox and confirm the subscription. Document this as a post-deploy step.
**Warning signs:** SNS subscription status shows "PendingConfirmation" in the AWS Console.

### Pitfall 4: ECS RunningTaskCount Metric Requires Container Insights
**What goes wrong:** The `AWS/ECS` namespace has limited metrics without Container Insights. `RunningTaskCount` is only available when Container Insights is enabled.
**Why it happens:** Standard ECS metrics only include CPUUtilization and MemoryUtilization at the service level.
**How to avoid:** Container Insights is already enabled (`containerInsights: true`). This pitfall is pre-mitigated.
**Warning signs:** CloudWatch shows no data for the RunningTaskCount metric.

### Pitfall 5: Lambda Inline Code Size Limit
**What goes wrong:** `Code.fromInline()` has a 4KB limit (after minification). Complex Lambda code exceeds this.
**Why it happens:** CloudFormation template size constraints.
**How to avoid:** Keep the Lambda simple (just HTTP call + secret fetch). If it grows, switch to `Code.fromAsset()` with a file. The cron caller Lambda is well within the limit.
**Warning signs:** CDK synth or deploy fails with "inline code too long".

### Pitfall 6: `AWS_ACCOUNT_ID` Not Available by Default
**What goes wrong:** The GitHub Actions workflow references `secrets.AWS_ACCOUNT_ID` but this is not a built-in secret -- it must be manually added to the repository secrets.
**Why it happens:** OIDC eliminates AWS credentials but the account ID is still needed to construct the role ARN.
**How to avoid:** Add `AWS_ACCOUNT_ID` as a GitHub repository secret (it's not sensitive per se, but keeps the workflow portable). Alternatively, output the role ARN from CDK and use that directly.
**Warning signs:** Workflow fails at "Configure AWS credentials" step.

## Code Examples

### ECS Service Deployment Configuration Update (CICD-03)
```typescript
// Modify existing FargateService in CDK stack
const service = new ecs.FargateService(this, 'Service', {
  // ... existing props ...
  deploymentConfiguration: {
    minimumHealthyPercent: 100,
    maximumPercent: 200,
  },
  circuitBreaker: { enable: true, rollback: false },
});
```

### Adding CRON_SECRET to ECS Container Environment
```typescript
// In the container definition, add CRON_SECRET from Secrets Manager
taskDefinition.addContainer('AppContainer', {
  // ... existing props ...
  secrets: {
    CRON_SECRET: ecs.Secret.fromSecretsManager(cronSecret),
  },
});
```

### RDS Metric Using Database Instance Reference
```typescript
// Better: use dbInstance.metric() if CDK exposes it, otherwise manual Metric
// For RDS, CDK's DatabaseInstance does have .metric() support:
const rdsCpuMetric = dbInstance.metric('CPUUtilization', {
  statistic: 'Average',
  period: cdk.Duration.minutes(1),
});

new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
  metric: rdsCpuMetric,
  threshold: 80,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IAM access keys in GitHub secrets | OIDC with `WebIdentityPrincipal` | 2022+ (now standard) | No long-lived credentials, automatic rotation |
| `amazon-ecs-deploy-task-definition` with JSON | `aws ecs update-service --force-new-deployment` with CDK-managed task defs | N/A | Avoids dual source of truth for task definition |
| Vercel Cron headers | EventBridge + Lambda with Bearer token | Project-specific migration | Same auth pattern, different scheduler |
| Custom monitoring scripts | CDK CloudWatch Alarms + SNS | Always available | Declarative, version-controlled |

## Open Questions

1. **ARM64 vs x86_64 for CI builds**
   - What we know: CDK task def uses ARM64. GitHub runners are x86_64. Cross-compilation via `--platform linux/arm64` works but is slower.
   - What's unclear: Whether to switch to x86_64 in CDK (simpler CI, slightly higher Fargate cost) or keep ARM64 (cheaper Fargate, slower CI builds).
   - Recommendation: Keep ARM64 since it's already deployed and working. Use `docker build --platform linux/arm64` in CI. Build time difference is minor for this application size.

2. **OIDC Provider singleton handling**
   - What we know: Only one provider per URL per account. If another stack already created it, CDK deploy will fail.
   - What's unclear: Whether the GitHub OIDC provider already exists in the target AWS account.
   - Recommendation: Attempt to create it in CDK. If deploy fails, switch to `fromOpenIdConnectProviderArn()` with the existing provider's ARN.

3. **CRON_SECRET initial value**
   - What we know: The secret needs to be created in Secrets Manager AND set as an ECS container env var. CDK can auto-generate a secret string.
   - What's unclear: Nothing -- CDK `generateSecretString` handles this. Both Lambda and ECS container read the same secret.
   - Recommendation: Use `generateSecretString` in CDK. Both Lambda and ECS reference the same secret ARN.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (infrastructure deployment) |
| Config file | N/A -- infrastructure tests via CDK synth |
| Quick run command | `cd infra && npx cdk synth --quiet` |
| Full suite command | `cd infra && npx cdk synth && npx cdk diff` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CICD-01 | Push to main triggers build/push/deploy | smoke | Push a commit and verify new task running: `aws ecs describe-services --cluster requirements-foundry-prod-cluster --services requirements-foundry-prod-service --query 'services[0].deployments'` | N/A -- GitHub workflow |
| CICD-02 | OIDC auth (no stored credentials) | smoke | Verify GitHub workflow uses `id-token: write` permission and `configure-aws-credentials` with `role-to-assume` | N/A -- workflow YAML inspection |
| CICD-03 | Rolling deployment config | unit | `cd infra && npx cdk synth --quiet` then inspect CloudFormation for DeploymentConfiguration | Wave 0 |
| CRON-01 | Stale run recovery runs periodically | smoke | `aws events describe-rule --name requirements-foundry-cron-schedule` + check Lambda invocation logs | N/A -- manual post-deploy |
| OPS-01 | Container Insights enabled | unit | Already done -- verify `containerInsights: true` in CDK stack | Already exists |
| OPS-02 | CloudWatch alarms exist | smoke | `aws cloudwatch describe-alarms --alarm-name-prefix rf-prod` | N/A -- manual post-deploy |
| OPS-03 | SNS email notification | smoke | `aws sns list-subscriptions-by-topic --topic-arn <ARN>` + trigger test alarm | N/A -- manual post-deploy |

### Sampling Rate
- **Per task commit:** `cd infra && npx cdk synth --quiet` (validates CDK compiles and synthesizes)
- **Per wave merge:** `cd infra && npx cdk synth && npx cdk diff` (validates CDK changes against deployed stack)
- **Phase gate:** Full `cdk deploy` + manual verification of all 7 requirements

### Wave 0 Gaps
- [ ] Verify CDK synth passes with new constructs before deploy
- [ ] Confirm GitHub OIDC provider does not already exist in AWS account
- [ ] Confirm `AWS_ACCOUNT_ID` secret is set in GitHub repository settings

## Sources

### Primary (HIGH confidence)
- [GitHub Docs: Configuring OIDC in AWS](https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) - OIDC workflow configuration, permissions block
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) - Official action for OIDC role assumption
- [aws-actions/amazon-ecr-login](https://github.com/aws-actions/amazon-ecr-login) - Official ECR login action
- [AWS CDK CloudWatch README](https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-cloudwatch/README.md) - Metric, Alarm, and action patterns
- [AWS CDK Events README](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_events-readme.html) - Rule and Schedule patterns
- [AWS CDK Events Targets README](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_events_targets-readme.html) - LambdaFunction target

### Secondary (MEDIUM confidence)
- [Towards The Cloud: CDK OIDC GitHub](https://towardsthecloud.com/blog/aws-cdk-openid-connect-github) - CDK OpenIdConnectProvider + WebIdentityPrincipal pattern
- [DEV.to: Deploy container from GitHub to ECR/ECS via OIDC](https://dev.to/syed_omair/how-to-deploy-a-container-from-github-to-aws-ecr-through-oidc-2ma5) - Complete workflow example
- [AWS Blog: Use IAM roles for GitHub Actions](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/) - AWS official blog on OIDC best practices
- [AWS ECS CloudWatch Metrics Docs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cloudwatch-metrics.html) - Metric names and namespaces

### Tertiary (LOW confidence)
- None -- all findings verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all constructs from aws-cdk-lib already in project, well-documented
- Architecture: HIGH - patterns follow official AWS samples and docs
- Pitfalls: HIGH - based on known CloudFormation/OIDC constraints documented in official issues
- GitHub Actions workflow: HIGH - follows official GitHub + AWS action documentation

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable patterns, unlikely to change)
