"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function AdminViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isViewAll = searchParams.get("view") === "all";

  function handleToggle(viewAll: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (viewAll) {
      params.set("view", "all");
    } else {
      params.delete("view");
    }
    const qs = params.toString();
    router.push(qs ? `/projects?${qs}` : "/projects");
  }

  return (
    <div
      className="inline-flex rounded-lg border bg-muted p-0.5"
      role="group"
      aria-label="Project view toggle"
    >
      <button
        type="button"
        onClick={() => handleToggle(false)}
        className={cn(
          "rounded-md px-3 py-1 text-sm font-medium transition-colors",
          !isViewAll
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={!isViewAll}
      >
        My
      </button>
      <button
        type="button"
        onClick={() => handleToggle(true)}
        className={cn(
          "rounded-md px-3 py-1 text-sm font-medium transition-colors",
          isViewAll
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={isViewAll}
      >
        All
      </button>
    </div>
  );
}
