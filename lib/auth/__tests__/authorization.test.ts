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
const mockUserFindUnique = vi.fn();
const mockRunFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    run: {
      findUnique: (...args: unknown[]) => mockRunFindUnique(...args),
    },
  },
}));

import {
  ADMIN_EMAIL,
  isAdmin,
  resolveRole,
  getAuthorizedProject,
  getAuthorizedProjects,
  getAuthorizedRun,
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

  describe("resolveRole", () => {
    it("returns 'admin' when isAdmin is true", () => {
      expect(resolveRole({ isAdmin: true, isOwner: false, shareRole: undefined })).toBe("admin");
    });

    it("returns 'owner' when isOwner is true (owner beats editor share)", () => {
      expect(resolveRole({ isAdmin: false, isOwner: true, shareRole: "editor" })).toBe("owner");
    });

    it("returns 'editor' for editor share role", () => {
      expect(resolveRole({ isAdmin: false, isOwner: false, shareRole: "editor" })).toBe("editor");
    });

    it("returns 'viewer' for viewer share role", () => {
      expect(resolveRole({ isAdmin: false, isOwner: false, shareRole: "viewer" })).toBe("viewer");
    });

    it("returns null when no access", () => {
      expect(resolveRole({ isAdmin: false, isOwner: false, shareRole: undefined })).toBeNull();
    });

    it("returns 'admin' even when also owner and has share", () => {
      expect(resolveRole({ isAdmin: true, isOwner: true, shareRole: "editor" })).toBe("admin");
    });

    it("returns 'owner' when owner with viewer share (owner beats viewer)", () => {
      expect(resolveRole({ isAdmin: false, isOwner: true, shareRole: "viewer" })).toBe("owner");
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

    it("returns project with role 'owner' when user is owner", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue({ id: "user-cuid" });
      mockFindUnique.mockResolvedValue({ ...ownedProject, shares: [] });

      const result = await getAuthorizedProject("proj-1");
      expect(result.project.id).toBe("proj-1");
      expect(result.user).toEqual(regularUser);
      expect(result.role).toBe("owner");
      expect(result.canEdit).toBe(true);
      expect(result.isAdmin).toBe(false);
    });

    it("returns project with role 'admin' when user is admin even if not owner", async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockUserFindUnique.mockResolvedValue({ id: "admin-cuid" });
      mockFindUnique.mockResolvedValue({ ...otherProject, shares: [] });

      const result = await getAuthorizedProject("proj-2");
      expect(result.project.id).toBe("proj-2");
      expect(result.user).toEqual(adminUser);
      expect(result.role).toBe("admin");
      expect(result.canEdit).toBe(true);
      expect(result.isAdmin).toBe(true);
    });

    it("returns project with role 'editor' for user with editor share", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue({ id: "user-cuid" });
      mockFindUnique.mockResolvedValue({ ...otherProject, shares: [{ role: "editor" }] });

      const result = await getAuthorizedProject("proj-2");
      expect(result.project.id).toBe("proj-2");
      expect(result.role).toBe("editor");
      expect(result.canEdit).toBe(true);
      expect(result.isAdmin).toBe(false);
    });

    it("returns project with role 'viewer' for user with viewer share", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue({ id: "user-cuid" });
      mockFindUnique.mockResolvedValue({ ...otherProject, shares: [{ role: "viewer" }] });

      const result = await getAuthorizedProject("proj-2");
      expect(result.project.id).toBe("proj-2");
      expect(result.role).toBe("viewer");
      expect(result.canEdit).toBe(false);
      expect(result.isAdmin).toBe(false);
    });

    it("calls notFound() when project does not exist", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue({ id: "user-cuid" });
      mockFindUnique.mockResolvedValue(null);

      await expect(getAuthorizedProject("nonexistent")).rejects.toThrow(
        "NEXT_NOT_FOUND"
      );
      expect(mockNotFound).toHaveBeenCalled();
    });

    it("calls notFound() when user has no access (not owner, no share, not admin)", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue({ id: "user-cuid" });
      mockFindUnique.mockResolvedValue({ ...otherProject, shares: [] });

      await expect(getAuthorizedProject("proj-2")).rejects.toThrow(
        "NEXT_NOT_FOUND"
      );
      expect(mockNotFound).toHaveBeenCalled();
    });

    it("works when db.user.findUnique returns null (user has no User record) - owner still works", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue(null);
      // No shares included when dbUser is null
      mockFindUnique.mockResolvedValue(ownedProject);

      const result = await getAuthorizedProject("proj-1");
      expect(result.project.id).toBe("proj-1");
      expect(result.role).toBe("owner");
      expect(result.canEdit).toBe(true);
    });

    it("works when db.user.findUnique returns null (user has no User record) - admin still works", async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockUserFindUnique.mockResolvedValue(null);
      mockFindUnique.mockResolvedValue(otherProject);

      const result = await getAuthorizedProject("proj-2");
      expect(result.role).toBe("admin");
      expect(result.isAdmin).toBe(true);
    });

    it("calls notFound() when no User record and not owner and not admin", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue(null);
      mockFindUnique.mockResolvedValue(otherProject);

      await expect(getAuthorizedProject("proj-2")).rejects.toThrow(
        "NEXT_NOT_FOUND"
      );
      expect(mockNotFound).toHaveBeenCalled();
    });

    it("does not leak shares in the returned project object", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue({ id: "user-cuid" });
      mockFindUnique.mockResolvedValue({ ...ownedProject, shares: [{ role: "editor" }] });

      const result = await getAuthorizedProject("proj-1");
      expect(result.project).not.toHaveProperty("shares");
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

    it("returns all projects with role 'admin' when admin passes viewAll=true", async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockFindMany.mockResolvedValue(allProjects);

      const result = await getAuthorizedProjects(true);
      expect(result.projects).toHaveLength(2);
      expect(result.projects[0]).toHaveProperty("role", "admin");
      expect(result.projects[1]).toHaveProperty("role", "admin");
      expect(result.isAdmin).toBe(true);
    });

    it("returns admin's owned projects with role 'admin' when viewAll is false", async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockUserFindUnique.mockResolvedValue({ id: "admin-cuid" });
      // First call: owned projects, second call: shared projects
      mockFindMany
        .mockResolvedValueOnce([allProjects[0]])
        .mockResolvedValueOnce([]);

      const result = await getAuthorizedProjects(false);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0]).toHaveProperty("role", "admin");
      expect(result.isAdmin).toBe(true);
    });

    it("returns owned projects with role 'owner' plus shared projects with their share roles", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue({ id: "user-cuid" });

      const ownedProjects = [
        { id: "proj-1", name: "Project 1", userId: "user@example.com" },
      ];
      const sharedProjects = [
        {
          id: "proj-2",
          name: "Project 2",
          userId: "someone@example.com",
          shares: [{ role: "editor" }],
        },
      ];

      mockFindMany
        .mockResolvedValueOnce(ownedProjects)
        .mockResolvedValueOnce(sharedProjects);

      const result = await getAuthorizedProjects();
      expect(result.projects).toHaveLength(2);
      expect(result.projects[0]).toHaveProperty("role", "owner");
      expect(result.projects[1]).toHaveProperty("role", "editor");
      expect(result.isAdmin).toBe(false);
    });

    it("returns only owned projects when user has no User record", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue(null);

      const ownedProjects = [
        { id: "proj-1", name: "Project 1", userId: "user@example.com" },
      ];

      // Only one findMany call for owned; shared query returns [] because no dbUser
      mockFindMany.mockResolvedValueOnce(ownedProjects);

      const result = await getAuthorizedProjects();
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0]).toHaveProperty("role", "owner");
    });

    it("returns { projects, user, isAdmin } shape", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue(null);
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getAuthorizedProjects();
      expect(result).toHaveProperty("projects");
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("isAdmin");
    });

    it("returns non-admin user's owned projects only when viewAll=true (non-admin ignores viewAll)", async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue({ id: "user-cuid" });

      const ownedProjects = [
        { id: "proj-1", name: "Project 1", userId: "user@example.com" },
      ];
      mockFindMany
        .mockResolvedValueOnce(ownedProjects)
        .mockResolvedValueOnce([]);

      const result = await getAuthorizedProjects(true);
      expect(result.projects).toHaveLength(1);
      expect(result.isAdmin).toBe(false);
    });
  });

  describe("getAuthorizedRun", () => {
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

    it("returns run with auth result when user owns parent project", async () => {
      const run = {
        id: "run-1",
        projectId: "proj-1",
        project: ownedProject,
        type: "ANALYZE_CARDS",
        status: "SUCCEEDED",
      };

      mockRunFindUnique.mockResolvedValue(run);
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue({ id: "user-cuid" });
      mockFindUnique.mockResolvedValue({ ...ownedProject, shares: [] });

      const result = await getAuthorizedRun("run-1");
      expect(result.entity).toEqual(run);
      expect(result.role).toBe("owner");
      expect(result.canEdit).toBe(true);
      expect(result.project.id).toBe("proj-1");
    });

    it("calls notFound() when run does not exist", async () => {
      mockRunFindUnique.mockResolvedValue(null);

      await expect(getAuthorizedRun("nonexistent")).rejects.toThrow(
        "NEXT_NOT_FOUND"
      );
      expect(mockNotFound).toHaveBeenCalled();
    });

    it("calls notFound() when user has no access to parent project", async () => {
      const otherProject = {
        id: "proj-2",
        name: "Other Project",
        userId: "someone-else@example.com",
      };

      const run = {
        id: "run-2",
        projectId: "proj-2",
        project: otherProject,
        type: "ANALYZE_CARDS",
        status: "SUCCEEDED",
      };

      mockRunFindUnique.mockResolvedValue(run);
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockUserFindUnique.mockResolvedValue({ id: "user-cuid" });
      mockFindUnique.mockResolvedValue({ ...otherProject, shares: [] });

      await expect(getAuthorizedRun("run-2")).rejects.toThrow(
        "NEXT_NOT_FOUND"
      );
      expect(mockNotFound).toHaveBeenCalled();
    });
  });
});
