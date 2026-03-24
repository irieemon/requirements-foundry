import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only (prevents import error in test environment)
vi.mock("server-only", () => ({}));

// Mock next/cache
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Mock getAuthorizedProject
const mockGetAuthorizedProject = vi.fn();
vi.mock("@/lib/auth/authorization", () => ({
  getAuthorizedProject: (...args: unknown[]) => mockGetAuthorizedProject(...args),
}));

// Mock db
const mockUserFindMany = vi.fn();
const mockUserFindUnique = vi.fn();
const mockProjectFindUnique = vi.fn();
const mockShareCreate = vi.fn();
const mockShareUpdate = vi.fn();
const mockShareDelete = vi.fn();
const mockShareFindUnique = vi.fn();
const mockShareFindMany = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    project: {
      findUnique: (...args: unknown[]) => mockProjectFindUnique(...args),
    },
    projectShare: {
      create: (...args: unknown[]) => mockShareCreate(...args),
      update: (...args: unknown[]) => mockShareUpdate(...args),
      delete: (...args: unknown[]) => mockShareDelete(...args),
      findUnique: (...args: unknown[]) => mockShareFindUnique(...args),
      findMany: (...args: unknown[]) => mockShareFindMany(...args),
    },
  },
}));

import {
  searchUsers,
  shareProject,
  updateShareRole,
  removeShare,
  getProjectShares,
} from "../shares";

describe("share server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // searchUsers
  // ============================================
  describe("searchUsers", () => {
    it("returns users matching query by email (case-insensitive)", async () => {
      mockProjectFindUnique.mockResolvedValue({ userId: "owner@example.com" });
      mockUserFindUnique.mockResolvedValue({ id: "owner-id" });
      mockUserFindMany.mockResolvedValue([
        { id: "u1", email: "alice@example.com", name: "Alice" },
      ]);

      const result = await searchUsers("alice", "proj-1");

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    email: { contains: "alice", mode: "insensitive" },
                  }),
                ]),
              }),
            ]),
          }),
        })
      );
      expect(result).toEqual([
        { id: "u1", email: "alice@example.com", name: "Alice" },
      ]);
    });

    it("returns users matching query by name (case-insensitive)", async () => {
      mockProjectFindUnique.mockResolvedValue({ userId: "owner@example.com" });
      mockUserFindUnique.mockResolvedValue({ id: "owner-id" });
      mockUserFindMany.mockResolvedValue([
        { id: "u2", email: "bob@example.com", name: "Bob Smith" },
      ]);

      const result = await searchUsers("bob", "proj-1");

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    name: { contains: "bob", mode: "insensitive" },
                  }),
                ]),
              }),
            ]),
          }),
        })
      );
      expect(result).toEqual([
        { id: "u2", email: "bob@example.com", name: "Bob Smith" },
      ]);
    });

    it("excludes already-shared user IDs passed in excludeUserIds", async () => {
      mockProjectFindUnique.mockResolvedValue({ userId: "owner@example.com" });
      mockUserFindUnique.mockResolvedValue({ id: "owner-id" });
      mockUserFindMany.mockResolvedValue([]);

      await searchUsers("test", "proj-1", ["shared-user-1"]);

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                id: { notIn: expect.arrayContaining(["shared-user-1", "owner-id"]) },
              }),
            ]),
          }),
        })
      );
    });

    it("excludes the project owner from results", async () => {
      mockProjectFindUnique.mockResolvedValue({ userId: "owner@example.com" });
      mockUserFindUnique.mockResolvedValue({ id: "owner-id" });
      mockUserFindMany.mockResolvedValue([]);

      await searchUsers("test", "proj-1");

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                id: { notIn: expect.arrayContaining(["owner-id"]) },
              }),
            ]),
          }),
        })
      );
    });

    it("returns max 10 results", async () => {
      mockProjectFindUnique.mockResolvedValue({ userId: "owner@example.com" });
      mockUserFindUnique.mockResolvedValue({ id: "owner-id" });
      mockUserFindMany.mockResolvedValue([]);

      await searchUsers("test", "proj-1");

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it("returns empty array when query is less than 2 characters", async () => {
      const result = await searchUsers("a", "proj-1");

      expect(result).toEqual([]);
      expect(mockUserFindMany).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // shareProject
  // ============================================
  describe("shareProject", () => {
    it("creates ProjectShare with role 'editor' (default) when caller is owner", async () => {
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "owner",
        canEdit: true,
        isAdmin: false,
      });
      mockShareCreate.mockResolvedValue({ id: "share-1", projectId: "proj-1", userId: "u1", role: "editor" });

      const result = await shareProject("proj-1", "u1");

      expect(mockShareCreate).toHaveBeenCalledWith({
        data: { projectId: "proj-1", userId: "u1", role: "editor" },
      });
      expect(result).toEqual({ success: true });
    });

    it("creates ProjectShare with role 'viewer' when explicitly specified", async () => {
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "owner",
        canEdit: true,
        isAdmin: false,
      });
      mockShareCreate.mockResolvedValue({ id: "share-1", projectId: "proj-1", userId: "u1", role: "viewer" });

      const result = await shareProject("proj-1", "u1", "viewer");

      expect(mockShareCreate).toHaveBeenCalledWith({
        data: { projectId: "proj-1", userId: "u1", role: "viewer" },
      });
      expect(result).toEqual({ success: true });
    });

    it("returns error when caller is editor (not owner/admin)", async () => {
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "editor",
        canEdit: true,
        isAdmin: false,
      });

      const result = await shareProject("proj-1", "u1");

      expect(result).toEqual({ success: false, error: "Only owners can share projects" });
      expect(mockShareCreate).not.toHaveBeenCalled();
    });

    it("returns error when caller is viewer", async () => {
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "viewer",
        canEdit: false,
        isAdmin: false,
      });

      const result = await shareProject("proj-1", "u1");

      expect(result).toEqual({ success: false, error: "Only owners can share projects" });
      expect(mockShareCreate).not.toHaveBeenCalled();
    });

    it("handles duplicate share (P2002) gracefully", async () => {
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "owner",
        canEdit: true,
        isAdmin: false,
      });

      // Simulate Prisma P2002 unique constraint violation
      const prismaError = new Error("Unique constraint failed") as Error & { code: string };
      prismaError.code = "P2002";
      // Make it look like a PrismaClientKnownRequestError
      Object.defineProperty(prismaError, "constructor", {
        value: { name: "PrismaClientKnownRequestError" },
      });
      mockShareCreate.mockRejectedValue(prismaError);

      const result = await shareProject("proj-1", "u1");

      expect(result).toEqual({
        success: false,
        error: "User already has access to this project",
      });
    });
  });

  // ============================================
  // updateShareRole
  // ============================================
  describe("updateShareRole", () => {
    it("updates role from editor to viewer when caller is owner", async () => {
      mockShareFindUnique.mockResolvedValue({
        id: "share-1",
        projectId: "proj-1",
        userId: "u1",
        role: "editor",
      });
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "owner",
        canEdit: true,
        isAdmin: false,
      });
      mockShareUpdate.mockResolvedValue({
        id: "share-1",
        projectId: "proj-1",
        userId: "u1",
        role: "viewer",
      });

      const result = await updateShareRole("share-1", "viewer");

      expect(mockShareUpdate).toHaveBeenCalledWith({
        where: { id: "share-1" },
        data: { role: "viewer" },
      });
      expect(result).toEqual({ success: true });
    });

    it("returns error when share not found", async () => {
      mockShareFindUnique.mockResolvedValue(null);

      const result = await updateShareRole("nonexistent", "viewer");

      expect(result).toEqual({ success: false, error: "Share not found" });
      expect(mockGetAuthorizedProject).not.toHaveBeenCalled();
    });

    it("returns error when caller is not owner/admin", async () => {
      mockShareFindUnique.mockResolvedValue({
        id: "share-1",
        projectId: "proj-1",
        userId: "u1",
        role: "editor",
      });
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "editor",
        canEdit: true,
        isAdmin: false,
      });

      const result = await updateShareRole("share-1", "viewer");

      expect(result).toEqual({ success: false, error: "Only owners can modify shares" });
      expect(mockShareUpdate).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // removeShare
  // ============================================
  describe("removeShare", () => {
    it("deletes ProjectShare when caller is owner", async () => {
      mockShareFindUnique.mockResolvedValue({
        id: "share-1",
        projectId: "proj-1",
        userId: "u1",
        role: "editor",
      });
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "owner",
        canEdit: true,
        isAdmin: false,
      });
      mockShareDelete.mockResolvedValue({});

      const result = await removeShare("share-1");

      expect(mockShareDelete).toHaveBeenCalledWith({
        where: { id: "share-1" },
      });
      expect(result).toEqual({ success: true });
    });

    it("returns error when share not found", async () => {
      mockShareFindUnique.mockResolvedValue(null);

      const result = await removeShare("nonexistent");

      expect(result).toEqual({ success: false, error: "Share not found" });
      expect(mockGetAuthorizedProject).not.toHaveBeenCalled();
    });

    it("returns error when caller is not owner/admin", async () => {
      mockShareFindUnique.mockResolvedValue({
        id: "share-1",
        projectId: "proj-1",
        userId: "u1",
        role: "editor",
      });
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "editor",
        canEdit: true,
        isAdmin: false,
      });

      const result = await removeShare("share-1");

      expect(result).toEqual({ success: false, error: "Only owners can remove shares" });
      expect(mockShareDelete).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // getProjectShares
  // ============================================
  describe("getProjectShares", () => {
    it("returns shares with user details when caller is owner", async () => {
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "owner",
        canEdit: true,
        isAdmin: false,
      });
      const shares = [
        {
          id: "share-1",
          projectId: "proj-1",
          userId: "u1",
          role: "editor",
          createdAt: new Date("2026-01-01"),
          user: { id: "u1", email: "alice@example.com", name: "Alice" },
        },
        {
          id: "share-2",
          projectId: "proj-1",
          userId: "u2",
          role: "viewer",
          createdAt: new Date("2026-01-02"),
          user: { id: "u2", email: "bob@example.com", name: "Bob" },
        },
      ];
      mockShareFindMany.mockResolvedValue(shares);

      const result = await getProjectShares("proj-1");

      expect(result).toEqual({ success: true, shares });
      expect(mockShareFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: "proj-1" },
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      );
    });

    it("returns error when caller is not owner/admin", async () => {
      mockGetAuthorizedProject.mockResolvedValue({
        project: { id: "proj-1", userId: "owner@example.com" },
        role: "editor",
        canEdit: true,
        isAdmin: false,
      });

      const result = await getProjectShares("proj-1");

      expect(result).toEqual({
        success: false,
        error: "Only owners can view shares",
        shares: [],
      });
      expect(mockShareFindMany).not.toHaveBeenCalled();
    });
  });
});
