// ═══════════════════════════════════════════════════════════════
// NORMALIZER TESTS
// Tests for hierarchy ordering, temp ID generation, and flattening
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  normalizeForExport,
  countSubtasks,
  validateHierarchy,
} from "../normalizer";
import type { ExtractedData, NormalizedItem } from "../types";

// ─────────────────────────────────────────────────────────────────
// Test Data Factories
// ─────────────────────────────────────────────────────────────────

function createMockSubtask(id: string, code: string) {
  return {
    id,
    code,
    title: `Subtask ${code}`,
    description: `Description for ${code}`,
    effort: "S" as const,
    sortOrder: 0,
    storyId: "story-1",
    runId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockStory(id: string, code: string, subtasks: ReturnType<typeof createMockSubtask>[] = []) {
  return {
    id,
    code,
    title: `Story ${code}`,
    userStory: `As a user, I want ${code}`,
    persona: "User",
    acceptanceCriteria: `AC for ${code}`,
    technicalNotes: null,
    priority: "Medium" as const,
    effort: "M" as const,
    sortOrder: 0,
    epicId: "epic-1",
    runId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    mssServiceAreaId: null,
    subtasks,
  };
}

function createMockEpic(
  id: string,
  code: string,
  stories: ReturnType<typeof createMockStory>[] = []
) {
  return {
    id,
    code,
    title: `Epic ${code}`,
    description: `Description for ${code}`,
    businessValue: `Business value for ${code}`,
    acceptanceCriteria: `AC for ${code}`,
    dependencies: null,
    impact: "High" as const,
    effort: "L" as const,
    theme: "Feature",
    sortOrder: 0,
    projectId: "project-1",
    runId: null,
    priority: null,
    cardIds: null,
    mssServiceAreaId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    stories,
  };
}

function createExtractedData(
  epics: ReturnType<typeof createMockEpic>[]
): ExtractedData {
  return {
    project: {
      id: "project-1",
      name: "Test Project",
    },
    epics,
  };
}

// ─────────────────────────────────────────────────────────────────
// normalizeForExport Tests
// ─────────────────────────────────────────────────────────────────

describe("normalizeForExport", () => {
  describe("basic normalization", () => {
    it("returns empty array for empty data", () => {
      const data = createExtractedData([]);
      const result = normalizeForExport(data, true);
      expect(result).toEqual([]);
    });

    it("normalizes a single epic", () => {
      const data = createExtractedData([createMockEpic("e1", "EPIC-001")]);
      const result = normalizeForExport(data, true);

      expect(result.length).toBe(1);
      expect(result[0].issueType).toBe("Epic");
      expect(result[0].tempId).toBe("TEMP-E-001");
      expect(result[0].parentTempId).toBeNull();
    });

    it("normalizes epic with stories", () => {
      const stories = [
        createMockStory("s1", "STORY-001"),
        createMockStory("s2", "STORY-002"),
      ];
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", stories),
      ]);
      const result = normalizeForExport(data, true);

      expect(result.length).toBe(3);
      expect(result[0].issueType).toBe("Epic");
      expect(result[1].issueType).toBe("Story");
      expect(result[2].issueType).toBe("Story");
    });

    it("normalizes stories with subtasks", () => {
      const subtasks = [
        createMockSubtask("st1", "SUBTASK-001"),
        createMockSubtask("st2", "SUBTASK-002"),
      ];
      const stories = [createMockStory("s1", "STORY-001", subtasks)];
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", stories),
      ]);
      const result = normalizeForExport(data, true);

      expect(result.length).toBe(4); // 1 epic + 1 story + 2 subtasks
      expect(result[2].issueType).toBe("Sub-task");
      expect(result[3].issueType).toBe("Sub-task");
    });
  });

  describe("temp ID generation", () => {
    it("generates sequential epic IDs", () => {
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001"),
        createMockEpic("e2", "EPIC-002"),
        createMockEpic("e3", "EPIC-003"),
      ]);
      const result = normalizeForExport(data, true);

      expect(result[0].tempId).toBe("TEMP-E-001");
      expect(result[1].tempId).toBe("TEMP-E-002");
      expect(result[2].tempId).toBe("TEMP-E-003");
    });

    it("generates sequential story IDs across epics", () => {
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", [
          createMockStory("s1", "STORY-001"),
          createMockStory("s2", "STORY-002"),
        ]),
        createMockEpic("e2", "EPIC-002", [createMockStory("s3", "STORY-003")]),
      ]);
      const result = normalizeForExport(data, true);

      const stories = result.filter((r) => r.issueType === "Story");
      expect(stories[0].tempId).toBe("TEMP-S-001");
      expect(stories[1].tempId).toBe("TEMP-S-002");
      expect(stories[2].tempId).toBe("TEMP-S-003");
    });

    it("generates sequential subtask IDs across stories", () => {
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", [
          createMockStory("s1", "STORY-001", [
            createMockSubtask("st1", "SUBTASK-001"),
          ]),
          createMockStory("s2", "STORY-002", [
            createMockSubtask("st2", "SUBTASK-002"),
            createMockSubtask("st3", "SUBTASK-003"),
          ]),
        ]),
      ]);
      const result = normalizeForExport(data, true);

      const subtasks = result.filter((r) => r.issueType === "Sub-task");
      expect(subtasks[0].tempId).toBe("TEMP-ST-001");
      expect(subtasks[1].tempId).toBe("TEMP-ST-002");
      expect(subtasks[2].tempId).toBe("TEMP-ST-003");
    });

    it("pads IDs to 3 digits", () => {
      const epics = Array.from({ length: 12 }, (_, i) =>
        createMockEpic(`e${i}`, `EPIC-${i}`)
      );
      const data = createExtractedData(epics);
      const result = normalizeForExport(data, true);

      expect(result[0].tempId).toBe("TEMP-E-001");
      expect(result[9].tempId).toBe("TEMP-E-010");
      expect(result[11].tempId).toBe("TEMP-E-012");
    });
  });

  describe("hierarchy ordering (parent before child)", () => {
    it("places epic before its stories", () => {
      const stories = [
        createMockStory("s1", "STORY-001"),
        createMockStory("s2", "STORY-002"),
      ];
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", stories),
      ]);
      const result = normalizeForExport(data, true);

      const epicIndex = result.findIndex((r) => r.tempId === "TEMP-E-001");
      const story1Index = result.findIndex((r) => r.tempId === "TEMP-S-001");
      const story2Index = result.findIndex((r) => r.tempId === "TEMP-S-002");

      expect(epicIndex).toBeLessThan(story1Index);
      expect(epicIndex).toBeLessThan(story2Index);
    });

    it("places story before its subtasks", () => {
      const subtasks = [
        createMockSubtask("st1", "SUBTASK-001"),
        createMockSubtask("st2", "SUBTASK-002"),
      ];
      const stories = [createMockStory("s1", "STORY-001", subtasks)];
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", stories),
      ]);
      const result = normalizeForExport(data, true);

      const storyIndex = result.findIndex((r) => r.tempId === "TEMP-S-001");
      const subtask1Index = result.findIndex((r) => r.tempId === "TEMP-ST-001");
      const subtask2Index = result.findIndex((r) => r.tempId === "TEMP-ST-002");

      expect(storyIndex).toBeLessThan(subtask1Index);
      expect(storyIndex).toBeLessThan(subtask2Index);
    });

    it("maintains depth-first order across multiple epics", () => {
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", [
          createMockStory("s1", "STORY-001", [
            createMockSubtask("st1", "SUBTASK-001"),
          ]),
        ]),
        createMockEpic("e2", "EPIC-002", [
          createMockStory("s2", "STORY-002", [
            createMockSubtask("st2", "SUBTASK-002"),
          ]),
        ]),
      ]);
      const result = normalizeForExport(data, true);

      // Expected order: E1, S1, ST1, E2, S2, ST2 (depth-first)
      expect(result.map((r) => r.tempId)).toEqual([
        "TEMP-E-001",
        "TEMP-S-001",
        "TEMP-ST-001",
        "TEMP-E-002",
        "TEMP-S-002",
        "TEMP-ST-002",
      ]);
    });
  });

  describe("parent references", () => {
    it("sets correct parent ID for stories", () => {
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", [createMockStory("s1", "STORY-001")]),
        createMockEpic("e2", "EPIC-002", [createMockStory("s2", "STORY-002")]),
      ]);
      const result = normalizeForExport(data, true);

      const story1 = result.find((r) => r.code === "STORY-001");
      const story2 = result.find((r) => r.code === "STORY-002");

      expect(story1?.parentTempId).toBe("TEMP-E-001");
      expect(story2?.parentTempId).toBe("TEMP-E-002");
    });

    it("sets correct parent ID for subtasks", () => {
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", [
          createMockStory("s1", "STORY-001", [
            createMockSubtask("st1", "SUBTASK-001"),
          ]),
          createMockStory("s2", "STORY-002", [
            createMockSubtask("st2", "SUBTASK-002"),
          ]),
        ]),
      ]);
      const result = normalizeForExport(data, true);

      const subtask1 = result.find((r) => r.code === "SUBTASK-001");
      const subtask2 = result.find((r) => r.code === "SUBTASK-002");

      expect(subtask1?.parentTempId).toBe("TEMP-S-001");
      expect(subtask2?.parentTempId).toBe("TEMP-S-002");
    });

    it("preserves epic code in story items", () => {
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", [createMockStory("s1", "STORY-001")]),
      ]);
      const result = normalizeForExport(data, true);

      const story = result.find((r) => r.issueType === "Story");
      expect(story?.epicCode).toBe("EPIC-001");
    });

    it("preserves epic and story codes in subtask items", () => {
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", [
          createMockStory("s1", "STORY-001", [
            createMockSubtask("st1", "SUBTASK-001"),
          ]),
        ]),
      ]);
      const result = normalizeForExport(data, true);

      const subtask = result.find((r) => r.issueType === "Sub-task");
      expect(subtask?.epicCode).toBe("EPIC-001");
      expect(subtask?.storyCode).toBe("STORY-001");
    });
  });

  describe("subtask inclusion toggle", () => {
    it("excludes subtasks when includeSubtasks is false", () => {
      const subtasks = [
        createMockSubtask("st1", "SUBTASK-001"),
        createMockSubtask("st2", "SUBTASK-002"),
      ];
      const stories = [createMockStory("s1", "STORY-001", subtasks)];
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", stories),
      ]);

      const result = normalizeForExport(data, false);

      expect(result.length).toBe(2); // 1 epic + 1 story, no subtasks
      expect(result.every((r) => r.issueType !== "Sub-task")).toBe(true);
    });

    it("includes subtasks when includeSubtasks is true", () => {
      const subtasks = [
        createMockSubtask("st1", "SUBTASK-001"),
        createMockSubtask("st2", "SUBTASK-002"),
      ];
      const stories = [createMockStory("s1", "STORY-001", subtasks)];
      const data = createExtractedData([
        createMockEpic("e1", "EPIC-001", stories),
      ]);

      const result = normalizeForExport(data, true);

      expect(result.length).toBe(4); // 1 epic + 1 story + 2 subtasks
      expect(result.filter((r) => r.issueType === "Sub-task").length).toBe(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// countSubtasks Tests
// ─────────────────────────────────────────────────────────────────

describe("countSubtasks", () => {
  it("returns 0 for empty data", () => {
    const data = createExtractedData([]);
    expect(countSubtasks(data)).toBe(0);
  });

  it("returns 0 when no stories have subtasks", () => {
    const data = createExtractedData([
      createMockEpic("e1", "EPIC-001", [createMockStory("s1", "STORY-001", [])]),
    ]);
    expect(countSubtasks(data)).toBe(0);
  });

  it("counts subtasks across multiple stories", () => {
    const data = createExtractedData([
      createMockEpic("e1", "EPIC-001", [
        createMockStory("s1", "STORY-001", [
          createMockSubtask("st1", "SUBTASK-001"),
          createMockSubtask("st2", "SUBTASK-002"),
        ]),
        createMockStory("s2", "STORY-002", [
          createMockSubtask("st3", "SUBTASK-003"),
        ]),
      ]),
    ]);
    expect(countSubtasks(data)).toBe(3);
  });

  it("counts subtasks across multiple epics", () => {
    const data = createExtractedData([
      createMockEpic("e1", "EPIC-001", [
        createMockStory("s1", "STORY-001", [
          createMockSubtask("st1", "SUBTASK-001"),
        ]),
      ]),
      createMockEpic("e2", "EPIC-002", [
        createMockStory("s2", "STORY-002", [
          createMockSubtask("st2", "SUBTASK-002"),
          createMockSubtask("st3", "SUBTASK-003"),
        ]),
      ]),
    ]);
    expect(countSubtasks(data)).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────
// validateHierarchy Tests
// ─────────────────────────────────────────────────────────────────

describe("validateHierarchy", () => {
  it("returns true for empty array", () => {
    expect(validateHierarchy([])).toBe(true);
  });

  it("returns true when all parent references are valid", () => {
    const items: NormalizedItem[] = [
      {
        tempId: "TEMP-E-001",
        parentTempId: null,
        issueType: "Epic",
        sourceId: "e1",
        code: "EPIC-001",
        title: "Epic 1",
      },
      {
        tempId: "TEMP-S-001",
        parentTempId: "TEMP-E-001",
        issueType: "Story",
        sourceId: "s1",
        code: "STORY-001",
        title: "Story 1",
      },
      {
        tempId: "TEMP-ST-001",
        parentTempId: "TEMP-S-001",
        issueType: "Sub-task",
        sourceId: "st1",
        code: "SUBTASK-001",
        title: "Subtask 1",
      },
    ];
    expect(validateHierarchy(items)).toBe(true);
  });

  it("returns false when parent reference is invalid", () => {
    const items: NormalizedItem[] = [
      {
        tempId: "TEMP-E-001",
        parentTempId: null,
        issueType: "Epic",
        sourceId: "e1",
        code: "EPIC-001",
        title: "Epic 1",
      },
      {
        tempId: "TEMP-S-001",
        parentTempId: "TEMP-E-999", // Invalid parent
        issueType: "Story",
        sourceId: "s1",
        code: "STORY-001",
        title: "Story 1",
      },
    ];
    expect(validateHierarchy(items)).toBe(false);
  });

  it("handles items with null parent (top-level)", () => {
    const items: NormalizedItem[] = [
      {
        tempId: "TEMP-E-001",
        parentTempId: null,
        issueType: "Epic",
        sourceId: "e1",
        code: "EPIC-001",
        title: "Epic 1",
      },
      {
        tempId: "TEMP-E-002",
        parentTempId: null,
        issueType: "Epic",
        sourceId: "e2",
        code: "EPIC-002",
        title: "Epic 2",
      },
    ];
    expect(validateHierarchy(items)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// Integration Tests
// ─────────────────────────────────────────────────────────────────

describe("Normalizer Integration", () => {
  it("produces valid hierarchy from complex data", () => {
    const data = createExtractedData([
      createMockEpic("e1", "EPIC-001", [
        createMockStory("s1", "STORY-001", [
          createMockSubtask("st1", "SUBTASK-001"),
          createMockSubtask("st2", "SUBTASK-002"),
        ]),
        createMockStory("s2", "STORY-002"),
      ]),
      createMockEpic("e2", "EPIC-002", [
        createMockStory("s3", "STORY-003", [
          createMockSubtask("st3", "SUBTASK-003"),
        ]),
      ]),
    ]);

    const result = normalizeForExport(data, true);
    expect(validateHierarchy(result)).toBe(true);
  });

  it("maintains referential integrity after normalization", () => {
    const data = createExtractedData([
      createMockEpic("e1", "EPIC-001", [
        createMockStory("s1", "STORY-001", [
          createMockSubtask("st1", "SUBTASK-001"),
        ]),
      ]),
    ]);

    const result = normalizeForExport(data, true);

    // Build a map of IDs
    const idMap = new Map(result.map((r) => [r.tempId, r]));

    // Verify all parent references resolve
    for (const item of result) {
      if (item.parentTempId) {
        expect(idMap.has(item.parentTempId)).toBe(true);
      }
    }

    // Verify parent appears before child
    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      if (item.parentTempId) {
        const parentIndex = result.findIndex(
          (r) => r.tempId === item.parentTempId
        );
        expect(parentIndex).toBeLessThan(i);
      }
    }
  });
});
