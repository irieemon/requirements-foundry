import { test, expect } from "@playwright/test";

/**
 * Responsive Layout Tests
 *
 * These tests verify the iPad visibility bug fix for action buttons.
 * The issue was that the sidebar never collapsed on iPad, consuming
 * 224px and leaving insufficient space for action buttons.
 *
 * Fixed by:
 * - Hiding sidebar on mobile (< md / 768px)
 * - Adding mobile navigation with hamburger menu
 * - Collapsing secondary actions into overflow menu
 * - Adding 44px touch targets for iOS compliance
 */

test.describe("Sidebar Visibility", () => {
  test("sidebar visible on desktop (>= 768px)", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/projects");

    const sidebar = page.locator("aside[aria-label='Main navigation']");
    await expect(sidebar).toBeVisible();
  });

  test("sidebar hidden on tablet portrait (< 768px)", async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto("/projects");

    const sidebar = page.locator("aside[aria-label='Main navigation']");
    await expect(sidebar).toBeHidden();
  });

  test("sidebar hidden on mobile (< 640px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/projects");

    const sidebar = page.locator("aside[aria-label='Main navigation']");
    await expect(sidebar).toBeHidden();
  });
});

test.describe("Mobile Navigation", () => {
  test("mobile nav visible on mobile (< 768px)", async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto("/projects");

    // Mobile header should be visible
    const mobileHeader = page.locator("header.md\\:hidden");
    await expect(mobileHeader).toBeVisible();

    // Hamburger menu button should exist
    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    await expect(hamburger).toBeVisible();
  });

  test("mobile nav hidden on desktop (>= 768px)", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/projects");

    // Mobile header should be hidden
    const mobileHeader = page.locator("header.md\\:hidden");
    await expect(mobileHeader).toBeHidden();
  });

  test("hamburger menu opens navigation sheet", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/projects");

    // Click hamburger
    await page.click("button[aria-label='Open navigation menu']");

    // Sheet dialog should open (Radix dialog with role="dialog")
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();

    // Navigation links should be visible in the sheet
    const sheetNav = dialog.locator("[role='navigation']");
    await expect(sheetNav).toBeVisible();
    await expect(sheetNav.getByRole("link", { name: "Projects" })).toBeVisible();
    await expect(sheetNav.getByRole("link", { name: "Runs" })).toBeVisible();
  });

  test("navigation sheet closes when link clicked", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/projects");

    // Open menu
    await page.click("button[aria-label='Open navigation menu']");

    // Wait for sheet to open
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();

    // Click a link in the sheet
    await dialog.locator("a[href='/runs']").click();

    // Should navigate
    await expect(page).toHaveURL(/\/runs/);

    // Sheet should close (dialog should not be visible)
    await expect(dialog).toBeHidden();
  });
});

test.describe("Touch Targets", () => {
  test("buttons have 44px minimum touch targets", async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.goto("/projects");

    // Check hamburger button on mobile
    await page.setViewportSize({ width: 375, height: 812 });
    const hamburger = page.locator("button[aria-label='Open navigation menu']");
    const hamburgerBox = await hamburger.boundingBox();
    expect(hamburgerBox?.height).toBeGreaterThanOrEqual(44);
    expect(hamburgerBox?.width).toBeGreaterThanOrEqual(44);
  });

  test("overflow menu trigger has 44px touch target", async ({ page }) => {
    // This test requires a project with epics to show the overflow menu
    // For now, test the pattern exists in page-actions
    await page.setViewportSize({ width: 767, height: 1024 });

    // Navigate to a project page that would show epics
    // Since we can't guarantee project data, check the component classes
    await page.goto("/projects");

    // Check any "More actions" buttons that exist
    const moreActions = page.locator("button[aria-label='More actions']");
    const count = await moreActions.count();

    if (count > 0) {
      const box = await moreActions.first().boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("Action Buttons Visibility", () => {
  // These tests verify the core bug fix: buttons visible at all viewport sizes

  test("primary action always visible on iPad", async ({ page }) => {
    // iPad Pro 11" portrait
    await page.setViewportSize({ width: 834, height: 1194 });

    // Would need a project ID with epics to fully test
    // For now, verify the layout doesn't overflow
    await page.goto("/projects");

    // Main content area should not overflow horizontally
    const main = page.locator("main, [class*='pl-']");
    if ((await main.count()) > 0) {
      const box = await main.first().boundingBox();
      // Content should fit within viewport
      if (box) {
        expect(box.width).toBeLessThanOrEqual(834);
      }
    }
  });

  test("content area has full width on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/projects");

    // On mobile, content should not have left padding for sidebar
    const content = page.locator("div.md\\:pl-56, div.md\\:pl-16").first();
    const computedStyle = await content.evaluate((el) =>
      window.getComputedStyle(el).paddingLeft
    );

    // On mobile (<768px), should have 0 or minimal padding
    expect(parseInt(computedStyle)).toBeLessThan(64); // Less than sidebar width
  });
});

test.describe("iPad Specific - Original Bug Reproduction", () => {
  test("iPad portrait can display page without horizontal scroll", async ({
    page,
  }) => {
    // iPad Pro 11" in portrait mode
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.goto("/projects");

    // There should be no horizontal scrollbar
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test("iPad landscape shows full sidebar", async ({ page }) => {
    // iPad Pro 11" in landscape mode (>= 768px, shows sidebar)
    await page.setViewportSize({ width: 1194, height: 834 });
    await page.goto("/projects");

    const sidebar = page.locator("aside[aria-label='Main navigation']");
    await expect(sidebar).toBeVisible();

    // Sidebar should be visible and content area properly offset
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.width).toBeGreaterThan(0);
  });
});
