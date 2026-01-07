"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";

interface Story {
  id: string;
  code: string;
  title: string;
  userStory: string;
  persona: string | null;
  acceptanceCriteria: string | null;
  technicalNotes: string | null;
  priority: string | null;
  effort: string | null;
}

interface StoryTableProps {
  stories: Story[];
}

export function StoryTable({ stories }: StoryTableProps) {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getPriorityBadge = (priority: string | null) => {
    const colors: Record<string, string> = {
      must: "bg-red-500/10 text-red-700 border-red-200",
      should: "bg-orange-500/10 text-orange-700 border-orange-200",
      could: "bg-blue-500/10 text-blue-700 border-blue-200",
      "won't": "bg-gray-500/10 text-gray-700 border-gray-200",
    };
    const color = colors[priority?.toLowerCase() || ""] || "";
    return priority ? (
      <Badge variant="outline" className={color}>
        {priority}
      </Badge>
    ) : null;
  };

  const parseAcceptanceCriteria = (ac: string | null): string[] => {
    if (!ac) return [];
    try {
      return JSON.parse(ac);
    } catch {
      return [ac];
    }
  };

  if (stories.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No stories yet"
        description="Use the form above to generate user stories for this epic."
        compact
      />
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]"></TableHead>
            <TableHead className="w-[60px]">Code</TableHead>
            <TableHead>Story</TableHead>
            <TableHead>Persona</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Effort</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stories.map((story) => {
            const isExpanded = expandedRows.has(story.id);
            const criteria = parseAcceptanceCriteria(story.acceptanceCriteria);

            return (
              <Fragment key={story.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleRow(story.id)}
                >
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{story.code}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{story.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{story.userStory}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {story.persona && (
                      <Badge variant="secondary" className="text-xs">
                        {story.persona}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{getPriorityBadge(story.priority)}</TableCell>
                  <TableCell>
                    {story.effort && (
                      <Badge variant="outline" className="text-xs">
                        {story.effort}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/30 p-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">User Story</p>
                          <p className="text-sm text-muted-foreground">{story.userStory}</p>
                        </div>
                        {criteria.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1">Acceptance Criteria</p>
                            <ul className="list-disc list-inside space-y-1">
                              {criteria.map((c, i) => (
                                <li key={i} className="text-sm text-muted-foreground">
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {story.technicalNotes && (
                          <div>
                            <p className="text-sm font-medium mb-1">Technical Notes</p>
                            <p className="text-sm text-muted-foreground">{story.technicalNotes}</p>
                          </div>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setSelectedStory(story)}>
                          View Full Details
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!selectedStory} onOpenChange={() => setSelectedStory(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedStory && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="outline">{selectedStory.code}</Badge>
                  {selectedStory.title}
                </DialogTitle>
                <DialogDescription>{selectedStory.userStory}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="flex flex-wrap gap-2">
                  {selectedStory.persona && (
                    <Badge variant="secondary">{selectedStory.persona}</Badge>
                  )}
                  {getPriorityBadge(selectedStory.priority)}
                  {selectedStory.effort && (
                    <Badge variant="outline">Effort: {selectedStory.effort}</Badge>
                  )}
                </div>

                {parseAcceptanceCriteria(selectedStory.acceptanceCriteria).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Acceptance Criteria</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {parseAcceptanceCriteria(selectedStory.acceptanceCriteria).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedStory.technicalNotes && (
                  <div>
                    <h4 className="font-medium mb-2">Technical Notes</h4>
                    <p className="text-sm text-muted-foreground">{selectedStory.technicalNotes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
