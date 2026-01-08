"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ExportStepper } from "./export-stepper";
import { ScopeSelector } from "./scope-selector";
import { FormatConfig } from "./format-config";
import { ValidateDownload } from "./validate-download";
import { previewExport } from "@/server/actions/jira-export";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import type {
  ExportScope,
  ExportConfig,
  JiraPreset,
  ContentLevel,
  ValidationResult,
  ExportStats,
} from "@/lib/export/jira/client";

const STEPS = ["Scope", "Format", "Validate & Download"];

interface ExportWizardProps {
  projectId: string;
  projectName: string;
  initialEpicCount: number;
}

export function ExportWizard({
  projectId,
  projectName,
  initialEpicCount,
}: ExportWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Scope state
  const [scope, setScope] = useState<ExportScope>({ mode: "all" });

  // Format config state
  const [formatConfig, setFormatConfig] = useState<{
    preset: JiraPreset;
    contentLevel: ContentLevel;
    includeSubtasks: boolean;
  }>({
    preset: "cloud-company",
    contentLevel: "full",
    includeSubtasks: true,
  });

  // Validation state (loaded when entering step 3)
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  });
  const [stats, setStats] = useState<ExportStats>({
    epicCount: initialEpicCount,
    storyCount: 0,
    subtaskCount: 0,
    totalRows: 0,
    estimatedImportTime: "< 1 minute",
  });

  // Load validation when entering step 3
  useEffect(() => {
    if (currentStep === 3) {
      loadValidation();
    }
  }, [currentStep]);

  const loadValidation = async () => {
    setLoading(true);
    try {
      const config: ExportConfig = {
        scope,
        preset: formatConfig.preset,
        contentLevel: formatConfig.contentLevel,
        includeSubtasks: formatConfig.includeSubtasks,
      };
      const preview = await previewExport(projectId, config);
      setValidation(preview.validation);
      setStats(preview.stats);
    } catch (error) {
      console.error("Failed to load validation:", error);
      setValidation({
        isValid: false,
        errors: [{ code: "EVAL001", message: "Failed to validate export" }],
        warnings: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        // Need at least one epic selected
        if (scope.mode === "selected") {
          return (scope.epicIds?.length || 0) > 0;
        }
        if (scope.mode === "by-run") {
          return !!scope.runId;
        }
        return true; // "all" mode always valid
      case 2:
        return true; // Format options always valid
      case 3:
        return validation.isValid;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Combine config for step 3
  const fullConfig: ExportConfig = {
    scope,
    preset: formatConfig.preset,
    contentLevel: formatConfig.contentLevel,
    includeSubtasks: formatConfig.includeSubtasks,
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <ExportStepper currentStep={currentStep} steps={STEPS} />

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 1 && (
          <ScopeSelector
            projectId={projectId}
            scope={scope}
            onScopeChange={setScope}
          />
        )}

        {currentStep === 2 && (
          <FormatConfig
            projectId={projectId}
            scope={scope}
            config={formatConfig}
            onConfigChange={setFormatConfig}
            subtaskCount={stats.subtaskCount}
          />
        )}

        {currentStep === 3 && (
          loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Validating export...</p>
            </div>
          ) : (
            <ValidateDownload
              projectId={projectId}
              projectName={projectName}
              config={fullConfig}
              validation={validation}
              stats={stats}
            />
          )
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back
        </Button>

        {currentStep < STEPS.length && (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
