---
phase: 24-ci-cd-and-operations
plan: 01
subsystem: infra
tags: [cdk, oidc, lambda, eventbridge, cloudwatch, sns, ecs, iam]

# Dependency graph
requires:
  - phase: 22-infrastructure-foundation
    provides: CDK stack with VPC, ECS cluster, ALB, RDS, ECR, security groups
  - phase: 23-compute-and-deployment
    provides: ECS service, task definition, container config, ALB target group wiring
provides:
  - GitHub OIDC provider and IAM role for CI/CD deployments
  - CRON_SECRET in Secrets Manager injected into ECS container
  - Lambda cron caller with EventBridge 5-minute schedule
  - CloudWatch alarms (ECS tasks=0, ALB unhealthy, RDS CPU>80%) with SNS email
  - ECS rolling deployment configuration (100/200)
  - CfnOutputs for deploy role ARN, cron secret ARN, alarm topic ARN
affects: [24-02, 24-03, 25-monitoring-and-observability]

# Tech tracking
tech-stack:
  added: [aws-lambda, aws-events, aws-events-targets, aws-cloudwatch, aws-cloudwatch-actions, aws-sns, aws-sns-subscriptions]
  patterns: [CDK context parameters for deploy-time config, inline Lambda with Secrets Manager, EventBridge scheduled rule, CloudWatch alarm to SNS notification chain]

key-files:
  created: []
  modified: [infra/lib/requirements-foundry-stack.ts]

key-decisions:
  - "CDK FargateService uses minHealthyPercent/maxHealthyPercent props (not nested deploymentConfiguration object)"
  - "ECS/ContainerInsights namespace for RunningTaskCount metric (not AWS/ECS)"
  - "Lambda calls internet-facing ALB directly (no VPC access needed)"
  - "dbInstance.metric() used for RDS CPU alarm (type-safe CDK pattern)"

patterns-established:
  - "CDK context parameters: githubRepo and alarmEmail passed via cdk deploy --context"
  - "Secrets Manager secret injection into ECS container via ecs.Secret.fromSecretsManager()"
  - "CloudWatch alarm chain: Metric -> Alarm -> SnsAction -> SNS Topic -> Email"

requirements-completed: [CICD-02, CICD-03, CRON-01, OPS-01, OPS-02, OPS-03]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 24 Plan 01: CDK Infrastructure Summary

**GitHub OIDC provider, Lambda cron caller with EventBridge schedule, 3 CloudWatch alarms with SNS email, and ECS rolling deployment config added to CDK stack**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T15:49:16Z
- **Completed:** 2026-03-09T15:53:04Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- GitHub OIDC provider and IAM role with minimum ECR push + ECS deploy permissions
- CRON_SECRET auto-generated in Secrets Manager and injected into ECS container
- Lambda cron caller reads secret and calls ALB endpoint every 5 minutes via EventBridge
- Three CloudWatch alarms (ECS tasks=0, ALB unhealthy targets, RDS CPU>80%) all notifying SNS topic
- ECS rolling deployment with minHealthyPercent=100, maxHealthyPercent=200
- SNS email subscription conditionally added when alarmEmail CDK context provided

## Task Commits

Each task was committed atomically:

1. **Task 1: Add OIDC, deployment config, cron infrastructure** - `1c976f3` (feat)
2. **Task 2: Add CloudWatch alarms and SNS email notifications** - `cd02676` (feat)

## Files Created/Modified
- `infra/lib/requirements-foundry-stack.ts` - Added OIDC provider, IAM role, CRON_SECRET, Lambda, EventBridge rule, 3 CloudWatch alarms, SNS topic, deployment config, 3 new CfnOutputs

## Decisions Made
- CDK `FargateServiceProps` uses `minHealthyPercent`/`maxHealthyPercent` directly (not nested `deploymentConfiguration` object as planned -- the plan's property name was incorrect for the CDK API)
- Used `ECS/ContainerInsights` namespace for RunningTaskCount alarm (as specified in plan, correcting the research doc which had `AWS/ECS`)
- Used `dbInstance.metric('CPUUtilization')` for RDS alarm instead of manual `cloudwatch.Metric` with hardcoded dimensions (more type-safe)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed deploymentConfiguration property name**
- **Found during:** Task 1 (ECS deployment config)
- **Issue:** Plan specified `deploymentConfiguration: { minimumHealthyPercent, maximumPercent }` but CDK `FargateServiceProps` uses `minHealthyPercent` and `maxHealthyPercent` as top-level properties
- **Fix:** Changed to `minHealthyPercent: 100, maxHealthyPercent: 200` directly on the service props
- **Files modified:** infra/lib/requirements-foundry-stack.ts
- **Verification:** CDK synth passes, CloudFormation output shows MinimumHealthyPercent: 100, MaximumPercent: 200
- **Committed in:** 1c976f3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Property name correction necessary for CDK compilation. No scope creep.

## Issues Encountered
None beyond the deployment config property name fix documented above.

## User Setup Required
None - no external service configuration required. SNS email subscription confirmation will be needed after `cdk deploy` with `--context alarmEmail=<email>`.

## Next Phase Readiness
- CDK stack synthesizes cleanly with all Phase 24 infrastructure constructs
- Ready for Plan 02 (GitHub Actions workflow YAML) which will reference the OIDC role ARN output
- Ready for Plan 03 (verification) after CDK deploy
- Post-deploy: user must confirm SNS email subscription and set `AWS_ACCOUNT_ID` GitHub repository secret

---
*Phase: 24-ci-cd-and-operations*
*Completed: 2026-03-09*
