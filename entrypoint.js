const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const { execSync } = require("child_process");

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

  // 3. Run Prisma migrations
  console.log("Running prisma migrate deploy...");
  try {
    // Resolve any previously failed migrations
    try {
      execSync("node ./node_modules/prisma/build/index.js migrate resolve --rolled-back 20260305000000_rename_blob_to_storage", {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
    } catch (e) {
      // Ignore - migration may not be in failed state
    }
    execSync("node ./node_modules/prisma/build/index.js migrate deploy", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    console.log("Migrations complete");
  } catch (error) {
    console.error("Migration failed:", error.message);
    // Continue anyway -- migrations may not exist yet or may already be applied
  }

  // 4. Test direct pg connection before starting server
  const { Pool } = require("pg");
  // Test: direct pg connection with SSL
  try {
    const url = new URL(databaseUrl);
    const pool = new Pool({
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: { rejectUnauthorized: false },
    });
    const result = await pool.query("SELECT current_user, current_database()");
    console.log("pg connection test OK:", JSON.stringify(result.rows));
    await pool.end();
  } catch (pgErr) {
    console.error("pg connection test FAILED:", pgErr.message);
  }

  // 5. Start the application (require keeps same process for SIGTERM handling)
  console.log("Starting server...");
  require("./server.js");
}

main().catch((error) => {
  console.error("Entrypoint failed:", error);
  process.exit(1);
});
