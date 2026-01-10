/**
 * Mock Scenarios for Generate ALL Stories Testing
 *
 * These scenarios simulate various API and database behaviors
 * for comprehensive testing of the batch story generation feature.
 */

import type { StoryData, GenerationResult } from "@/lib/types";

// ============================================
// API Mock Scenarios
// ============================================

export interface MockScenario {
  name: string;
  description: string;
  behavior: string;
  delayMs: number;
  errorRate: number;
  failingIndices?: number[];
  maxSuccessfulCalls?: number;
  storyCountRange?: [number, number];
}

/**
 * Predefined API mock scenarios for testing
 */
export const API_MOCK_SCENARIOS: Record<string, MockScenario> = {
  /**
   * All API calls succeed normally
   */
  allSucceed: {
    name: "All Succeed",
    description: "All API calls succeed normally",
    behavior: "Return valid story data for each epic",
    delayMs: 1200,
    errorRate: 0,
  },

  /**
   * Random epics fail with API errors (30% failure rate)
   */
  randomFailures: {
    name: "Random Failures",
    description: "Random epics fail with API errors",
    behavior: "30% chance of failure per epic",
    delayMs: 1200,
    errorRate: 0.3,
  },

  /**
   * Specific epic at index 2 (third) always fails
   */
  epicThreeFails: {
    name: "Epic Three Fails",
    description: "Epic at index 2 (third) always fails",
    behavior: "Throw error for epicIndex === 2",
    delayMs: 1200,
    errorRate: 0,
    failingIndices: [2],
  },

  /**
   * All API calls fail (simulates API down)
   */
  apiDown: {
    name: "API Down",
    description: "All API calls fail",
    behavior: "Always throw error",
    delayMs: 100, // Fast fail
    errorRate: 1.0,
  },

  /**
   * API returns 429 after first 3 successful calls
   */
  rateLimited: {
    name: "Rate Limited",
    description: "API returns 429 after 3 calls",
    behavior: "Succeed for first 3, then 429 errors",
    delayMs: 1200,
    errorRate: 0,
    maxSuccessfulCalls: 3,
  },

  /**
   * API responds slowly (near timeout threshold)
   */
  slowApi: {
    name: "Slow API",
    description: "API responds slowly (near timeout)",
    behavior: "5-second delay per call",
    delayMs: 5000,
    errorRate: 0,
  },

  /**
   * Variable story counts returned per epic
   */
  variableResponses: {
    name: "Variable Responses",
    description: "Different story counts per epic",
    behavior: "Random 3-15 stories per call",
    delayMs: 1200,
    errorRate: 0,
    storyCountRange: [3, 15],
  },

  /**
   * First call fails, subsequent succeed (transient error)
   */
  transientError: {
    name: "Transient Error",
    description: "First call fails, rest succeed",
    behavior: "Fail on index 0, succeed after",
    delayMs: 1200,
    errorRate: 0,
    failingIndices: [0],
  },

  /**
   * Last epic fails
   */
  lastEpicFails: {
    name: "Last Epic Fails",
    description: "Only the last epic fails",
    behavior: "All succeed except final epic",
    delayMs: 1200,
    errorRate: 0,
    // failingIndices set dynamically based on epic count
  },
};

// ============================================
// Database Mock Scenarios
// ============================================

export interface DbMockScenario {
  name: string;
  description: string;
  behavior: string;
  triggerCondition?: string;
}

/**
 * Predefined database mock scenarios for testing
 */
export const DB_MOCK_SCENARIOS: Record<string, DbMockScenario> = {
  /**
   * Two processes try to create run simultaneously
   */
  concurrentAccess: {
    name: "Concurrent Access",
    description: "Simulate race condition on run creation",
    behavior: "Two processes attempt to create run simultaneously",
    triggerCondition: "Parallel API calls",
  },

  /**
   * Database transaction times out during save
   */
  transactionTimeout: {
    name: "Transaction Timeout",
    description: "Database transaction times out during save",
    behavior: "Timeout after 30s on INSERT",
    triggerCondition: "Large story batch",
  },

  /**
   * Database storage limit reached
   */
  diskFull: {
    name: "Disk Full",
    description: "Database storage limit reached",
    behavior: "Throw error on INSERT after 100 stories",
    triggerCondition: "Story count > 100",
  },

  /**
   * Connection pool exhausted
   */
  connectionExhausted: {
    name: "Connection Exhausted",
    description: "Database connection pool exhausted",
    behavior: "Connection timeout after pool limit",
    triggerCondition: "Concurrent operations > pool size",
  },
};

// ============================================
// Mock Implementation Helpers
// ============================================

/**
 * Creates a mock story generator based on scenario
 */
export function createMockStoryGenerator(
  scenario: MockScenario
): (epicIndex: number, epicCode: string) => Promise<GenerationResult<StoryData[]>> {
  let callCount = 0;

  return async (epicIndex: number, epicCode: string) => {
    callCount++;

    // Apply delay
    await sleep(scenario.delayMs);

    // Check for specific failing indices
    if (scenario.failingIndices?.includes(epicIndex)) {
      return {
        success: false,
        error: `Simulated failure for epic at index ${epicIndex}`,
      };
    }

    // Check for max successful calls (rate limiting)
    if (scenario.maxSuccessfulCalls && callCount > scenario.maxSuccessfulCalls) {
      return {
        success: false,
        error: "Rate limit exceeded (429)",
      };
    }

    // Check random error rate
    if (scenario.errorRate > 0 && Math.random() < scenario.errorRate) {
      return {
        success: false,
        error: "Random API error",
      };
    }

    // Generate stories
    const storyCount = scenario.storyCountRange
      ? randomInRange(scenario.storyCountRange[0], scenario.storyCountRange[1])
      : randomInRange(8, 12); // Default standard mode

    const stories = generateMockStories(epicCode, storyCount);

    return {
      success: true,
      data: stories,
      tokensUsed: storyCount * 150, // Estimate ~150 tokens per story
    };
  };
}

/**
 * Generate mock story data
 */
export function generateMockStories(epicCode: string, count: number): StoryData[] {
  const personas = ["User", "Admin", "System", "Developer", "Tester"];
  const priorities = ["Must", "Should", "Could"];
  const efforts = ["XS", "S", "M", "L", "XL"];

  return Array.from({ length: count }, (_, i) => ({
    code: `S${i + 1}`,
    title: `Story ${i + 1}: ${epicCode} feature`,
    userStory: `As a ${personas[i % personas.length]}, I want to perform action ${i + 1}, so that I can achieve goal ${i + 1}.`,
    persona: personas[i % personas.length],
    acceptanceCriteria: [
      `Given I am on the ${epicCode} page`,
      `When I perform action ${i + 1}`,
      `Then I should see expected result`,
    ],
    technicalNotes: `Implementation note for story ${i + 1}`,
    priority: priorities[Math.floor(i / 4) % 3],
    effort: efforts[i % 5],
  }));
}

// ============================================
// Test Data Generators
// ============================================

/**
 * Create a test project with N epics
 */
export interface TestProjectSetup {
  projectId: string;
  epicIds: string[];
  epicsWithStories: string[];
}

export function generateTestProjectData(
  epicCount: number,
  epicsWithStoriesCount: number = 0
): TestProjectSetup {
  const projectId = `test-project-${Date.now()}`;
  const epicIds = Array.from({ length: epicCount }, (_, i) => `epic-${i + 1}`);
  const epicsWithStories = epicIds.slice(0, epicsWithStoriesCount);

  return {
    projectId,
    epicIds,
    epicsWithStories,
  };
}

// ============================================
// Utility Functions
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================
// Assertion Helpers for Tests
// ============================================

/**
 * Verify story count is within expected range for mode
 */
export function isStoryCountValid(
  count: number,
  mode: "compact" | "standard" | "detailed"
): boolean {
  const ranges = {
    compact: { min: 5, max: 8 },
    standard: { min: 8, max: 12 },
    detailed: { min: 12, max: 15 },
  };

  const range = ranges[mode];
  return count >= range.min && count <= range.max;
}

/**
 * Verify run completed within expected duration
 */
export function isWithinDuration(
  actualMs: number,
  epicCount: number,
  pacing: "fast" | "safe"
): boolean {
  // Base time per epic plus pacing delay
  const baseTimePerEpic = 2000; // 2 seconds for API call
  const pacingDelay = pacing === "fast" ? 500 : 2000;

  const expectedMaxMs = epicCount * (baseTimePerEpic + pacingDelay) + 10000; // 10s buffer

  return actualMs <= expectedMaxMs;
}
