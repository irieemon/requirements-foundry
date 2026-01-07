"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ExportStepperProps {
  currentStep: number;
  steps: string[];
}

export function ExportStepper({ currentStep, steps }: ExportStepperProps) {
  return (
    <nav aria-label="Export progress" className="mb-8">
      <ol className="flex items-center justify-center gap-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <li key={step} className="flex items-center">
              {/* Step circle and label */}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    isCompleted && "bg-primary text-primary-foreground",
                    isActive && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
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

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-4 h-0.5 w-12 sm:w-16",
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
