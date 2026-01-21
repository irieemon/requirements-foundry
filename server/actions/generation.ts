"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAIProvider, hasAnthropicKey } from "@/lib/ai/provider";
import { RunType, RunStatus, GenerationMode, PersonaSet, CardData } from "@/lib/types";
import { getMssHierarchy, getMssServiceAreaByCode } from "./mss";

export async function generateEpicsForProject(projectId: string) {
  // Create run record
  const run = await db.run.create({
    data: {
      projectId,
      type: RunType.GENERATE_EPICS,
      status: RunStatus.RUNNING,
      startedAt: new Date(),
      logs: `[${new Date().toISOString()}] Starting epic generation...\n`,
    },
  });

  try {
    // Get cards for this project
    const cards = await db.card.findMany({
      where: { projectId },
    });

    if (cards.length === 0) {
      throw new Error("No cards found. Please upload some use cases first.");
    }

    // Convert to CardData format
    const cardData: CardData[] = cards.map((c) => ({
      title: c.title,
      problem: c.problem || undefined,
      targetUsers: c.targetUsers || undefined,
      currentState: c.currentState || undefined,
      desiredOutcomes: c.desiredOutcomes || undefined,
      constraints: c.constraints || undefined,
      systems: c.systems || undefined,
      priority: c.priority || undefined,
      impact: c.impact || undefined,
      rawText: c.rawText || undefined,
    }));

    // Get project for context
    const project = await db.project.findUnique({ where: { id: projectId } });

    // Fetch MSS hierarchy for context
    const mssResult = await getMssHierarchy();
    let mssContext = "";
    if (mssResult.success && mssResult.data && mssResult.data.length > 0) {
      mssContext = mssResult.data
        .map(
          (l2) =>
            `${l2.code} - ${l2.name}:\n${l2.serviceAreas
              .map((l3) => `  ${l3.code} - ${l3.name}`)
              .join("\n")}`
        )
        .join("\n\n");
      await appendLog(run.id, `[DEBUG] MSS hierarchy loaded: ${mssResult.data.length} L2s, context length: ${mssContext.length}`);
    } else {
      await appendLog(run.id, `[DEBUG] MSS hierarchy empty or failed: ${JSON.stringify(mssResult)}`);
    }

    // Generate epics
    const provider = getAIProvider();
    const isRealAI = hasAnthropicKey();

    await appendLog(run.id, `Using ${isRealAI ? "Anthropic API" : "Mock Provider"}`);
    await appendLog(run.id, `Processing ${cards.length} cards...`);
    if (mssContext) {
      await appendLog(run.id, `MSS taxonomy loaded - auto-assignment enabled`);
    }

    const result = await provider.generateEpics(cardData, project?.description || undefined, mssContext || undefined);

    if (!result.success || !result.data) {
      throw new Error(result.error || "Generation failed");
    }

    await appendLog(run.id, `Generated ${result.data.length} epics`);

    // Debug: Log first epic's MSS code
    if (result.data.length > 0) {
      const firstEpic = result.data[0];
      await appendLog(run.id, `[DEBUG] First epic mssServiceAreaCode: "${firstEpic.mssServiceAreaCode || 'undefined'}"`);
    }

    // Delete existing epics for this project (regeneration)
    await db.epic.deleteMany({ where: { projectId } });

    // Create new epics
    for (const epic of result.data) {
      // Resolve MSS service area code to ID if provided
      let mssServiceAreaId: string | null = null;
      if (epic.mssServiceAreaCode) {
        const mssArea = await getMssServiceAreaByCode(epic.mssServiceAreaCode);
        mssServiceAreaId = mssArea?.id ?? null;
        if (mssArea) {
          await appendLog(run.id, `${epic.code}: assigned to ${mssArea.code} (${mssArea.name})`);
        } else {
          await appendLog(run.id, `[DEBUG] ${epic.code}: code "${epic.mssServiceAreaCode}" not found in DB`);
        }
      } else {
        await appendLog(run.id, `[DEBUG] ${epic.code}: no mssServiceAreaCode in AI response`);
      }

      await db.epic.create({
        data: {
          projectId,
          code: epic.code,
          title: epic.title,
          theme: epic.theme || null,
          description: epic.description || null,
          businessValue: epic.businessValue || null,
          acceptanceCriteria: epic.acceptanceCriteria ? JSON.stringify(epic.acceptanceCriteria) : null,
          dependencies: epic.dependencies ? JSON.stringify(epic.dependencies) : null,
          effort: epic.effort || null,
          impact: epic.impact || null,
          priority: epic.priority || null,
          cardIds: epic.cardIds ? JSON.stringify(epic.cardIds) : null,
          runId: run.id,
          mssServiceAreaId,
        },
      });
    }

    // Update run as successful
    await db.run.update({
      where: { id: run.id },
      data: {
        status: RunStatus.SUCCEEDED,
        completedAt: new Date(),
        tokensUsed: result.tokensUsed || 0,
        durationMs: Date.now() - run.startedAt!.getTime(),
        outputData: JSON.stringify({ epicCount: result.data.length }),
      },
    });

    await appendLog(run.id, `Completed successfully`);

    revalidatePath(`/projects/${projectId}`);
    return { success: true, runId: run.id, epicCount: result.data.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await db.run.update({
      where: { id: run.id },
      data: {
        status: RunStatus.FAILED,
        completedAt: new Date(),
        errorMsg,
        durationMs: run.startedAt ? Date.now() - run.startedAt.getTime() : null,
      },
    });
    await appendLog(run.id, `ERROR: ${errorMsg}`);
    revalidatePath(`/projects/${projectId}`);
    return { success: false, error: errorMsg, runId: run.id };
  }
}

export async function generateStoriesForEpic(
  epicId: string,
  mode: GenerationMode,
  personaSet: PersonaSet
) {
  // Get epic with project
  const epic = await db.epic.findUnique({
    where: { id: epicId },
    include: { project: true },
  });

  if (!epic) {
    return { success: false, error: "Epic not found" };
  }

  // Create run record
  const run = await db.run.create({
    data: {
      projectId: epic.projectId,
      type: RunType.GENERATE_STORIES,
      status: RunStatus.RUNNING,
      startedAt: new Date(),
      inputConfig: JSON.stringify({ epicId, mode, personaSet }),
      logs: `[${new Date().toISOString()}] Starting story generation for ${epic.code}...\n`,
    },
  });

  try {
    const epicData = {
      code: epic.code,
      title: epic.title,
      theme: epic.theme || undefined,
      description: epic.description || undefined,
      businessValue: epic.businessValue || undefined,
      acceptanceCriteria: epic.acceptanceCriteria ? JSON.parse(epic.acceptanceCriteria) : undefined,
      dependencies: epic.dependencies ? JSON.parse(epic.dependencies) : undefined,
      effort: epic.effort || undefined,
      impact: epic.impact || undefined,
      priority: epic.priority || undefined,
    };

    const provider = getAIProvider();
    const isRealAI = hasAnthropicKey();

    await appendLog(run.id, `Mode: ${mode}, Personas: ${personaSet}`);
    await appendLog(run.id, `Using ${isRealAI ? "Anthropic API" : "Mock Provider"}`);

    const result = await provider.generateStories(epicData, mode, personaSet);

    if (!result.success || !result.data) {
      throw new Error(result.error || "Generation failed");
    }

    await appendLog(run.id, `Generated ${result.data.length} stories`);

    // Delete existing stories for this epic (regeneration)
    await db.story.deleteMany({ where: { epicId } });

    // Create new stories
    for (const story of result.data) {
      await db.story.create({
        data: {
          epicId,
          code: story.code,
          title: story.title,
          userStory: story.userStory,
          persona: story.persona || null,
          acceptanceCriteria: story.acceptanceCriteria ? JSON.stringify(story.acceptanceCriteria) : null,
          technicalNotes: story.technicalNotes || null,
          priority: story.priority || null,
          effort: story.effort || null,
          runId: run.id,
        },
      });
    }

    // Update run as successful
    await db.run.update({
      where: { id: run.id },
      data: {
        status: RunStatus.SUCCEEDED,
        completedAt: new Date(),
        tokensUsed: result.tokensUsed || 0,
        durationMs: Date.now() - run.startedAt!.getTime(),
        outputData: JSON.stringify({ storyCount: result.data.length }),
      },
    });

    await appendLog(run.id, `Completed successfully`);

    revalidatePath(`/projects/${epic.projectId}`);
    revalidatePath(`/projects/${epic.projectId}/epics/${epicId}`);
    return { success: true, runId: run.id, storyCount: result.data.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await db.run.update({
      where: { id: run.id },
      data: {
        status: RunStatus.FAILED,
        completedAt: new Date(),
        errorMsg,
        durationMs: run.startedAt ? Date.now() - run.startedAt.getTime() : null,
      },
    });
    await appendLog(run.id, `ERROR: ${errorMsg}`);
    revalidatePath(`/projects/${epic.projectId}`);
    return { success: false, error: errorMsg, runId: run.id };
  }
}

async function appendLog(runId: string, message: string) {
  const timestamp = new Date().toISOString();

  // Get current logs and append the new message
  const run = await db.run.findUnique({ where: { id: runId } });
  const currentLogs = run?.logs || "";
  await db.run.update({
    where: { id: runId },
    data: { logs: `${currentLogs}[${timestamp}] ${message}\n` },
  });
}

export async function getRun(id: string) {
  return db.run.findUnique({
    where: { id },
    include: { project: true },
  });
}

export async function getRunsForProject(projectId: string) {
  return db.run.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}
