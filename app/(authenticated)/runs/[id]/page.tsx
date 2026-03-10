import { notFound } from "next/navigation";
import Link from "next/link";
import { getRun } from "@/server/actions/generation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDistanceToNow, format } from "date-fns";
import { Clock, Zap } from "lucide-react";

interface RunPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunPage({ params }: RunPageProps) {
  const { id } = await params;
  const run = await getRun(id);

  if (!run) {
    notFound();
  }

  const inputConfig = run.inputConfig ? JSON.parse(run.inputConfig) : null;
  const outputData = run.outputData ? JSON.parse(run.outputData) : null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "EXTRACT_CARDS":
        return "Extract Cards";
      case "GENERATE_EPICS":
        return "Generate Epics";
      case "GENERATE_STORIES":
        return "Generate Stories";
      case "EXPORT":
        return "Export";
      default:
        return type;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusVariant = (status: string): "success" | "destructive" | "info" | "warning" | "muted" => {
    switch (status) {
      case "SUCCEEDED": return "success";
      case "FAILED": return "destructive";
      case "RUNNING": return "info";
      case "CANCELLED": return "warning";
      default: return "muted";
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "SUCCEEDED": return "Complete";
      case "FAILED": return "Failed";
      case "RUNNING": return "Running";
      case "CANCELLED": return "Cancelled";
      case "QUEUED": return "Queued";
      default: return status;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title={getTypeLabel(run.type)}
        description={`Project: ${run.project.name}`}
        backHref={`/projects/${run.projectId}`}
        backLabel="Back to project"
        actions={
          <StatusPill variant={getStatusVariant(run.status)} pulse={run.status === "RUNNING"}>
            {getStatusLabel(run.status)}
          </StatusPill>
        }
      />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Logs */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Execution Logs</CardTitle>
                  <CardDescription>Detailed log output from the generation run.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="min-h-[200px] max-h-[400px] w-full rounded-lg border border-border/50 bg-muted/30 p-4">
                    <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                      {run.logs || "No logs available."}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Error */}
              {run.errorMsg && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="text-base text-destructive">Error</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm text-destructive whitespace-pre-wrap">{run.errorMsg}</pre>
                  </CardContent>
                </Card>
              )}

              {/* Input Config */}
              {inputConfig && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Input Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs font-mono text-muted-foreground bg-muted/30 rounded-lg p-4 overflow-auto border border-border/50">
                      {JSON.stringify(inputConfig, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Output Data */}
              {outputData && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Output Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs font-mono text-muted-foreground bg-muted/30 rounded-lg p-4 overflow-auto border border-border/50">
                      {JSON.stringify(outputData, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Run Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Started
                    </span>
                    <span className="text-sm font-medium">
                      {run.startedAt
                        ? format(run.startedAt, "MMM d, HH:mm:ss")
                        : "-"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Completed
                    </span>
                    <span className="text-sm font-medium">
                      {run.completedAt
                        ? format(run.completedAt, "MMM d, HH:mm:ss")
                        : "-"}
                    </span>
                  </div>

                  <div className="border-t border-border/50 pt-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Duration</span>
                    <Badge variant="outline">{formatDuration(run.durationMs)}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Tokens Used
                    </span>
                    <span className="text-sm font-medium">
                      {run.tokensUsed ? run.tokensUsed.toLocaleString() : "0"}
                    </span>
                  </div>

                  <div className="border-t border-border/50 pt-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Created</span>
                    <span className="text-sm">
                      {formatDistanceToNow(run.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
