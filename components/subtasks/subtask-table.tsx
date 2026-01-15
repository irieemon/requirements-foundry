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
import { EmptyState } from "@/components/layout/empty-state";
import { ChevronDown, ChevronRight, ListTodo } from "lucide-react";

interface Subtask {
  id: string;
  code: string;
  title: string;
  description: string | null;
  effort: string | null;
}

interface SubtaskTableProps {
  subtasks: Subtask[];
}

export function SubtaskTable({ subtasks }: SubtaskTableProps) {
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

  if (subtasks.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No subtasks yet"
        description="Generate subtasks from stories using the epics page."
        compact
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[30px]"></TableHead>
          <TableHead className="w-[80px]">Code</TableHead>
          <TableHead>Task</TableHead>
          <TableHead className="w-[80px]">Effort</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subtasks.map((subtask) => {
          const isExpanded = expandedRows.has(subtask.id);

          return (
            <Fragment key={subtask.id}>
              <TableRow
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleRow(subtask.id)}
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
                  <Badge variant="outline">{subtask.code}</Badge>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{subtask.title}</p>
                </TableCell>
                <TableCell>
                  {subtask.effort && (
                    <Badge variant="outline" className="text-xs">
                      {subtask.effort}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
              {isExpanded && subtask.description && (
                <TableRow>
                  <TableCell colSpan={4} className="bg-muted/30 p-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Description</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {subtask.description}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
