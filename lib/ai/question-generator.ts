// ============================================
// Question Generator - Claude AI Integration
// Generates clarifying questions based on documents + context
// ============================================

import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedContent } from "@/lib/documents/types";
import type { UploadContextFormData } from "@/lib/uploads/context-schema";
import {
  type AIQuestion,
  aiQuestionsArraySchema,
  QUESTION_CATEGORIES,
} from "@/lib/uploads/context-schema";
import { hasAnthropicKey } from "./provider";

// ============================================
// Types
// ============================================

export interface QuestionGenerationResult {
  success: boolean;
  questions?: AIQuestion[];
  error?: string;
  tokensUsed?: number;
}

export interface QuestionGeneratorOptions {
  maxQuestions?: number; // Default: 5
  focusAreas?: (typeof QUESTION_CATEGORIES)[number][]; // Optional focus areas
}

// ============================================
// Question Generator Interface
// ============================================

export interface QuestionGenerator {
  generateQuestions(
    documentContents: ExtractedContent[],
    userContext: UploadContextFormData | null,
    options?: QuestionGeneratorOptions
  ): Promise<QuestionGenerationResult>;

  isAvailable(): boolean;
}

// ============================================
// Anthropic Question Generator
// ============================================

class AnthropicQuestionGenerator implements QuestionGenerator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  isAvailable(): boolean {
    return true;
  }

  async generateQuestions(
    documentContents: ExtractedContent[],
    userContext: UploadContextFormData | null,
    options: QuestionGeneratorOptions = {}
  ): Promise<QuestionGenerationResult> {
    const { maxQuestions = 5, focusAreas } = options;

    try {
      // Build document context
      const documentText = this.buildDocumentContext(documentContents);

      // Build user context section
      const userContextSection = this.buildUserContextSection(userContext);

      // Build focus areas guidance
      const focusGuidance = focusAreas?.length
        ? `Focus your questions on these areas: ${focusAreas.join(", ")}.`
        : "";

      const systemPrompt = `You are a requirements analyst helping to gather clarifying information for software project documentation.

Your task is to review the uploaded documents and user-provided context, then generate ${maxQuestions} targeted clarifying questions that will help produce better requirements.

CRITICAL RULES:
1. Questions must be SPECIFIC to the uploaded documents - reference actual content, terms, or concepts from them
2. Avoid generic questions that could apply to any project
3. Each question should help clarify ambiguities, scope boundaries, or missing details
4. Questions should be answerable by a human familiar with the project
5. Questions help produce better requirements - they should NOT be requirements themselves
6. Each question should have a clear purpose/context explaining why it matters

${focusGuidance}

Categories for questions:
- scope: Questions about what's in/out of scope
- users: Questions about target users, stakeholders, or personas
- constraints: Questions about technical, business, or regulatory constraints
- integration: Questions about systems, APIs, or external dependencies
- priority: Questions about importance, urgency, or sequencing
- other: Questions that don't fit the above categories

Return your response as a valid JSON array with this structure:
[
  {
    "id": "q1",
    "question": "What is the expected concurrent user load for the authentication system mentioned in section 2?",
    "category": "constraints",
    "importance": "high",
    "context": "The document mentions 'enterprise-scale' but doesn't specify numbers, which affects architecture decisions"
  }
]

IMPORTANT:
- Generate exactly ${maxQuestions} questions (or fewer if the documents don't warrant that many)
- Each question ID should be "q1", "q2", etc.
- Only return the JSON array, no other text`;

      const userPrompt = `${userContextSection}

DOCUMENTS TO ANALYZE:
${documentText}

Generate ${maxQuestions} clarifying questions based on the above documents and context.`;

      const message = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const responseContent = message.content[0];
      if (responseContent.type !== "text") {
        return { success: false, error: "Unexpected response type" };
      }

      // Extract JSON from response
      const jsonMatch = responseContent.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return { success: false, error: "Could not parse JSON from response" };
      }

      // Parse and validate with Zod
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = aiQuestionsArraySchema.safeParse(parsed);

      if (!validated.success) {
        return {
          success: false,
          error: `Invalid question format: ${validated.error.message}`,
        };
      }

      const tokensUsed =
        message.usage.input_tokens + message.usage.output_tokens;

      return { success: true, questions: validated.data, tokensUsed };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Build document context from extracted contents
   */
  private buildDocumentContext(contents: ExtractedContent[]): string {
    return contents
      .map((content, index) => {
        const header = `--- Document ${index + 1}: ${content.metadata.filename} (${content.metadata.wordCount} words) ---`;
        // Truncate very long documents to prevent token overflow
        const text =
          content.text.length > 15000
            ? content.text.slice(0, 15000) + "\n\n[...content truncated...]"
            : content.text;
        return `${header}\n\n${text}`;
      })
      .join("\n\n");
  }

  /**
   * Build user context section from form data
   */
  private buildUserContextSection(
    context: UploadContextFormData | null
  ): string {
    if (!context) {
      return "USER-PROVIDED CONTEXT: None provided";
    }

    const parts: string[] = ["USER-PROVIDED CONTEXT:"];

    if (context.projectType) {
      parts.push(`- Project Type: ${context.projectType}`);
    }
    if (context.businessDomain) {
      parts.push(`- Business Domain: ${context.businessDomain}`);
    }
    if (context.targetAudience) {
      parts.push(`- Target Audience: ${context.targetAudience}`);
    }
    if (context.documentType) {
      parts.push(`- Document Type: ${context.documentType}`);
    }
    if (context.sourceSystem) {
      parts.push(`- Source System: ${context.sourceSystem}`);
    }
    if (context.keyTerms) {
      parts.push(`- Key Terms: ${context.keyTerms}`);
    }
    if (context.notes) {
      parts.push(`- Additional Notes: ${context.notes}`);
    }

    return parts.length > 1 ? parts.join("\n") : "USER-PROVIDED CONTEXT: None provided";
  }
}

// ============================================
// Mock Question Generator
// ============================================

class MockQuestionGenerator implements QuestionGenerator {
  isAvailable(): boolean {
    return true;
  }

  async generateQuestions(
    documentContents: ExtractedContent[],
    userContext: UploadContextFormData | null,
    options: QuestionGeneratorOptions = {}
  ): Promise<QuestionGenerationResult> {
    const { maxQuestions = 5 } = options;

    // Simulate processing delay
    await sleep(800);

    // Generate deterministic mock questions based on document content
    const hasDocuments = documentContents.length > 0;
    const totalWords = documentContents.reduce(
      (sum, c) => sum + c.metadata.wordCount,
      0
    );

    const mockQuestions: AIQuestion[] = [];

    // Base questions that adapt to context
    const questionTemplates = [
      {
        id: "q1",
        question: hasDocuments
          ? `The document "${documentContents[0]?.metadata.filename || "uploaded file"}" mentions multiple user types. Could you clarify which user role should be prioritized for the initial release?`
          : "What are the primary user roles that will interact with this system?",
        category: "users" as const,
        importance: "high" as const,
        context:
          "Understanding user priorities helps scope the MVP and ensure the most critical workflows are addressed first.",
      },
      {
        id: "q2",
        question: userContext?.businessDomain
          ? `Given the ${userContext.businessDomain} domain, are there specific regulatory or compliance requirements that should constrain the implementation?`
          : "Are there any regulatory, compliance, or security requirements that should be considered?",
        category: "constraints" as const,
        importance: "high" as const,
        context:
          "Compliance requirements often significantly impact architecture and should be identified early.",
      },
      {
        id: "q3",
        question:
          "What existing systems or APIs will this solution need to integrate with?",
        category: "integration" as const,
        importance: "medium" as const,
        context:
          "Integration points affect technical complexity and may require coordination with other teams.",
      },
      {
        id: "q4",
        question: hasDocuments
          ? `The documents total approximately ${totalWords} words. Are all sections equally important, or are there specific areas that are higher priority?`
          : "Which features or capabilities are absolutely essential for the first version?",
        category: "priority" as const,
        importance: "medium" as const,
        context:
          "Prioritization helps focus effort on the most valuable capabilities.",
      },
      {
        id: "q5",
        question:
          "Are there any features or capabilities that are explicitly out of scope for this project?",
        category: "scope" as const,
        importance: "medium" as const,
        context:
          "Clear scope boundaries prevent feature creep and help set realistic expectations.",
      },
      {
        id: "q6",
        question:
          "What is the expected timeline or deadline for the initial release?",
        category: "constraints" as const,
        importance: "low" as const,
        context:
          "Timeline constraints may affect which features can be included in the initial scope.",
      },
      {
        id: "q7",
        question:
          "Are there any legacy systems that will be replaced or decommissioned as part of this project?",
        category: "integration" as const,
        importance: "low" as const,
        context:
          "Migration from legacy systems may require additional data migration or compatibility considerations.",
      },
    ];

    // Select questions up to maxQuestions
    const selectedQuestions = questionTemplates.slice(0, maxQuestions);

    // Re-number IDs
    for (let i = 0; i < selectedQuestions.length; i++) {
      mockQuestions.push({
        ...selectedQuestions[i],
        id: `q${i + 1}`,
      });
    }

    return { success: true, questions: mockQuestions, tokensUsed: 0 };
  }
}

// ============================================
// Factory Function
// ============================================

export function getQuestionGenerator(): QuestionGenerator {
  if (hasAnthropicKey()) {
    return new AnthropicQuestionGenerator();
  }
  return new MockQuestionGenerator();
}

// ============================================
// Utilities
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
