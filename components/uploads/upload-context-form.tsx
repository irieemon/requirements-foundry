"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronRight, FolderOpen, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  uploadContextSchema,
  type UploadContextFormData,
  PROJECT_TYPES,
  DOCUMENT_TYPES,
  CONFIDENTIALITY_LEVELS,
  PROJECT_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  CONFIDENTIALITY_LABELS,
} from "@/lib/uploads/context-schema";

// ============================================
// Types
// ============================================

interface UploadContextFormProps {
  onSubmit: (data: UploadContextFormData) => void;
  onSkip?: () => void;
  defaultValues?: Partial<UploadContextFormData>;
}

// ============================================
// Section Component
// ============================================

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, icon, children, defaultOpen = false }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border p-3 text-left transition-colors",
            "hover:bg-muted/50",
            isOpen && "bg-muted/30"
          )}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-medium">{title}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {isOpen ? "Click to collapse" : "Click to expand"}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pt-3 pb-1">
        <div className="space-y-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// Main Component
// ============================================

export function UploadContextForm({
  onSubmit,
  onSkip,
  defaultValues,
}: UploadContextFormProps) {
  const form = useForm<UploadContextFormData>({
    resolver: zodResolver(uploadContextSchema),
    defaultValues: {
      projectType: undefined,
      businessDomain: "",
      targetAudience: "",
      documentType: undefined,
      confidentiality: undefined,
      sourceSystem: "",
      notes: "",
      keyTerms: "",
      ...defaultValues,
    },
  });

  const handleSubmit = (data: UploadContextFormData) => {
    // Filter out empty strings
    const cleanedData: UploadContextFormData = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== "") {
        (cleanedData as Record<string, unknown>)[key] = value;
      }
    }
    onSubmit(cleanedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Add Context (Optional)</h3>
          <p className="text-xs text-muted-foreground">
            Help the AI understand your documents better by providing context.
            All fields are optional.
          </p>
        </div>

        {/* Project Basics Section */}
        <Section
          title="Project Basics"
          icon={<FolderOpen className="h-4 w-4" />}
        >
          <FormField
            control={form.control}
            name="projectType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select project type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROJECT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {PROJECT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="businessDomain"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Domain</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Healthcare, Finance, Retail"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="targetAudience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Audience</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the end users or stakeholders..."
                    className="resize-none"
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* Document Classification Section */}
        <Section
          title="Document Classification"
          icon={<FileText className="h-4 w-4" />}
        >
          <FormField
            control={form.control}
            name="documentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Document Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {DOCUMENT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confidentiality"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confidentiality</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select confidentiality level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CONFIDENTIALITY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {CONFIDENTIALITY_LABELS[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sourceSystem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source System</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Confluence, SharePoint, Email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* Additional Context Section */}
        <Section
          title="Additional Context"
          icon={<MessageSquare className="h-4 w-4" />}
        >
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any additional context that might help the AI understand these documents..."
                    className="resize-none"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Background information, constraints, or special considerations
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="keyTerms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Key Terms</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., HIPAA, PCI, SSO, API Gateway"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Comma-separated domain terms the AI should recognize
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          {onSkip && (
            <Button type="button" variant="ghost" onClick={onSkip}>
              Skip (Upload Only)
            </Button>
          )}
          <Button type="submit">Continue with Upload</Button>
        </div>
      </form>
    </Form>
  );
}
