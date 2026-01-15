"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function getProjects() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
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
  return projects;
}

export async function getProject(id: string) {
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
        },
      },
      cards: {
        orderBy: { createdAt: "desc" },
      },
      epics: {
        orderBy: { priority: "asc" },
        include: {
          _count: { select: { stories: true } },
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
  const project = await db.project.create({
    data: {
      name: data.name,
      description: data.description || null,
    },
  });
  revalidatePath("/projects");
  return project;
}

export async function updateProject(id: string, data: { name?: string; description?: string }) {
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
  await db.project.delete({
    where: { id },
  });
  revalidatePath("/projects");
}
