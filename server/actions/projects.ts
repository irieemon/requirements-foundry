"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAuthorizedProject, getAuthorizedProjects } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth";

export async function getProjects() {
  const { projects } = await getAuthorizedProjects();
  return projects;
}

export async function getProjectName(id: string) {
  const { project } = await getAuthorizedProject(id);
  return project.name;
}

export async function getProject(id: string) {
  // Verify ownership first
  await getAuthorizedProject(id);
  // Re-query with full includes for the detail page
  const project = await db.project.findUnique({
    where: { id },
    include: {
      uploads: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filename: true,
          fileType: true,
          extractionStatus: true,
          analysisStatus: true,
          wordCount: true,
          hasImages: true,
          createdAt: true,
          _count: { select: { cards: true } },
          context: {
            select: {
              id: true,
              aiQuestions: true,
              aiAnswers: true,
            },
          },
        },
      },
      cards: {
        orderBy: { createdAt: "desc" },
      },
      epics: {
        orderBy: { priority: "asc" },
        include: {
          _count: { select: { stories: true } },
          mssServiceArea: {
            select: { id: true, code: true, name: true },
          },
          stories: {
            orderBy: { code: "asc" },
            select: {
              id: true,
              code: true,
              title: true,
              userStory: true,
              persona: true,
              acceptanceCriteria: true,
              technicalNotes: true,
              priority: true,
              effort: true,
              mssServiceArea: {
                select: { id: true, code: true, name: true },
              },
              subtasks: {
                orderBy: { code: "asc" },
                select: {
                  id: true,
                  code: true,
                  title: true,
                  description: true,
                  effort: true,
                },
              },
              _count: { select: { subtasks: true } },
            },
          },
        },
      },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: {
        select: {
          uploads: true,
          cards: true,
          epics: true,
          runs: true,
        },
      },
    },
  });
  return project;
}

export async function createProject(data: { name: string; description?: string }) {
  const user = await getCurrentUser();
  const project = await db.project.create({
    data: {
      name: data.name,
      description: data.description || null,
      userId: user.email,
    },
  });
  revalidatePath("/projects");
  return project;
}

export async function updateProject(id: string, data: { name?: string; description?: string }) {
  await getAuthorizedProject(id);
  const project = await db.project.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
    },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return project;
}

export async function deleteProject(id: string) {
  await getAuthorizedProject(id);
  await db.project.delete({
    where: { id },
  });
  revalidatePath("/projects");
}
