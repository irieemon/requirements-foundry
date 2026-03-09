---
phase: 21-application-code-migration
plan: 03
subsystem: ai
tags: [bedrock, anthropic, aws, sdk, credential-detection]

# Dependency graph
requires:
  - phase: 21-01
    provides: "@anthropic-ai/bedrock-sdk and @aws-sdk/credential-providers packages installed"
provides:
  - BedrockProvider class replacing AnthropicProvider with IAM credential chain
  - Async getAIProvider() with MOCK_MODE override and credential auto-detection
  - BedrockDocumentAnalyzer and BedrockQuestionGenerator using Bedrock SDK
  - hasAwsCredentials() replacing hasAnthropicKey()
affects: [21-04, 21-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [async-provider-factory, credential-auto-detection, mock-mode-override]

key-files:
  created: []
  modified:
    - lib/ai/provider.ts
    - lib/ai/document-analyzer.ts
    - lib/ai/question-generator.ts

key-decisions:
  - "Factory functions (getAIProvider, getDocumentAnalyzer, getQuestionGenerator) are now async -- callers updated in Plan 04"
  - "Bedrock model ID format: anthropic.claude-sonnet-4-20250514-v1:0"
  - "AWS credential detection uses fromNodeProviderChain with module-level caching"

patterns-established:
  - "Async provider factory: MOCK_MODE check -> credential check -> fallback to MockProvider"
  - "Bedrock client init: new AnthropicBedrock({ awsRegion: process.env.AWS_REGION || 'us-east-1' })"

requirements-completed: [CODE-02, AI-03]

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 21 Plan 03: AI Provider Migration Summary

**Replaced direct Anthropic SDK with Bedrock SDK across all AI files, with async credential auto-detection and MOCK_MODE override**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-05T19:20:25Z
- **Completed:** 2026-03-05T19:22:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced AnthropicProvider with BedrockProvider using AnthropicBedrock client and IAM credential chain
- Made getAIProvider() async with MOCK_MODE=true override and credential auto-detection fallback
- Updated document-analyzer and question-generator to use Bedrock SDK with correct model IDs
- Eliminated all ANTHROPIC_API_KEY references from lib/ai/ directory

## Task Commits

Each task was committed atomically:

1. **Task 1: BedrockProvider and async getAIProvider with credential auto-detection** - `fc0a092` (feat)
2. **Task 2: Update document-analyzer and question-generator to use Bedrock SDK** - `3490c8a` (feat)

**Plan metadata:** `cfd7ca6` (docs: complete plan)

## Files Created/Modified
- `lib/ai/provider.ts` - BedrockProvider class, async getAIProvider(), hasAwsCredentials() with credential caching
- `lib/ai/document-analyzer.ts` - BedrockDocumentAnalyzer, async getDocumentAnalyzer() factory
- `lib/ai/question-generator.ts` - BedrockQuestionGenerator, async getQuestionGenerator() factory

## Decisions Made
- Factory functions are now async (breaking change for callers -- handled in Plan 04)
- Credential detection uses fromNodeProviderChain with module-level boolean cache for performance
- MOCK_MODE=true is checked first before credential detection in all factory functions
- AWS_REGION defaults to us-east-1 if not set

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All AI provider files now use Bedrock SDK
- Callers (executor.ts, batch-story-executor.ts, subtask-executor.ts) still reference sync getAIProvider() -- will be updated in Plan 04
- document-analyzer and question-generator callers may also need async updates in Plan 04

## Self-Check: PASSED

All files exist. All commit hashes verified.

---
*Phase: 21-application-code-migration*
*Completed: 2026-03-05*
