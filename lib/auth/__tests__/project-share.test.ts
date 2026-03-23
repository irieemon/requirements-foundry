import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only (prevents import error in test environment)
vi.mock("server-only", () => ({}));

// Mock db with projectShare and user models
const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockDelete = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    projectShare: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

import { db } from "@/lib/db";

describe("ProjectShare schema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("creating a ProjectShare", () => {
    it("accepts valid projectId, userId, and role fields", async () => {
      const shareData = {
        id: "share-1",
        projectId: "proj-1",
        userId: "user-1",
        role: "editor",
        createdAt: new Date(),
      };
      mockCreate.mockResolvedValue(shareData);

      const result = await db.projectShare.create({
        data: {
          projectId: "proj-1",
          userId: "user-1",
          role: "editor",
        },
      });

      expect(result).toEqual(shareData);
      expect(result.projectId).toBe("proj-1");
      expect(result.userId).toBe("user-1");
      expect(result.role).toBe("editor");
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          projectId: "proj-1",
          userId: "user-1",
          role: "editor",
        },
      });
    });

    it("supports viewer role", async () => {
      const shareData = {
        id: "share-2",
        projectId: "proj-1",
        userId: "user-2",
        role: "viewer",
        createdAt: new Date(),
      };
      mockCreate.mockResolvedValue(shareData);

      const result = await db.projectShare.create({
        data: {
          projectId: "proj-1",
          userId: "user-2",
          role: "viewer",
        },
      });

      expect(result.role).toBe("viewer");
    });
  });

  describe("unique constraint on [projectId, userId]", () => {
    it("rejects duplicate share for same project and user", async () => {
      // Prisma throws P2002 for unique constraint violations
      const prismaError = new Error("Unique constraint failed on the fields: (`projectId`,`userId`)");
      (prismaError as Record<string, unknown>).code = "P2002";
      mockCreate.mockRejectedValue(prismaError);

      await expect(
        db.projectShare.create({
          data: {
            projectId: "proj-1",
            userId: "user-1",
            role: "editor",
          },
        })
      ).rejects.toThrow("Unique constraint failed");
    });
  });

  describe("querying shares by projectId", () => {
    it("returns all shares for a given project", async () => {
      const shares = [
        { id: "share-1", projectId: "proj-1", userId: "user-1", role: "editor", createdAt: new Date() },
        { id: "share-2", projectId: "proj-1", userId: "user-2", role: "viewer", createdAt: new Date() },
      ];
      mockFindMany.mockResolvedValue(shares);

      const result = await db.projectShare.findMany({
        where: { projectId: "proj-1" },
      });

      expect(result).toHaveLength(2);
      expect(result[0].projectId).toBe("proj-1");
      expect(result[1].projectId).toBe("proj-1");
    });
  });

  describe("cascade delete behavior", () => {
    it("schema defines onDelete: Cascade for project relation", async () => {
      // Verify by reading the schema file that onDelete: Cascade is present
      const fs = await import("fs");
      const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");

      // ProjectShare model should have cascade delete on both project and user relations
      expect(schema).toContain("model ProjectShare");

      // Check for cascade on project relation
      const projectShareBlock = schema.slice(
        schema.indexOf("model ProjectShare"),
        schema.indexOf("}", schema.indexOf("model ProjectShare")) + 1
      );
      expect(projectShareBlock).toContain("onDelete: Cascade");

      // Should have two cascade deletes (project and user)
      const cascadeCount = (projectShareBlock.match(/onDelete: Cascade/g) || []).length;
      expect(cascadeCount).toBe(2);
    });

    it("schema defines unique constraint on [projectId, userId]", async () => {
      const fs = await import("fs");
      const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");

      const projectShareBlock = schema.slice(
        schema.indexOf("model ProjectShare"),
        schema.indexOf("}", schema.indexOf("model ProjectShare")) + 1
      );
      expect(projectShareBlock).toContain("@@unique([projectId, userId])");
    });
  });
});
