import type { Project, Upload, Card, Epic, Story } from "@prisma/client";

export interface ProjectExport {
  exportedAt: string;
  version: "1.0";
  project: {
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
  };
  uploads: {
    id: string;
    filename: string | null;
    fileType: string;
    extractionStatus: string;
    analysisStatus: string;
    createdAt: string;
    cardCount: number;
  }[];
  cards: {
    id: string;
    title: string;
    problem: string | null;
    targetUsers: string | null;
    currentState: string | null;
    desiredOutcomes: string | null;
    constraints: string | null;
    systems: string | null;
    priority: string | null;
    impact: string | null;
  }[];
  epics: {
    id: string;
    code: string;
    title: string;
    theme: string | null;
    description: string | null;
    businessValue: string | null;
    acceptanceCriteria: string[] | null;
    dependencies: string[] | null;
    effort: string | null;
    impact: string | null;
    priority: number | null;
    stories: {
      id: string;
      code: string;
      title: string;
      userStory: string;
      persona: string | null;
      acceptanceCriteria: string[] | null;
      technicalNotes: string | null;
      priority: string | null;
      effort: string | null;
    }[];
  }[];
  metadata: {
    totalUploads: number;
    totalCards: number;
    totalEpics: number;
    totalStories: number;
  };
}

export function exportProjectToJSON(
  project: Project,
  uploads: (Upload & { cards: Card[] })[],
  cards: Card[],
  epics: (Epic & { stories: Story[] })[]
): ProjectExport {
  const totalStories = epics.reduce((sum, e) => sum + e.stories.length, 0);

  return {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt.toISOString(),
    },
    uploads: uploads.map((u) => ({
      id: u.id,
      filename: u.filename,
      fileType: u.fileType,
      extractionStatus: u.extractionStatus,
      analysisStatus: u.analysisStatus,
      createdAt: u.createdAt.toISOString(),
      cardCount: u.cards.length,
    })),
    cards: cards.map((c) => ({
      id: c.id,
      title: c.title,
      problem: c.problem,
      targetUsers: c.targetUsers,
      currentState: c.currentState,
      desiredOutcomes: c.desiredOutcomes,
      constraints: c.constraints,
      systems: c.systems,
      priority: c.priority,
      impact: c.impact,
    })),
    epics: epics.map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      theme: e.theme,
      description: e.description,
      businessValue: e.businessValue,
      acceptanceCriteria: safeParseJSON(e.acceptanceCriteria),
      dependencies: safeParseJSON(e.dependencies),
      effort: e.effort,
      impact: e.impact,
      priority: e.priority,
      stories: e.stories.map((s) => ({
        id: s.id,
        code: s.code,
        title: s.title,
        userStory: s.userStory,
        persona: s.persona,
        acceptanceCriteria: safeParseJSON(s.acceptanceCriteria),
        technicalNotes: s.technicalNotes,
        priority: s.priority,
        effort: s.effort,
      })),
    })),
    metadata: {
      totalUploads: uploads.length,
      totalCards: cards.length,
      totalEpics: epics.length,
      totalStories,
    },
  };
}

function safeParseJSON(jsonStr: string | null): string[] | null {
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
