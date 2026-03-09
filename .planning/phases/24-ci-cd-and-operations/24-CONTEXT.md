# Phase 24: CI/CD and Operations - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Automate application deployments via GitHub Actions with OIDC authentication, replace Vercel Cron with EventBridge + Lambda for stale run recovery, and add CloudWatch alarms with SNS email notifications for critical operational metrics. CDK infrastructure changes are deployed manually; only application code deploys are automated.

</domain>

<decisions>
## Implementation Decisions

### Stale run scheduling
- EventBridge rule triggers a Lambda function every 5 minutes
- Lambda calls `http://<ALB-DNS>/api/cron/recover-stale-runs` with Bearer token auth
- CRON_SECRET stored in AWS Secrets Manager (consistent with existing secret management pattern)
- Lambda reads secret from Secrets Manager at invocation time
- ALB endpoint used as the call target (currently internet-facing for POC)
- CRON_SECRET also passed to ECS container as environment variable so the cron route can validate it

### CI/CD workflow
- Push to `main` triggers the pipeline — no PR checks, no manual approval gates
- Pipeline: build Docker image, push to ECR, deploy to ECS (no lint/typecheck/test steps)
- Application deploy only — CDK infrastructure changes deployed manually via `cdk deploy`
- Workflow steps inline in GitHub Actions YAML (not calling deploy.sh) — deploy.sh remains for manual deploys
- ECS rolling deployment with minimumHealthyPercent=100, maximumPercent=200 (CICD-03)

### Alarm targets & thresholds
- SNS topic delivers alarm notifications to a single email address (POC)
- Email address passed via CDK context parameter: `cdk deploy --context alarmEmail=<email>`
- Three required alarms only:
  1. ECS running task count = 0 (service down)
  2. ALB unhealthy target count > 0 (health check failures)
  3. RDS CPU utilization > 80%
- All alarms use 1 datapoint in 1 evaluation period — fire immediately on first breach
- Container Insights already enabled on ECS cluster (no changes needed for OPS-01)

### GitHub repository & OIDC
- Personal repo: `irieemon/requirements-foundry` (migrating to org repo later)
- OIDC trust policy scoped to main branch: `repo:irieemon/requirements-foundry:ref:refs/heads/main`
- GitHub OIDC provider and IAM role defined in CDK (version-controlled, reproducible)
- Repo path passed via CDK context parameter: `cdk deploy --context githubRepo=irieemon/requirements-foundry`
- Easy to update when migrating to org repo — just change the context value

### Claude's Discretion
- Lambda runtime and implementation details (Node.js, Python, etc.)
- GitHub Actions workflow YAML structure and job naming
- CloudWatch alarm evaluation periods and metric namespaces
- OIDC IAM role permission boundaries (minimum permissions for ECR push + ECS deploy)
- SNS topic naming and configuration
- Whether Lambda needs VPC access or can call internet-facing ALB directly

</decisions>

<specifics>
## Specific Ideas

- The existing `scripts/deploy.sh` has the complete manual workflow (build, ECR auth, push, ECS force-deploy) — the GitHub Actions workflow automates this same sequence
- The cron route at `app/api/cron/recover-stale-runs/route.ts` already has Bearer token auth with `CRON_SECRET` env var support
- Container Insights is already enabled (`containerInsights: true` in CDK stack) — OPS-01 is effectively done

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/api/cron/recover-stale-runs/route.ts`: Complete cron endpoint with Bearer token auth, health status before/after, recovery result logging
- `scripts/deploy.sh`: Manual deploy workflow (build, ECR login, push, ECS force-deploy) — reference for GitHub Actions steps
- `infra/lib/requirements-foundry-stack.ts`: CDK stack with all infrastructure — alarms, SNS, Lambda, OIDC role get added here

### Established Patterns
- Secrets Manager for sensitive values (RDS credentials, DATABASE_URL)
- SSM Parameter Store for non-sensitive config (bucket name, region, ECR URI)
- CDK context parameters for deploy-time configuration (new pattern for email and repo path)
- CfnOutput exports with `rf-prod-*` naming convention

### Integration Points
- CDK stack: Add OIDC provider, GitHub Actions IAM role, Lambda function, EventBridge rule, CloudWatch alarms, SNS topic
- ECS service: Add `CRON_SECRET` environment variable from Secrets Manager
- ECS service: Update deployment configuration for rolling deploys (minimumHealthyPercent, maximumPercent)
- `.github/workflows/`: New directory and deploy workflow YAML file

</code_context>

<deferred>
## Deferred Ideas

- PR checks workflow (lint, typecheck, tests on pull requests) — add when team grows
- CDK deployment automation via GitHub Actions — add when infra changes become frequent
- Org repo migration — update CDK context parameter `githubRepo` when org access is granted

</deferred>

---

*Phase: 24-ci-cd-and-operations*
*Context gathered: 2026-03-09*
