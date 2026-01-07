// ============================================
// Document Analyzer - Claude AI Integration
// Multi-modal analysis of extracted documents
// ============================================

import Anthropic from "@anthropic-ai/sdk";
import type { CardData } from "@/lib/types";
import type { ExtractedContent, ExtractedImage } from "@/lib/documents/types";
import { hasAnthropicKey } from "./provider";

// ============================================
// Types
// ============================================

export interface DocumentAnalysisResult {
  success: boolean;
  cards?: CardData[];
  error?: string;
  tokensUsed?: number;
}

export interface AnalysisOptions {
  /** Maximum number of cards to extract */
  maxCards?: number;
  /** Include raw text in card data */
  includeRawText?: boolean;
  /** Project context for better analysis */
  projectContext?: string;
}

// ============================================
// Document Analyzer Interface
// ============================================

export interface DocumentAnalyzer {
  analyzeDocument(
    content: ExtractedContent,
    options?: AnalysisOptions
  ): Promise<DocumentAnalysisResult>;

  analyzeDocuments(
    contents: ExtractedContent[],
    options?: AnalysisOptions
  ): Promise<DocumentAnalysisResult>;

  isAvailable(): boolean;
}

// ============================================
// Anthropic Document Analyzer
// ============================================

class AnthropicDocumentAnalyzer implements DocumentAnalyzer {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  isAvailable(): boolean {
    return true;
  }

  async analyzeDocument(
    content: ExtractedContent,
    options: AnalysisOptions = {}
  ): Promise<DocumentAnalysisResult> {
    return this.analyzeDocuments([content], options);
  }

  async analyzeDocuments(
    contents: ExtractedContent[],
    options: AnalysisOptions = {}
  ): Promise<DocumentAnalysisResult> {
    const { maxCards = 20, includeRawText = false, projectContext } = options;

    try {
      // Build multi-modal message content
      const messageContent = this.buildMessageContent(contents);

      const systemPrompt = `You are a product requirements analyst specialized in extracting use case cards from documents.

Your task is to analyze the provided document(s) and extract distinct use cases, requirements, or feature requests.

For each use case found, extract:
- title: A concise, descriptive title
- problem: The problem or opportunity being addressed
- targetUsers: Who will benefit from this
- currentState: How things work currently (if mentioned)
- desiredOutcomes: What success looks like
- constraints: Any limitations or requirements
- systems: Systems or components involved
- priority: If mentioned (high/medium/low)
- impact: Business impact if mentioned

${projectContext ? `Project Context: ${projectContext}` : ""}

Rules:
1. Extract UP TO ${maxCards} distinct use cases
2. Each use case should be self-contained and actionable
3. If documents contain images (diagrams, screenshots, mockups), analyze them for additional context
4. Merge related items into single comprehensive cards
5. Prioritize clarity over completeness
6. If no clear use cases exist, return an empty array

Return ONLY a valid JSON array of cards:
[
  {
    "title": "Use Case Title",
    "problem": "Problem description",
    "targetUsers": "User types",
    "currentState": "Current situation",
    "desiredOutcomes": "Expected outcomes",
    "constraints": "Limitations",
    "systems": "Systems involved",
    "priority": "high|medium|low",
    "impact": "Impact description"
  }
]`;

      const message = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: messageContent }],
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

      const cards = JSON.parse(jsonMatch[0]) as CardData[];

      // Optionally add raw text to cards
      if (includeRawText) {
        const combinedText = contents.map((c) => c.text).join("\n\n---\n\n");
        cards.forEach((card) => {
          card.rawText = combinedText.slice(0, 1000); // First 1000 chars as context
        });
      }

      const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

      return { success: true, cards, tokensUsed };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Build multi-modal message content with text and images
   */
  private buildMessageContent(
    contents: ExtractedContent[]
  ): Anthropic.Messages.ContentBlockParam[] {
    const messageContent: Anthropic.Messages.ContentBlockParam[] = [];

    for (const content of contents) {
      // Add text content
      if (content.text.trim()) {
        messageContent.push({
          type: "text",
          text: `Document: ${content.metadata.filename}\n\n${content.text}`,
        });
      }

      // Add images (limit to 10 per Claude's constraints)
      const images = content.images.slice(0, 10);
      for (const image of images) {
        messageContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: image.mimeType as
              | "image/png"
              | "image/jpeg"
              | "image/gif"
              | "image/webp",
            data: image.base64,
          },
        });
      }
    }

    return messageContent;
  }
}

// ============================================
// Mock Document Analyzer
// ============================================

class MockDocumentAnalyzer implements DocumentAnalyzer {
  isAvailable(): boolean {
    return true;
  }

  async analyzeDocument(
    content: ExtractedContent,
    options: AnalysisOptions = {}
  ): Promise<DocumentAnalysisResult> {
    return this.analyzeDocuments([content], options);
  }

  async analyzeDocuments(
    contents: ExtractedContent[],
    options: AnalysisOptions = {}
  ): Promise<DocumentAnalysisResult> {
    const { maxCards = 20, includeRawText = false } = options;

    // Simulate processing delay
    await sleep(1500);

    // Generate deterministic mock cards based on content
    const cards: CardData[] = [];
    const totalWords = contents.reduce((sum, c) => sum + c.metadata.wordCount, 0);
    const cardCount = Math.min(Math.max(1, Math.ceil(totalWords / 500)), maxCards);

    const templates = [
      {
        title: "User Authentication System",
        problem: "Users need secure access to the system",
        targetUsers: "All system users",
        systems: "Authentication, Identity Management",
      },
      {
        title: "Data Export Functionality",
        problem: "Users need to export data for external analysis",
        targetUsers: "Analysts, Managers",
        systems: "Reporting, Data Pipeline",
      },
      {
        title: "Dashboard Customization",
        problem: "Different users need different views of data",
        targetUsers: "End Users, Administrators",
        systems: "UI, Configuration",
      },
      {
        title: "Automated Notifications",
        problem: "Users miss important updates",
        targetUsers: "All users",
        systems: "Notification, Email",
      },
      {
        title: "Search and Filter Enhancement",
        problem: "Finding specific items is time-consuming",
        targetUsers: "Power Users",
        systems: "Search, Database",
      },
      {
        title: "Integration with External Systems",
        problem: "Manual data sync creates errors",
        targetUsers: "Operations Team",
        systems: "API, Integration Layer",
      },
      {
        title: "Mobile Access Requirements",
        problem: "Users need access from mobile devices",
        targetUsers: "Field Workers",
        systems: "Mobile App, API",
      },
      {
        title: "Audit Trail Implementation",
        problem: "Compliance requires tracking all changes",
        targetUsers: "Compliance Team",
        systems: "Logging, Database",
      },
    ];

    for (let i = 0; i < cardCount; i++) {
      const template = templates[i % templates.length];
      const priorities = ["high", "medium", "low"];

      const card: CardData = {
        title: `${template.title} (from ${contents[0]?.metadata.filename || "document"})`,
        problem: template.problem,
        targetUsers: template.targetUsers,
        currentState: "Manual process or limited functionality",
        desiredOutcomes: "Streamlined, automated solution meeting user needs",
        constraints: "Must integrate with existing systems",
        systems: template.systems,
        priority: priorities[i % 3],
        impact: i < cardCount / 2 ? "High business value" : "Moderate improvement",
      };

      if (includeRawText) {
        const combinedText = contents.map((c) => c.text).join("\n\n---\n\n");
        card.rawText = combinedText.slice(0, 500);
      }

      cards.push(card);
    }

    return { success: true, cards, tokensUsed: 0 };
  }
}

// ============================================
// Factory Function
// ============================================

export function getDocumentAnalyzer(): DocumentAnalyzer {
  if (hasAnthropicKey()) {
    return new AnthropicDocumentAnalyzer();
  }
  return new MockDocumentAnalyzer();
}

// ============================================
// Utilities
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
