import Anthropic from "@anthropic-ai/sdk";
import {
  CardData,
  EpicData,
  StoryData,
  SubtaskData,
  GenerationMode,
  PersonaSet,
  GenerationResult,
  GENERATION_MODE_CONFIG,
  PERSONA_SETS,
} from "@/lib/types";

// ============================================
// Provider Interface
// ============================================

export interface AIProvider {
  generateEpics(cards: CardData[], projectContext?: string, mssContext?: string): Promise<GenerationResult<EpicData[]>>;
  generateStories(
    epic: EpicData,
    mode: GenerationMode,
    personaSet: PersonaSet
  ): Promise<GenerationResult<StoryData[]>>;
  generateSubtasks(
    story: StoryData,
    epicContext: { code: string; title: string },
    mode: GenerationMode
  ): Promise<GenerationResult<SubtaskData[]>>;
  isAvailable(): boolean;
}

// ============================================
// Check if API key is available
// ============================================

export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ============================================
// Get the appropriate provider
// ============================================

export function getAIProvider(): AIProvider {
  if (hasAnthropicKey()) {
    return new AnthropicProvider();
  }
  return new MockProvider();
}

// ============================================
// Anthropic Provider
// ============================================

class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  isAvailable(): boolean {
    return true;
  }

  async generateEpics(cards: CardData[], projectContext?: string, mssContext?: string): Promise<GenerationResult<EpicData[]>> {
    try {
      const cardsText = cards
        .map(
          (c, i) => `
Card ${i + 1}: ${c.title}
${c.problem ? `Problem/Opportunity: ${c.problem}` : ""}
${c.targetUsers ? `Target Users: ${c.targetUsers}` : ""}
${c.desiredOutcomes ? `Desired Outcomes: ${c.desiredOutcomes}` : ""}
${c.constraints ? `Constraints: ${c.constraints}` : ""}
${c.systems ? `Systems: ${c.systems}` : ""}
${c.priority ? `Priority: ${c.priority}` : ""}
`.trim()
        )
        .join("\n\n---\n\n");

      // Build MSS section if context provided
      // Extract first L3 code as example for the prompt
      const exampleCode = mssContext
        ? mssContext.match(/^\s{2}([^\s-][^-]*?)\s*-/m)?.[1]?.trim() || "Service Area Name"
        : "";

      const mssSection = mssContext
        ? `
SERVICE LINE TAXONOMY (L2 Service Line → L3 Service Area):
${mssContext}

For each epic, assign the most appropriate L3 service area code EXACTLY as shown above (e.g., "${exampleCode}") based on the epic's content.
The mssServiceAreaCode must match one of the L3 codes listed above exactly (case-insensitive).
If no service area clearly applies, leave mssServiceAreaCode empty.
`
        : "";

      // Include mssServiceAreaCode in JSON format only if MSS context is provided
      const mssJsonField = mssContext ? `\n    "mssServiceAreaCode": "${exampleCode}",` : "";

      const prompt = `You are a product requirements analyst. Analyze the following use case cards and generate a set of Epics that cover the key themes and initiatives.

${projectContext ? `Project Context: ${projectContext}\n\n` : ""}${mssSection}

USE CASE CARDS:
${cardsText}

Generate Epics in the following JSON format. Each epic should:
- Have a unique code (E1, E2, E3, etc.)
- Synthesize related cards into cohesive themes
- Include clear business value statements
- Identify dependencies between epics
- Estimate effort (S/M/L)
- Assess impact (high/medium/low)
- Suggest priority (1 = highest)${mssContext ? "\n- Assign the most appropriate L3 service area code from the taxonomy" : ""}

Return ONLY valid JSON array:
[
  {
    "code": "E1",
    "title": "Epic Title",
    "theme": "Theme Category",
    "description": "Detailed description",
    "businessValue": "Why this matters",
    "acceptanceCriteria": ["AC1", "AC2"],
    "dependencies": [],
    "effort": "M",
    "impact": "high",
    "priority": 1,
    "cardIds": []${mssJsonField}
  }
]`;

      const message = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        return { success: false, error: "Unexpected response type" };
      }

      // Extract JSON from response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return { success: false, error: "Could not parse JSON from response" };
      }

      const epics = JSON.parse(jsonMatch[0]) as EpicData[];
      const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

      return { success: true, data: epics, tokensUsed };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async generateStories(
    epic: EpicData,
    mode: GenerationMode,
    personaSet: PersonaSet
  ): Promise<GenerationResult<StoryData[]>> {
    try {
      const modeConfig = GENERATION_MODE_CONFIG[mode];
      const personas = PERSONA_SETS[personaSet];

      const prompt = `You are a product requirements analyst. Generate User Stories for the following Epic.

EPIC:
Code: ${epic.code}
Title: ${epic.title}
Description: ${epic.description || "N/A"}
Business Value: ${epic.businessValue || "N/A"}
Theme: ${epic.theme || "N/A"}
Acceptance Criteria: ${epic.acceptanceCriteria?.join("; ") || "N/A"}

GENERATION MODE: ${mode.toUpperCase()}
- Generate ${modeConfig.storyCount.min}-${modeConfig.storyCount.max} stories
- Focus: ${modeConfig.focus}
- Include edge cases: ${modeConfig.includeEdgeCases}
- Include alternative flows: ${modeConfig.includeAltFlows}

PERSONAS TO CONSIDER:
${personas.join(", ")}

Generate stories in the following JSON format. Each story should:
- Have a unique code within this epic (S1, S2, S3, etc.)
- Follow the "As a [persona], I want [goal], so that [benefit]" format
- Include specific acceptance criteria
- Estimate effort (XS/S/M/L/XL or story points 1-13)
- Assign priority (Must/Should/Could/Won't for MoSCoW)

Return ONLY valid JSON array:
[
  {
    "code": "S1",
    "title": "Story Title",
    "userStory": "As a [persona], I want [goal], so that [benefit]",
    "persona": "End User",
    "acceptanceCriteria": ["Given..., When..., Then...", "..."],
    "technicalNotes": "Implementation considerations",
    "priority": "Must",
    "effort": "M"
  }
]`;

      const message = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        return { success: false, error: "Unexpected response type" };
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return { success: false, error: "Could not parse JSON from response" };
      }

      const stories = JSON.parse(jsonMatch[0]) as StoryData[];
      const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

      return { success: true, data: stories, tokensUsed };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async generateSubtasks(
    story: StoryData,
    epicContext: { code: string; title: string },
    mode: GenerationMode
  ): Promise<GenerationResult<SubtaskData[]>> {
    try {
      const modeConfig = GENERATION_MODE_CONFIG[mode];
      // Subtask counts: compact 3-5, standard 5-8, detailed 8-12
      const subtaskCounts = {
        compact: { min: 3, max: 5 },
        standard: { min: 5, max: 8 },
        detailed: { min: 8, max: 12 },
      };
      const countConfig = subtaskCounts[mode];

      const prompt = `You are a technical product analyst. Generate implementation subtasks for the following User Story.

CONTEXT:
Epic: ${epicContext.code} - ${epicContext.title}
Story: ${story.code} - ${story.title}
User Story: ${story.userStory}
${story.persona ? `Persona: ${story.persona}` : ""}
${story.acceptanceCriteria ? `Acceptance Criteria:\n${story.acceptanceCriteria.map((ac, i) => `  ${i + 1}. ${ac}`).join("\n")}` : ""}
${story.technicalNotes ? `Technical Notes: ${story.technicalNotes}` : ""}

GENERATION MODE: ${mode.toUpperCase()}
- Generate ${countConfig.min}-${countConfig.max} subtasks
- Focus: ${modeConfig.focus}

Generate subtasks that represent concrete implementation work. Each subtask should:
- Be a specific, actionable piece of work
- Have a clear definition of done
- Estimate effort (XS=<2h, S=2-4h, M=4-8h, L=1-2d, XL=>2d)
- Include technical implementation details where relevant

Return ONLY valid JSON array:
[
  {
    "code": "ST1",
    "title": "Subtask title",
    "description": "What needs to be done and how",
    "effort": "S"
  }
]`;

      const message = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        return { success: false, error: "Unexpected response type" };
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return { success: false, error: "Could not parse JSON from response" };
      }

      const subtasks = JSON.parse(jsonMatch[0]) as SubtaskData[];
      const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

      return { success: true, data: subtasks, tokensUsed };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================
// Mock Provider (deterministic fake data)
// ============================================

class MockProvider implements AIProvider {
  isAvailable(): boolean {
    return true;
  }

  async generateEpics(cards: CardData[], _projectContext?: string, _mssContext?: string): Promise<GenerationResult<EpicData[]>> {
    // Simulate processing delay
    await sleep(1500);

    // Generate deterministic epics based on card count
    const themes = [
      "User Experience",
      "Data Management",
      "Integration",
      "Security & Compliance",
      "Performance",
      "Automation",
    ];

    // Extract actual MSS codes from context (if provided)
    // Context format: "  CodeName - Description" per line
    const mockMssCodes: string[] = [];
    if (_mssContext) {
      const codeMatches = _mssContext.matchAll(/^\s{2}([^\s-][^-]*?)\s*-/gm);
      for (const match of codeMatches) {
        if (match[1]) mockMssCodes.push(match[1].trim());
      }
    }
    // Fallback if no codes extracted
    if (mockMssCodes.length === 0) {
      mockMssCodes.push("Technology Strategy", "Commerce Technology", "Experience & Service Design");
    }

    const epics: EpicData[] = [];
    const epicCount = Math.min(Math.max(2, Math.ceil(cards.length / 2)), 6);

    for (let i = 0; i < epicCount; i++) {
      const theme = themes[i % themes.length];
      const relatedCards = cards.filter((_, idx) => idx % epicCount === i);

      epics.push({
        code: `E${i + 1}`,
        title: `${theme} Enhancement Initiative`,
        theme,
        description: `Comprehensive improvements to ${theme.toLowerCase()} capabilities based on ${relatedCards.length} identified use cases.`,
        businessValue: `Improves user satisfaction and operational efficiency in ${theme.toLowerCase()} domain.`,
        acceptanceCriteria: [
          "All related use cases are addressed",
          "User acceptance testing passes",
          "Performance benchmarks are met",
        ],
        dependencies: i > 0 ? [`E${i}`] : [],
        effort: ["S", "M", "L"][i % 3],
        impact: ["high", "medium", "high"][i % 3],
        priority: i + 1,
        cardIds: relatedCards.map((_, idx) => `card_${idx}`),
        mssServiceAreaCode: _mssContext ? mockMssCodes[i % mockMssCodes.length] : undefined,
      });
    }

    return { success: true, data: epics, tokensUsed: 0 };
  }

  async generateStories(
    epic: EpicData,
    mode: GenerationMode,
    personaSet: PersonaSet
  ): Promise<GenerationResult<StoryData[]>> {
    await sleep(1200);

    const modeConfig = GENERATION_MODE_CONFIG[mode];
    const personas = PERSONA_SETS[personaSet];
    const storyCount = modeConfig.storyCount.min + Math.floor((modeConfig.storyCount.max - modeConfig.storyCount.min) / 2);

    const storyTemplates = [
      { action: "view", object: "dashboard", benefit: "understand status at a glance" },
      { action: "create", object: "new item", benefit: "capture requirements" },
      { action: "edit", object: "existing item", benefit: "keep information current" },
      { action: "delete", object: "obsolete item", benefit: "maintain data hygiene" },
      { action: "search", object: "records", benefit: "find information quickly" },
      { action: "filter", object: "list", benefit: "focus on relevant items" },
      { action: "export", object: "data", benefit: "use in other tools" },
      { action: "import", object: "data", benefit: "migrate existing information" },
      { action: "share", object: "item", benefit: "collaborate with team" },
      { action: "configure", object: "settings", benefit: "customize experience" },
      { action: "receive", object: "notification", benefit: "stay informed" },
      { action: "review", object: "changes", benefit: "ensure quality" },
      { action: "approve", object: "request", benefit: "control workflow" },
      { action: "revert", object: "change", benefit: "recover from errors" },
      { action: "audit", object: "history", benefit: "track accountability" },
    ];

    const stories: StoryData[] = [];
    const priorities = ["Must", "Should", "Could"];
    const efforts = ["S", "M", "L"];

    for (let i = 0; i < storyCount; i++) {
      const template = storyTemplates[i % storyTemplates.length];
      const persona = personas[i % personas.length];
      const priority = priorities[Math.min(Math.floor(i / 4), 2)];
      const effort = efforts[i % 3];

      stories.push({
        code: `S${i + 1}`,
        title: `${capitalize(template.action)} ${template.object}`,
        userStory: `As a ${persona}, I want to ${template.action} ${template.object}, so that I can ${template.benefit}.`,
        persona,
        acceptanceCriteria: [
          `Given I am logged in as a ${persona}`,
          `When I attempt to ${template.action} ${template.object}`,
          `Then the system should complete the action successfully`,
          `And I should see appropriate feedback`,
        ],
        technicalNotes: `Consider ${epic.theme?.toLowerCase() || "user"} context when implementing.`,
        priority,
        effort,
      });
    }

    return { success: true, data: stories, tokensUsed: 0 };
  }

  async generateSubtasks(
    story: StoryData,
    epicContext: { code: string; title: string },
    mode: GenerationMode
  ): Promise<GenerationResult<SubtaskData[]>> {
    await sleep(800);

    // Subtask counts based on mode
    const subtaskCounts = {
      compact: 4,
      standard: 6,
      detailed: 10,
    };
    const subtaskCount = subtaskCounts[mode];

    const subtaskTemplates = [
      { action: "Design", type: "UI/UX", effort: "S" },
      { action: "Implement", type: "frontend component", effort: "M" },
      { action: "Create", type: "API endpoint", effort: "M" },
      { action: "Write", type: "database queries", effort: "S" },
      { action: "Add", type: "validation logic", effort: "S" },
      { action: "Implement", type: "error handling", effort: "S" },
      { action: "Write", type: "unit tests", effort: "M" },
      { action: "Write", type: "integration tests", effort: "M" },
      { action: "Update", type: "documentation", effort: "XS" },
      { action: "Perform", type: "code review", effort: "S" },
      { action: "Configure", type: "feature flags", effort: "XS" },
      { action: "Set up", type: "monitoring/logging", effort: "S" },
    ];

    const subtasks: SubtaskData[] = [];

    for (let i = 0; i < subtaskCount; i++) {
      const template = subtaskTemplates[i % subtaskTemplates.length];

      subtasks.push({
        code: `ST${i + 1}`,
        title: `${template.action} ${template.type} for ${story.title}`,
        description: `${template.action} the ${template.type} required to implement "${story.title}" in ${epicContext.code}.`,
        effort: template.effort,
      });
    }

    return { success: true, data: subtasks, tokensUsed: 0 };
  }
}

// ============================================
// Utilities
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
