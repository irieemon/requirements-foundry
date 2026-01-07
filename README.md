# Requirements Foundry

A local-first product for converting use case cards and strategy artifacts into JIRA-ready epics and user stories using AI.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: SQLite via Prisma 7 + LibSQL adapter
- **AI**: Anthropic Claude API (with Mock Mode fallback)

## Features

- **Project Management**: Create and manage requirements projects
- **Upload & Parse**: Upload text/markdown/CSV files or paste content directly
- **Card Extraction**: AI-powered extraction of structured use case cards
- **Epic Generation**: Generate themed epics from cards
- **Story Generation**: Create user stories with configurable modes and personas
- **Export**: JIRA-compatible CSV and JSON export

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or your preferred package manager)
- Anthropic API key (optional - runs in mock mode without it)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd requirements-foundry

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and optionally ANTHROPIC_API_KEY

# Push database schema
npm run db:push

# Seed the database with sample data
npm run db:seed

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env` file with:

```env
# Database - use absolute path for SQLite
DATABASE_URL="file:/path/to/your/project/prisma/dev.db"

# Anthropic API (optional - app runs in mock mode without this)
ANTHROPIC_API_KEY="sk-ant-..."

# App Config
NEXT_PUBLIC_APP_NAME="Requirements Foundry"
```

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push schema to database
npm run db:seed      # Seed database with sample data
npm run db:studio    # Open Prisma Studio
npm run db:migrate   # Run migrations (dev)
npm run db:reset     # Reset database and reseed
```

## Generation Modes

### Story Generation Modes

- **Compact** (5-8 stories): Core journeys, happy paths only
- **Standard** (8-12 stories): Full coverage with primary edge cases
- **Detailed** (12-15 stories): Exhaustive with edge cases and alternative flows

### Persona Sets

- **Lightweight** (3): End User, Administrator, System
- **Core** (5): + Product Owner, Developer
- **Full** (9): + QA Engineer, Security Analyst, Support Agent, Operations

## Project Structure

```
requirements-foundry/
├── app/                    # Next.js App Router pages
│   ├── projects/           # Project management pages
│   ├── runs/               # Generation run history
│   └── layout.tsx          # Root layout
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components
│   ├── projects/           # Project-related components
│   ├── uploads/            # Upload components
│   ├── epics/              # Epic components
│   ├── stories/            # Story components
│   ├── runs/               # Run tracking components
│   └── export/             # Export components
├── lib/                    # Shared utilities
│   ├── ai/                 # AI provider abstraction
│   ├── parsers/            # Text and CSV parsers
│   ├── export/             # Export utilities
│   ├── db.ts               # Prisma client
│   └── types.ts            # TypeScript types
├── server/                 # Server-side code
│   └── actions/            # Server Actions
├── prisma/                 # Prisma schema and migrations
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Seed script
└── prisma.config.ts        # Prisma 7 configuration
```

## Mock Mode

When `ANTHROPIC_API_KEY` is not set, the application runs in Mock Mode, which:
- Returns deterministic, example outputs for all AI operations
- Allows full testing of the UI and workflow without API costs
- Generates realistic-looking cards, epics, and stories

## Database

The application uses SQLite by default, which stores data locally. The schema is designed to be easily migrated to PostgreSQL for production deployments.

### Prisma 7 Configuration

This project uses Prisma 7 with the LibSQL driver adapter. Key differences from earlier Prisma versions:
- Database URL is configured in `prisma.config.ts` and via environment variables
- PrismaClient requires a driver adapter: `new PrismaClient({ adapter })`
- The adapter is initialized with: `new PrismaLibSql({ url: databaseUrl })`

## Export Formats

### JIRA CSV

Exports in JIRA-compatible CSV format with columns:
- Summary, Description, Issue Type, Priority, Epic Link, Acceptance Criteria

### JSON

Full hierarchical export including all epics, stories, and metadata.

## License

MIT
