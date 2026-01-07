# Requirements Foundry

A local-first product for converting use case cards and strategy artifacts into JIRA-ready epics and user stories using AI.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (Vercel Postgres) or SQLite (local dev)
- **Storage**: Vercel Blob (production) or local buffer (dev)
- **AI**: Anthropic Claude API (with Mock Mode fallback)

## Features

- **Project Management**: Create and manage requirements projects
- **Upload & Parse**: Upload text/markdown/CSV/PDF/DOCX files or paste content directly
- **Card Extraction**: AI-powered extraction of structured use case cards
- **Epic Generation**: Generate themed epics from cards
- **Story Generation**: Create user stories with configurable modes and personas
- **Export**: JIRA-compatible CSV and JSON export

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or your preferred package manager)
- Anthropic API key (optional - runs in mock mode without it)

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd requirements-foundry

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env - for local dev, use:
#   DATABASE_URL="file:./dev.db"
#   UPLOAD_STORAGE="local"

# Push database schema (creates SQLite DB)
npm run db:push

# Seed the database with sample data
npm run db:seed

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env` file:

```env
# Database
# LOCAL: DATABASE_URL="file:./dev.db"
# VERCEL: DATABASE_URL="postgres://..."
DATABASE_URL="file:./dev.db"

# Upload Storage (local | blob)
UPLOAD_STORAGE="local"

# Vercel Blob (required when UPLOAD_STORAGE=blob)
BLOB_READ_WRITE_TOKEN=""

# Anthropic API (optional - mock mode without this)
ANTHROPIC_API_KEY=""

# App Config
NEXT_PUBLIC_APP_NAME="Requirements Foundry"
```

---

## Vercel Deployment

### Quick Deploy

1. **Fork/Clone** this repository
2. **Import to Vercel**: Go to [vercel.com/new](https://vercel.com/new)
3. **Add Storage**:
   - Go to your project -> Storage
   - Add **Postgres** database
   - Add **Blob** storage
4. **Set Environment Variables** in Vercel project settings:
   - `ANTHROPIC_API_KEY` - Your Anthropic API key
   - `UPLOAD_STORAGE` - Set to `blob`
   - Database and Blob tokens are auto-configured by Vercel

### Manual Setup

#### 1. Create Vercel Postgres

```bash
# Install Vercel CLI
npm i -g vercel

# Link your project
vercel link

# Create Postgres database
vercel postgres create requirements-foundry-db

# Link it to your project (adds env vars automatically)
vercel postgres link requirements-foundry-db
```

#### 2. Create Vercel Blob Store

```bash
# Create Blob store
vercel blob create requirements-foundry-uploads

# Link it to your project
vercel blob link requirements-foundry-uploads
```

#### 3. Set Additional Environment Variables

In Vercel Dashboard -> Settings -> Environment Variables:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `UPLOAD_STORAGE` | `blob` |

#### 4. Deploy

```bash
# Deploy to Vercel
vercel --prod
```

### Database Migrations

On first deploy or schema changes:

```bash
# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy
```

Vercel runs these automatically via the `build` script.

---

## Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npm run db:push      # Push schema (local dev)
npm run db:migrate   # Create migration (dev)
npm run db:migrate:deploy  # Deploy migrations (prod)
npm run db:seed      # Seed with sample data
npm run db:studio    # Open Prisma Studio
npm run db:reset     # Reset and reseed

# Testing
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:coverage  # Run with coverage
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
│   ├── api/                # API routes
│   ├── projects/           # Project management pages
│   ├── runs/               # Generation run history
│   └── layout.tsx          # Root layout
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components
│   ├── projects/           # Project-related components
│   └── ...
├── lib/                    # Shared utilities
│   ├── ai/                 # AI provider abstraction
│   ├── documents/          # Document processors (PDF, DOCX, etc.)
│   ├── storage/            # Storage abstraction (local/blob)
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

### Local Development (SQLite)

Uses SQLite with Prisma for zero-config local development:

```bash
DATABASE_URL="file:./dev.db"
npm run db:push  # Sync schema
```

### Production (PostgreSQL)

Uses Vercel Postgres for production deployments:

```bash
DATABASE_URL="postgres://..."
npm run db:migrate:deploy  # Run migrations
```

## Storage

### Local Mode

Files are processed from memory buffers. No persistent file storage.

```env
UPLOAD_STORAGE="local"
```

### Blob Mode (Vercel)

Files are uploaded to Vercel Blob for persistent storage:

```env
UPLOAD_STORAGE="blob"
BLOB_READ_WRITE_TOKEN="vercel_blob_..."
```

## Export Formats

### JIRA CSV

Exports in JIRA-compatible CSV format with columns:
- Summary, Description, Issue Type, Priority, Epic Link, Acceptance Criteria

### JSON

Full hierarchical export including all epics, stories, and metadata.

## License

MIT
