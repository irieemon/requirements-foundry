import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires a driver adapter for PostgreSQL
// Support both DATABASE_URL (standard) and POSTGRES_URL (Vercel Postgres)
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL or POSTGRES_URL environment variable is not set");
}

console.log("Connecting to database...");

// PrismaPg adapter for PostgreSQL
const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create prompt templates
  const promptTemplates = [
    {
      name: "extract_cards",
      version: 1,
      description: "Template for extracting structured cards from raw text",
      content: `You are a requirements analyst. Extract structured use case cards from the following raw text.

For each distinct use case or initiative you identify, create a card with:
- title: A clear, concise title
- problem: The problem or opportunity being addressed
- targetUsers: Who will benefit or be affected
- currentState: How things work today (if mentioned)
- desiredOutcomes: What success looks like, KPIs
- constraints: Any limitations or requirements
- systems: Technical systems involved
- priority: If mentioned (high/medium/low)
- impact: Business impact if mentioned

RAW TEXT:
{{rawText}}

Return ONLY valid JSON array of cards.`,
    },
    {
      name: "generate_epics",
      version: 1,
      description: "Template for generating epics from cards",
      content: `You are a product requirements analyst. Analyze the following use case cards and generate a set of Epics that cover the key themes and initiatives.

{{projectContext}}

USE CASE CARDS:
{{cards}}

Generate Epics in JSON format. Each epic should:
- Have a unique code (E1, E2, E3, etc.)
- Synthesize related cards into cohesive themes
- Include clear business value statements
- Identify dependencies between epics
- Estimate effort (S/M/L)
- Assess impact (high/medium/low)
- Suggest priority (1 = highest)

Return ONLY valid JSON array.`,
    },
    {
      name: "generate_stories",
      version: 1,
      description: "Template for generating user stories from an epic",
      content: `You are a product requirements analyst. Generate User Stories for the following Epic.

EPIC:
{{epic}}

GENERATION MODE: {{mode}}
{{modeConfig}}

PERSONAS TO CONSIDER:
{{personas}}

Generate stories in JSON format. Each story should:
- Have a unique code within this epic (S1, S2, S3, etc.)
- Follow the "As a [persona], I want [goal], so that [benefit]" format
- Include specific acceptance criteria
- Estimate effort (XS/S/M/L/XL or story points 1-13)
- Assign priority (Must/Should/Could/Won't for MoSCoW)

Return ONLY valid JSON array.`,
    },
    {
      name: "system_rubric",
      version: 1,
      description: "Universal Requirements Engine rubric for generation",
      content: `# Universal Requirements Engine Rubric

## Epic Structure
Each epic represents a cohesive body of work that delivers business value. Epics should:
- Address a clear business need or opportunity
- Be decomposable into 5-15 user stories
- Have measurable acceptance criteria
- Identify dependencies and risks

## User Story Structure
Stories follow the format: "As a [persona], I want [goal], so that [benefit]"

Acceptance Criteria use Given/When/Then format:
- Given [precondition]
- When [action]
- Then [expected result]

## Persona Guidelines
- Lightweight (3): End User, Administrator, System
- Core (5): + Product Owner, Developer
- Full (9): + QA Engineer, Security Analyst, Support Agent, Operations

## Generation Modes
- Compact (5-8 stories): Core journeys, happy paths only
- Standard (8-12 stories): Full coverage with primary edge cases
- Detailed (12-15 stories): Exhaustive with edge cases and alt flows

## Priority (MoSCoW)
- Must: Critical for release, non-negotiable
- Should: Important but not critical
- Could: Desirable if time permits
- Won't: Explicitly out of scope for this release`,
    },
  ];

  for (const template of promptTemplates) {
    await prisma.promptTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template,
    });
  }
  console.log("Created prompt templates");

  // Create sample project
  const project = await prisma.project.create({
    data: {
      name: "Digital Transformation Initiative",
      description:
        "Q1 2024 initiative to modernize customer-facing applications and internal workflows",
    },
  });
  console.log("Created sample project:", project.name);

  // Create sample upload
  const upload = await prisma.upload.create({
    data: {
      projectId: project.id,
      filename: "strategy-workshop-notes.md",
      fileType: "text/markdown",
      extractionStatus: "EXTRACTED",
      analysisStatus: "COMPLETED",
      rawContent: `# Customer Portal Modernization

## Use Case 1: Self-Service Account Management
Problem: Customers must call support for basic account changes
Target Users: Retail customers, Small business owners
Current State: 80% of support calls are for account updates
Desired Outcomes: Reduce support calls by 60%, <5 min to complete changes
Constraints: Must integrate with legacy CRM
Systems: Customer Portal, CRM, Identity Provider
Priority: High
Impact: High

---

## Use Case 2: Real-Time Order Tracking
Problem: Customers have no visibility into order status
Target Users: All customers
Current State: Order status only available via email or phone
Desired Outcomes: Real-time tracking, push notifications
Constraints: Multiple fulfillment partners with different APIs
Systems: Order Management, Shipping APIs, Mobile App
Priority: High

---

## Use Case 3: Automated Invoice Processing
Problem: Manual invoice processing takes 3-5 days
Target Users: Finance team, Vendors
Current State: PDF invoices manually entered into system
Desired Outcomes: Same-day processing, 99% accuracy
Constraints: Must support multiple invoice formats
Systems: AP System, Document Scanner, ERP
Priority: Medium`,
    },
  });

  // Create sample cards
  const cards = await prisma.card.createMany({
    data: [
      {
        projectId: project.id,
        uploadId: upload.id,
        title: "Self-Service Account Management",
        problem: "Customers must call support for basic account changes",
        targetUsers: "Retail customers, Small business owners",
        currentState: "80% of support calls are for account updates",
        desiredOutcomes: "Reduce support calls by 60%, <5 min to complete changes",
        constraints: "Must integrate with legacy CRM",
        systems: "Customer Portal, CRM, Identity Provider",
        priority: "High",
        impact: "High",
      },
      {
        projectId: project.id,
        uploadId: upload.id,
        title: "Real-Time Order Tracking",
        problem: "Customers have no visibility into order status",
        targetUsers: "All customers",
        currentState: "Order status only available via email or phone",
        desiredOutcomes: "Real-time tracking, push notifications",
        constraints: "Multiple fulfillment partners with different APIs",
        systems: "Order Management, Shipping APIs, Mobile App",
        priority: "High",
      },
      {
        projectId: project.id,
        uploadId: upload.id,
        title: "Automated Invoice Processing",
        problem: "Manual invoice processing takes 3-5 days",
        targetUsers: "Finance team, Vendors",
        currentState: "PDF invoices manually entered into system",
        desiredOutcomes: "Same-day processing, 99% accuracy",
        constraints: "Must support multiple invoice formats",
        systems: "AP System, Document Scanner, ERP",
        priority: "Medium",
      },
    ],
  });
  console.log("Created", cards.count, "sample cards");

  // Create sample epics
  const epic1 = await prisma.epic.create({
    data: {
      projectId: project.id,
      code: "E1",
      title: "Customer Self-Service Portal",
      theme: "Customer Experience",
      description:
        "Enable customers to manage their accounts and view orders without contacting support",
      businessValue:
        "Reduces support costs by 60% and improves customer satisfaction scores",
      acceptanceCriteria: JSON.stringify([
        "Customers can update profile information",
        "Customers can view and download invoices",
        "Real-time order status is visible",
        "Push notifications for order updates",
      ]),
      dependencies: JSON.stringify([]),
      effort: "L",
      impact: "high",
      priority: 1,
    },
  });

  const epic2 = await prisma.epic.create({
    data: {
      projectId: project.id,
      code: "E2",
      title: "Invoice Automation Platform",
      theme: "Operational Efficiency",
      description:
        "Automate the processing of vendor invoices from receipt to payment",
      businessValue:
        "Reduces processing time from 3-5 days to same-day, eliminates manual data entry errors",
      acceptanceCriteria: JSON.stringify([
        "OCR extracts data from PDF invoices",
        "Automatic validation against POs",
        "Exception workflow for discrepancies",
        "Integration with ERP system",
      ]),
      dependencies: JSON.stringify(["E1"]),
      effort: "M",
      impact: "medium",
      priority: 2,
    },
  });

  console.log("Created sample epics");

  // Create sample stories for Epic 1
  await prisma.story.createMany({
    data: [
      {
        epicId: epic1.id,
        code: "S1",
        title: "View Account Dashboard",
        userStory:
          "As an End User, I want to view my account dashboard, so that I can see my account status at a glance.",
        persona: "End User",
        acceptanceCriteria: JSON.stringify([
          "Given I am logged in, When I access my account, Then I see my profile summary",
          "Given I am logged in, When I view the dashboard, Then I see my recent orders",
          "Given I am logged in, When I view the dashboard, Then I see any pending actions",
        ]),
        technicalNotes: "Use existing authentication system. Dashboard should load in <2s.",
        priority: "Must",
        effort: "M",
      },
      {
        epicId: epic1.id,
        code: "S2",
        title: "Update Contact Information",
        userStory:
          "As an End User, I want to update my contact information, so that I receive communications at the correct address.",
        persona: "End User",
        acceptanceCriteria: JSON.stringify([
          "Given I am on my profile, When I edit my email, Then I receive a verification email",
          "Given I am on my profile, When I edit my phone, Then I receive an SMS verification",
          "Given I save changes, When the update completes, Then I see a confirmation message",
        ]),
        technicalNotes: "Sync changes to CRM within 5 minutes.",
        priority: "Must",
        effort: "S",
      },
      {
        epicId: epic1.id,
        code: "S3",
        title: "Track Order Status",
        userStory:
          "As an End User, I want to track my order status in real-time, so that I know when to expect delivery.",
        persona: "End User",
        acceptanceCriteria: JSON.stringify([
          "Given I have an active order, When I view order details, Then I see current status",
          "Given the order status changes, When I am on the page, Then the status updates automatically",
          "Given tracking is available, When I click track, Then I see carrier tracking page",
        ]),
        technicalNotes: "Aggregate status from multiple shipping partners via unified API.",
        priority: "Must",
        effort: "L",
      },
      {
        epicId: epic1.id,
        code: "S4",
        title: "Enable Push Notifications",
        userStory:
          "As an End User, I want to receive push notifications, so that I am alerted to important order updates.",
        persona: "End User",
        acceptanceCriteria: JSON.stringify([
          "Given I am logged in, When I enable notifications, Then I receive a test notification",
          "Given notifications are enabled, When my order ships, Then I receive a push notification",
          "Given I want to disable, When I toggle off, Then I stop receiving notifications",
        ]),
        technicalNotes: "Support iOS, Android, and web push notifications.",
        priority: "Should",
        effort: "M",
      },
    ],
  });
  console.log("Created sample stories");

  // Create a sample run
  await prisma.run.create({
    data: {
      projectId: project.id,
      type: "GENERATE_STORIES",
      status: "SUCCEEDED",
      inputConfig: JSON.stringify({
        epicId: epic1.id,
        mode: "standard",
        personaSet: "core",
      }),
      outputData: JSON.stringify({ storyCount: 4 }),
      logs: `[2024-01-15T10:00:00.000Z] Starting story generation for E1...
[2024-01-15T10:00:00.100Z] Mode: standard, Personas: core
[2024-01-15T10:00:00.200Z] Using Mock Provider
[2024-01-15T10:00:01.500Z] Generated 4 stories
[2024-01-15T10:00:01.600Z] Completed successfully`,
      tokensUsed: 0,
      durationMs: 1600,
      startedAt: new Date("2024-01-15T10:00:00.000Z"),
      completedAt: new Date("2024-01-15T10:00:01.600Z"),
    },
  });
  console.log("Created sample run");

  console.log("\nSeeding complete!");
  console.log("Sample project created with:");
  console.log("- 1 upload");
  console.log("- 3 cards");
  console.log("- 2 epics");
  console.log("- 4 stories");
  console.log("- 1 run");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
