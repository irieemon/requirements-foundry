import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only (prevents import error in test environment)
vi.mock("server-only", () => ({}));

// Mock next/navigation
const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// Mock getCurrentUser
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Mock db
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import {
  ADMIN_EMAIL,
  isAdmin,
  getAuthorizedProject,
  getAuthorizedProjects,
} from "../authorization";

describe("authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ADMIN_EMAIL", () => {
    it("equals sean.mcinerney@merkle.com", () => {
      expect(ADMIN_EMAIL).toBe("sean.mcinerney@merkle.com");
    });
  });

  describe("isAdmin", () => {
    it("returns true for admin email", () => {
      expect(isAdmin("sean.mcinerney@merkle.com")).toBe(true);
    });

    it("returns false for other emails", () => {
      expect(isAdmin("other@example.com")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isAdmin("")).toBe(false);
    });
  });

  describe("getAuthorizedProject", () => {
    const adminUser = {
      sub: "admin-sub",
      email: "sean.mcinerney@merkle.com",
      name: "Sean McInerney",
      groups: [],
    };

    const regularUser = {
      sub: "user-sub",
      email: "user@example.com",
      name: "Regular User",
      groups: [],
    };

    const ownedProject = {
      id: "proj-1",
      name: "My Project",
      userId: "user@example.com",
    };

    const otherProject = {
      id: "proj-2",
      name: "Other Project",
      userId: "someone-else@example.com",
    };

    it("returns project when user is owner", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockFindUnique.mockResolvedValue(ownedProject);

      const result = await getAuthorizedProject("proj-1");
      expect(result.project).toEqual(ownedProject);
      expect(result.user).toEqual(regularUser);
      expect(result.isAdmin).toBe(false);
    });

    it("returns project when user is admin even if not owner", async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockFindUnique.mockResolvedValue(otherProject);

      const result = await getAuthorizedProject("proj-2");
      expect(result.project).toEqual(otherProject);
      expect(result.user).toEqual(adminUser);
      expect(result.isAdmin).toBe(true);
    });

    it("calls notFound() when project does not exist", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockFindUnique.mockResolvedValue(null);

      await expect(getAuthorizedProject("nonexistent")).rejects.toThrow(
        "NEXT_NOT_FOUND"
      );
      expect(mockNotFound).toHaveBeenCalled();
    });

    it("calls notFound() when user is not owner and not admin", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockFindUnique.mockResolvedValue(otherProject);

      await expect(getAuthorizedProject("proj-2")).rejects.toThrow(
        "NEXT_NOT_FOUND"
      );
      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  describe("getAuthorizedProjects", () => {
    const adminUser = {
      sub: "admin-sub",
      email: "sean.mcinerney@merkle.com",
      name: "Sean McInerney",
      groups: [],
    };

    const regularUser = {
      sub: "user-sub",
      email: "user@example.com",
      name: "Regular User",
      groups: [],
    };

    const allProjects = [
      { id: "proj-1", name: "Project 1", userId: "user@example.com" },
      { id: "proj-2", name: "Project 2", userId: "someone@example.com" },
    ];

    const userProjects = [
      { id: "proj-1", name: "Project 1", userId: "user@example.com" },
    ];

    it("returns only admin's own projects when viewAll is false", async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockFindMany.mockResolvedValue([allProjects[0]]);

      const result = await getAuthorizedProjects(false);
      expect(result.user).toEqual(adminUser);
      expect(result.isAdmin).toBe(true);

      // Verify the where clause filters by admin's userId
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "sean.mcinerney@merkle.com" },
        })
      );
    });

    it("returns all projects when admin passes viewAll=true", async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockFindMany.mockResolvedValue(allProjects);

      const result = await getAuthorizedProjects(true);
      expect(result.projects).toEqual(allProjects);
      expect(result.user).toEqual(adminUser);
      expect(result.isAdmin).toBe(true);

      // Verify no where filter for admin with viewAll
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it("returns only user's projects for non-admin even when viewAll=true", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockFindMany.mockResolvedValue(userProjects);

      const result = await getAuthorizedProjects(true);
      expect(result.projects).toEqual(userProjects);
      expect(result.user).toEqual(regularUser);
      expect(result.isAdmin).toBe(false);

      // Verify the where clause still filters by userId
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user@example.com" },
        })
      );
    });

    it("defaults to user's own projects when no argument provided", async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockFindMany.mockResolvedValue([allProjects[0]]);

      const result = await getAuthorizedProjects();
      expect(result.isAdmin).toBe(true);

      // Verify default behavior filters by userId (same as viewAll=false)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "sean.mcinerney@merkle.com" },
        })
      );
    });

    it("returns { projects, user, isAdmin } shape", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockFindMany.mockResolvedValue(userProjects);

      const result = await getAuthorizedProjects();
      expect(result).toHaveProperty("projects");
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("isAdmin");
    });
  });
});
