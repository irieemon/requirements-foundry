---
phase: 19-ai-question-generation
plan: 01
subsystem: ai
tags: [anthropic, claude-api, zod, prisma, server-actions]

# Dependency graph
requires:
  - phase: 18
    provides: UploadContext model with context form data
provides:
  - AIQuestion and AIAnswer Zod schemas for structured questions/answers
  - QuestionGenerator interface with Anthropic and Mock implementations
  - Server actions for generate/submit/get question flows
  - UploadContext extended with aiQuestions, aiAnswers, timestamps
affects: [19-02-ui-components, 20-context-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI service with interface + factory pattern (getQuestionGenerator)"
    - "Mock provider for testing without API key"
    - "Zod validation for AI response parsing"

key-files:
  created:
    - lib/ai/question-generator.ts
    - server/actions/questions.ts
  modified:
    - prisma/schema.prisma
    - lib/uploads/context-schema.ts

key-decisions:
  - "Questions stored as JSON in UploadContext.aiQuestions field"
  - "Answers stored as parallel JSON array in UploadContext.aiAnswers"
  - "Question categories: scope, users, constraints, integration, priority, other"
  - "QuestionStatus type tracks flow: no-context → pending-questions → pending-answers → complete"

patterns-established:
  - "AI question service follows document-analyzer.ts pattern"
  - "Server actions for AI operations follow existing patterns"
  - "Zod schema validation for AI JSON responses"

issues-created: []

# Metrics
duration: 3min
completed: 2026-01-27
---

# Phase 19 Plan 01: Data Model & AI Service Summary

**AI clarifying question generator service with Zod schemas, server actions, and UploadContext extension for storing questions/answers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-27T03:26:19Z
- **Completed:** 2026-01-27T03:29:26Z
- **Tasks:** 3/3
- **Files modified:** 4

## Accomplishments

- Extended UploadContext Prisma model with aiQuestions, aiAnswers, and timestamp fields
- Created Zod schemas for AIQuestion (id, question, category, importance, context) and AIAnswer (questionId, answer)
- Implemented QuestionGenerator interface with AnthropicQuestionGenerator and MockQuestionGenerator classes
- Created server actions: generateQuestionsForUpload, submitQuestionAnswers, getQuestionsForUpload
- Question flow status tracking: no-context → pending-questions → pending-answers → complete

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend UploadContext model** - `d4ba7e9` (feat)
2. **Task 2: Create AI question generator service** - `c1dd43b` (feat)
3. **Task 3: Create server actions** - `37318e0` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `prisma/schema.prisma` - Added aiQuestions, aiAnswers, questionsGeneratedAt, answersSubmittedAt to UploadContext
- `lib/uploads/context-schema.ts` - Added AIQuestion, AIAnswer, AIAnswersFormData schemas and types
- `lib/ai/question-generator.ts` - QuestionGenerator interface with Anthropic and Mock implementations
- `server/actions/questions.ts` - Server actions for question generation workflow

## Decisions Made

- Questions stored as JSON string in database (flexible structure, easy to evolve)
- Answers stored as parallel array with questionId references
- Six question categories align with requirements analysis concerns
- Mock generator returns context-aware deterministic questions for testing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Data model and AI service complete, ready for Plan 02 (UI Components)
- Server actions can be called from React components
- Question flow status enables progressive UI state
- MockQuestionGenerator enables development without API key

---
*Phase: 19-ai-question-generation*
*Completed: 2026-01-27*
