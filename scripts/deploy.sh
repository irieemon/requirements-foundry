#!/bin/bash
set -euo pipefail

# Deploy Requirements Foundry to AWS ECS
# Usage: ./scripts/deploy.sh
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Docker running locally
#   - CDK stack deployed (run: cd infra && npx cdk deploy)

AWS_REGION="us-east-1"
ECR_REPO="requirements-foundry-prod"
CLUSTER="requirements-foundry-prod-cluster"
SERVICE="requirements-foundry-prod-service"

# Use finch if docker is not available
if command -v docker &>/dev/null; then
  CONTAINER_CLI="docker"
elif command -v finch &>/dev/null; then
  CONTAINER_CLI="finch"
else
  echo "Error: neither docker nor finch found" && exit 1
fi

echo "==> Getting AWS account ID..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

echo "==> Building Docker image..."
${CONTAINER_CLI} build --platform linux/amd64 -t "${ECR_REPO}:latest" .

echo "==> Authenticating with ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | \
  ${CONTAINER_CLI} login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "==> Tagging image..."
${CONTAINER_CLI} tag "${ECR_REPO}:latest" "${ECR_URI}:latest"

echo "==> Pushing to ECR..."
${CONTAINER_CLI} push "${ECR_URI}:latest"

echo "==> Updating ECS service (desired count 1, force new deployment)..."
aws ecs update-service \
  --cluster "${CLUSTER}" \
  --service "${SERVICE}" \
  --desired-count 1 \
  --force-new-deployment \
  --region "${AWS_REGION}" \
  --no-cli-pager

echo ""
echo "Deployment initiated successfully!"
echo ""
echo "Monitor deployment status:"
echo "  aws ecs describe-services --cluster ${CLUSTER} --services ${SERVICE} --region ${AWS_REGION} --query 'services[0].deployments' --no-cli-pager"
echo ""
echo "View logs:"
echo "  aws logs tail /ecs/requirements-foundry-prod --region ${AWS_REGION} --follow"
echo ""
echo "Get ALB URL:"
echo "  aws cloudformation describe-stacks --stack-name RequirementsFoundryStack --query 'Stacks[0].Outputs[?ExportName==\`rf-prod-alb-dns\`].OutputValue' --output text --region ${AWS_REGION}"
