"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseTextToCards } from "@/lib/parsers/text-parser";
import { parseCSVToCards } from "@/lib/parsers/csv-parser";
import { ExtractionStatus, AnalysisStatus } from "@/lib/types";

export async function createUploadFromText(projectId: string, text: string, filename?: string) {
  // Create the upload record (text paste = direct parsing, no AI needed)
  const upload = await db.upload.create({
    data: {
      projectId,
      filename: filename || null,
      fileType: "text/plain",
      rawContent: text,
      extractionStatus: ExtractionStatus.EXTRACTED,
      analysisStatus: AnalysisStatus.ANALYZING,
    },
  });

  try {
    // Parse text into cards (direct parsing, no AI)
    const cardDataList = parseTextToCards(text);

    // Create cards in database
    if (cardDataList.length > 0) {
      await db.card.createMany({
        data: cardDataList.map((card) => ({
          projectId,
          uploadId: upload.id,
          title: card.title,
          problem: card.problem || null,
          targetUsers: card.targetUsers || null,
          currentState: card.currentState || null,
          desiredOutcomes: card.desiredOutcomes || null,
          constraints: card.constraints || null,
          systems: card.systems || null,
          priority: card.priority || null,
          impact: card.impact || null,
          rawText: card.rawText || null,
        })),
      });
    }

    // Update upload status - direct parsing completes both extraction and analysis
    await db.upload.update({
      where: { id: upload.id },
      data: { analysisStatus: AnalysisStatus.COMPLETED },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, uploadId: upload.id, cardCount: cardDataList.length };
  } catch (error) {
    // Update upload with error
    await db.upload.update({
      where: { id: upload.id },
      data: {
        analysisStatus: AnalysisStatus.FAILED,
        errorMsg: error instanceof Error ? error.message : "Unknown error",
        errorPhase: "analysis",
      },
    });
    revalidatePath(`/projects/${projectId}`);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function createUploadFromCSV(projectId: string, csvContent: string, filename: string) {
  // Create the upload record (CSV = direct parsing, no AI needed)
  const upload = await db.upload.create({
    data: {
      projectId,
      filename,
      fileType: "text/csv",
      rawContent: csvContent,
      extractionStatus: ExtractionStatus.EXTRACTED,
      analysisStatus: AnalysisStatus.ANALYZING,
    },
  });

  try {
    // Parse CSV into cards (direct parsing, no AI)
    const { cards: cardDataList, autoMapping } = parseCSVToCards(csvContent);

    if (!autoMapping) {
      throw new Error("Could not auto-detect column mapping. Please check CSV format.");
    }

    // Create cards in database
    if (cardDataList.length > 0) {
      await db.card.createMany({
        data: cardDataList.map((card) => ({
          projectId,
          uploadId: upload.id,
          title: card.title,
          problem: card.problem || null,
          targetUsers: card.targetUsers || null,
          currentState: card.currentState || null,
          desiredOutcomes: card.desiredOutcomes || null,
          constraints: card.constraints || null,
          systems: card.systems || null,
          priority: card.priority || null,
          impact: card.impact || null,
          rawText: card.rawText || null,
        })),
      });
    }

    // Update upload status - direct parsing completes both extraction and analysis
    await db.upload.update({
      where: { id: upload.id },
      data: { analysisStatus: AnalysisStatus.COMPLETED },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, uploadId: upload.id, cardCount: cardDataList.length };
  } catch (error) {
    await db.upload.update({
      where: { id: upload.id },
      data: {
        analysisStatus: AnalysisStatus.FAILED,
        errorMsg: error instanceof Error ? error.message : "Unknown error",
        errorPhase: "analysis",
      },
    });
    revalidatePath(`/projects/${projectId}`);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getUpload(id: string) {
  return db.upload.findUnique({
    where: { id },
    include: {
      cards: true,
      project: true,
    },
  });
}

export async function deleteUpload(id: string) {
  const upload = await db.upload.findUnique({ where: { id } });
  if (!upload) return;

  await db.upload.delete({ where: { id } });
  revalidatePath(`/projects/${upload.projectId}`);
}
