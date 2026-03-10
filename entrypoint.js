const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const { execSync } = require("child_process");
const crypto = require("crypto");

async function main() {
  console.log("Starting entrypoint...");

  // 1. Read RDS credentials from Secrets Manager
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || "us-east-1",
  });
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId:
        process.env.RDS_SECRET_NAME ||
        "requirements-foundry-prod/rds-credentials",
    })
  );

  const secret = JSON.parse(response.SecretString);
  const databaseUrl = `postgresql://${secret.username}:${encodeURIComponent(secret.password)}@${secret.host}:${secret.port}/${secret.dbname || "requirements_foundry"}?sslmode=require`;

  // 2. Export DATABASE_URL
  process.env.DATABASE_URL = databaseUrl;
  console.log("DATABASE_URL composed from Secrets Manager");

  // 3. Read Cognito client secret from Secrets Manager
  try {
    const cognitoResponse = await client.send(
      new GetSecretValueCommand({
        SecretId:
          process.env.COGNITO_SECRET_NAME ||
          "requirements-foundry-prod/cognito-client-secret",
      })
    );
    const cognitoSecret = JSON.parse(cognitoResponse.SecretString);
    process.env.COGNITO_CLIENT_SECRET = cognitoSecret.clientSecret;
    console.log("COGNITO_CLIENT_SECRET loaded from Secrets Manager");
  } catch (error) {
    console.warn("Cognito secret not available:", error.message);
    // Non-fatal: auth features won't work but app can still start
  }

  // 4. Generate SESSION_SECRET if not already set (for iron-session cookie encryption)
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
    console.log("SESSION_SECRET generated (ephemeral -- will rotate on restart)");
  }

  // 5. Run Prisma migrations
  console.log("Running prisma migrate deploy...");
  try {
    execSync("node ./node_modules/prisma/build/index.js migrate deploy", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    console.log("Migrations complete");
  } catch (error) {
    console.error("Migration failed:", error.message);
    // Continue anyway -- migrations may not exist yet or may already be applied
  }

  // 6. Start the application (require keeps same process for SIGTERM handling)
  console.log("Starting server...");
  require("./server.js");
}

main().catch((error) => {
  console.error("Entrypoint failed:", error);
  process.exit(1);
});
