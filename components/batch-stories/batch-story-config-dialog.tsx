"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  Check,
  AlertTriangle,
  Zap,
  Shield,
  Gauge,
  FileText,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  startGenerateAllStories,
  getEpicsForBatchGeneration,
  type EpicForBatch,
} from "@/server/actions/batch-stories";
import {
  GenerationMode,
  PersonaSet,
  ExistingStoriesBehavior,
  ProcessingPacing,
  GENERATION_MODE_CONFIG,
  PERSONA_SETS,
  PACING_CONFIG,
} from "@/lib/types";

// ============================================
// Types
// ============================================

interface BatchStoryConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  epicCount: number;
  onRunStarted?: (runId: string) => void;
}

type WizardStep = 1 | 2 | 3;
const STEPS = ["Scope", "Settings", "Confirm"];

// ============================================
// Stepper Component
// ============================================

function WizardStepper({ currentStep }: { currentStep: WizardStep }) {
  return (
    <nav aria-label="Configuration progress" className="mb-6">
      <ol className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const stepNumber = (index + 1) as WizardStep;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <li key={step} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    isCompleted && "bg-primary text-primary-foreground",
                    isActive && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium hidden sm:inline",
                    isActive && "text-foreground",
                    !isActive && "text-muted-foreground"
                  )}
                >
                  {step}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-3 h-0.5 w-8 sm:w-12",
                    stepNumber < currentStep ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ============================================
// Step 1: Scope Selection
// ============================================

interface ScopeStepProps {
  epics: EpicForBatch[];
  selectedEpicIds: string[];
  onSelectedChange: (ids: string[]) => void;
  existingBehavior: ExistingStoriesBehavior;
  onBehaviorChange: (behavior: ExistingStoriesBehavior) => void;
  isLoading: boolean;
}

function ScopeStep({
  epics,
  selectedEpicIds,
  onSelectedChange,
  existingBehavior,
  onBehaviorChange,
  isLoading,
}: ScopeStepProps) {
  const allSelected = selectedEpicIds.length === epics.length;
  const someSelected = selectedEpicIds.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      onSelectedChange([]);
    } else {
      onSelectedChange(epics.map((e) => e.id));
    }
  };

  const toggleEpic = (id: string) => {
    if (selectedEpicIds.includes(id)) {
      onSelectedChange(selectedEpicIds.filter((i) => i !== id));
    } else {
      onSelectedChange([...selectedEpicIds, id]);
    }
  };

  const epicsWithStories = epics.filter((e) => e.storyCount > 0).length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading epics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Epic Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Select Epics</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAll}
            className="text-xs"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
        </div>
        <ScrollArea className="h-[200px] border rounded-lg">
          <div className="p-3 space-y-2">
            {epics.map((epic) => (
              <label
                key={epic.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors overflow-hidden",
                  "hover:bg-muted/50",
                  selectedEpicIds.includes(epic.id) && "bg-primary/5"
                )}
              >
                <Checkbox
                  checked={selectedEpicIds.includes(epic.id)}
                  onCheckedChange={() => toggleEpic(epic.id)}
                  className="shrink-0"
                />
                <span className="flex-1 min-w-0 text-sm font-medium truncate">
                  {epic.code}: {epic.title}
                </span>
                {epic.storyCount > 0 && (
                  <Badge variant="secondary" className="shrink-0">
                    {epic.storyCount} stories
                  </Badge>
                )}
              </label>
            ))}
          </div>
        </ScrollArea>
        <p className="text-xs text-muted-foreground">
          {selectedEpicIds.length} of {epics.length} epics selected
        </p>
      </div>

      {/* Existing Stories Behavior */}
      {epicsWithStories > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
            <Label className="text-base font-medium">
              {epicsWithStories} epic(s) already have stories
            </Label>
          </div>
          <RadioGroup
            value={existingBehavior}
            onValueChange={(v) => onBehaviorChange(v as ExistingStoriesBehavior)}
            className="grid gap-3"
          >
            <label
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                "hover:bg-muted/50",
                existingBehavior === ExistingStoriesBehavior.SKIP && "border-primary bg-primary/5"
              )}
            >
              <RadioGroupItem value={ExistingStoriesBehavior.SKIP} />
              <div>
                <p className="font-medium text-sm">Skip existing</p>
                <p className="text-xs text-muted-foreground">
                  Don&apos;t regenerate stories for epics that already have them
                </p>
              </div>
            </label>
            <label
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                "hover:bg-muted/50",
                existingBehavior === ExistingStoriesBehavior.REPLACE && "border-primary bg-primary/5"
              )}
            >
              <RadioGroupItem value={ExistingStoriesBehavior.REPLACE} />
              <div>
                <p className="font-medium text-sm">Replace existing</p>
                <p className="text-xs text-muted-foreground">
                  Delete existing stories and regenerate fresh ones
                </p>
              </div>
            </label>
          </RadioGroup>
        </div>
      )}
    </div>
  );
}

// ============================================
// Step 2: Settings
// ============================================

interface SettingsStepProps {
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  personaSet: PersonaSet;
  onPersonaSetChange: (set: PersonaSet) => void;
  pacing: ProcessingPacing;
  onPacingChange: (pacing: ProcessingPacing) => void;
}

function SettingsStep({
  mode,
  onModeChange,
  personaSet,
  onPersonaSetChange,
  pacing,
  onPacingChange,
}: SettingsStepProps) {
  const modeConfig = GENERATION_MODE_CONFIG[mode];
  const personas = PERSONA_SETS[personaSet];
  const pacingConfig = PACING_CONFIG[pacing];

  return (
    <div className="space-y-6">
      {/* Generation Mode */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Generation Mode</Label>
        <Select value={mode} onValueChange={(v) => onModeChange(v as GenerationMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" aria-hidden="true" />
                <span>Compact (5-8 stories/epic)</span>
              </div>
            </SelectItem>
            <SelectItem value="standard">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4" aria-hidden="true" />
                <span>Standard (8-12 stories/epic)</span>
              </div>
            </SelectItem>
            <SelectItem value="detailed">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Detailed (12-15 stories/epic)</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{modeConfig.focus}</p>
      </div>

      {/* Persona Set */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Persona Set</Label>
        <Select value={personaSet} onValueChange={(v) => onPersonaSetChange(v as PersonaSet)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lightweight">Lightweight (3 personas)</SelectItem>
            <SelectItem value="core">Core (5 personas)</SelectItem>
            <SelectItem value="full">Full (9 personas)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{personas.join(", ")}</p>
      </div>

      {/* Pacing */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Processing Pacing</Label>
        <RadioGroup
          value={pacing}
          onValueChange={(v) => onPacingChange(v as ProcessingPacing)}
          className="grid gap-3 sm:grid-cols-3"
        >
          <label
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer transition-colors",
              "hover:bg-muted/50",
              pacing === "safe" && "border-primary bg-primary/5"
            )}
          >
            <RadioGroupItem value="safe" className="sr-only" />
            <Shield className={cn("h-5 w-5", pacing === "safe" && "text-primary")} aria-hidden="true" />
            <div className="text-center">
              <p className="font-medium text-sm">Safe</p>
              <p className="text-xs text-muted-foreground">
                {pacingConfig.delayBetweenEpicsMs / 1000}s delay
              </p>
            </div>
          </label>
          <label
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer transition-colors",
              "hover:bg-muted/50",
              pacing === "normal" && "border-primary bg-primary/5"
            )}
          >
            <RadioGroupItem value="normal" className="sr-only" />
            <Gauge className={cn("h-5 w-5", pacing === "normal" && "text-primary")} aria-hidden="true" />
            <div className="text-center">
              <p className="font-medium text-sm">Normal</p>
              <p className="text-xs text-muted-foreground">
                {PACING_CONFIG.normal.delayBetweenEpicsMs / 1000}s delay
              </p>
            </div>
          </label>
          <label
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer transition-colors",
              "hover:bg-muted/50",
              pacing === "fast" && "border-primary bg-primary/5"
            )}
          >
            <RadioGroupItem value="fast" className="sr-only" />
            <Zap className={cn("h-5 w-5", pacing === "fast" && "text-primary")} aria-hidden="true" />
            <div className="text-center">
              <p className="font-medium text-sm">Fast</p>
              <p className="text-xs text-muted-foreground">
                {PACING_CONFIG.fast.delayBetweenEpicsMs / 1000}s delay
              </p>
            </div>
          </label>
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          Slower pacing is recommended for larger batches to avoid rate limits.
        </p>
      </div>
    </div>
  );
}

// ============================================
// Step 3: Confirm
// ============================================

interface ConfirmStepProps {
  selectedEpicCount: number;
  mode: GenerationMode;
  personaSet: PersonaSet;
  existingBehavior: ExistingStoriesBehavior;
  pacing: ProcessingPacing;
  epicsWithStories: number;
}

function ConfirmStep({
  selectedEpicCount,
  mode,
  personaSet,
  existingBehavior,
  pacing,
  epicsWithStories,
}: ConfirmStepProps) {
  const modeConfig = GENERATION_MODE_CONFIG[mode];
  const estimatedStories = selectedEpicCount * ((modeConfig.storyCount.min + modeConfig.storyCount.max) / 2);
  const pacingConfig = PACING_CONFIG[pacing];
  const estimatedTimeMinutes = Math.ceil(
    (selectedEpicCount * (pacingConfig.delayBetweenEpicsMs + 5000)) / 60000
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-muted/30 p-4 space-y-4">
        <h4 className="font-medium text-sm">Summary</h4>

        <div className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Epics to process</span>
            <span className="font-medium">{selectedEpicCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Generation mode</span>
            <span className="font-medium capitalize">{mode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Persona set</span>
            <span className="font-medium capitalize">{personaSet}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Processing speed</span>
            <span className="font-medium capitalize">{pacing}</span>
          </div>
          {epicsWithStories > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Existing stories</span>
              <span className="font-medium">
                {existingBehavior === ExistingStoriesBehavior.SKIP ? "Skip" : "Replace"}
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-border/50 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated stories</span>
            <span className="font-medium text-primary">~{Math.round(estimatedStories)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated time</span>
            <span className="font-medium">~{estimatedTimeMinutes} min</span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium">Ready to generate</p>
          <p className="text-muted-foreground">
            Stories will be generated sequentially. You can cancel at any time.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Dialog Component
// ============================================

export function BatchStoryConfigDialog({
  open,
  onOpenChange,
  projectId,
  epicCount,
  onRunStarted,
}: BatchStoryConfigDialogProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Data
  const [epics, setEpics] = useState<EpicForBatch[]>([]);

  // Config state
  const [selectedEpicIds, setSelectedEpicIds] = useState<string[]>([]);
  const [existingBehavior, setExistingBehavior] = useState<ExistingStoriesBehavior>(
    ExistingStoriesBehavior.SKIP
  );
  const [mode, setMode] = useState<GenerationMode>("standard");
  const [personaSet, setPersonaSet] = useState<PersonaSet>("core");
  const [pacing, setPacing] = useState<ProcessingPacing>("safe");

  // Load epics when dialog opens
  useEffect(() => {
    if (open && epics.length === 0) {
      loadEpics();
    }
  }, [open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setSelectedEpicIds([]);
      setExistingBehavior(ExistingStoriesBehavior.SKIP);
      setMode("standard");
      setPersonaSet("core");
      setPacing("safe");
    }
  }, [open]);

  const loadEpics = async () => {
    setIsLoading(true);
    try {
      const data = await getEpicsForBatchGeneration(projectId);
      setEpics(data);
      // Select all by default
      setSelectedEpicIds(data.map((e) => e.id));
    } catch (error) {
      console.error("Failed to load epics:", error);
      toast.error("Failed to load epics");
    } finally {
      setIsLoading(false);
    }
  };

  const epicsWithStories = epics.filter((e) => e.storyCount > 0).length;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedEpicIds.length > 0;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as WizardStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
    }
  };

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const result = await startGenerateAllStories({
        projectId,
        options: {
          mode,
          personaSet,
          existingStoriesBehavior: existingBehavior,
          epicIds: selectedEpicIds.length === epics.length ? undefined : selectedEpicIds,
          pacing,
        },
      });

      if (result.success && result.runId) {
        toast.success(`Started generating stories for ${result.epicCount} epics`);
        onRunStarted?.(result.runId);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to start generation");
      }
    } catch (error) {
      console.error("Failed to start generation:", error);
      toast.error("Failed to start generation");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            Generate All Stories
          </DialogTitle>
          <DialogDescription>
            Configure and start batch story generation for your epics.
          </DialogDescription>
        </DialogHeader>

        <WizardStepper currentStep={currentStep} />

        <div className="min-h-[300px]">
          {currentStep === 1 && (
            <ScopeStep
              epics={epics}
              selectedEpicIds={selectedEpicIds}
              onSelectedChange={setSelectedEpicIds}
              existingBehavior={existingBehavior}
              onBehaviorChange={setExistingBehavior}
              isLoading={isLoading}
            />
          )}

          {currentStep === 2 && (
            <SettingsStep
              mode={mode}
              onModeChange={setMode}
              personaSet={personaSet}
              onPersonaSetChange={setPersonaSet}
              pacing={pacing}
              onPacingChange={setPacing}
            />
          )}

          {currentStep === 3 && (
            <ConfirmStep
              selectedEpicCount={selectedEpicIds.length}
              mode={mode}
              personaSet={personaSet}
              existingBehavior={existingBehavior}
              pacing={pacing}
              epicsWithStories={epicsWithStories}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || isStarting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Button>

          {currentStep < 3 ? (
            <Button onClick={handleNext} disabled={!canProceed() || isLoading}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={isStarting}>
              {isStarting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Start Generation
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
