import { cn } from "@/lib/utils";

interface TableToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function TableToolbar({ children, className }: TableToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 pb-4",
        className
      )}
    >
      {children}
    </div>
  );
}

interface TableToolbarLeftProps {
  children: React.ReactNode;
  className?: string;
}

export function TableToolbarLeft({ children, className }: TableToolbarLeftProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>{children}</div>
  );
}

interface TableToolbarRightProps {
  children: React.ReactNode;
  className?: string;
}

export function TableToolbarRight({ children, className }: TableToolbarRightProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>{children}</div>
  );
}

interface TableContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function TableContainer({ children, className }: TableContainerProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
