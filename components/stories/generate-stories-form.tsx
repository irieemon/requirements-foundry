"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateStoriesForEpic } from "@/server/actions/generation";
import {
  GenerationMode,
  PersonaSet,
  GENERATION_MODE_CONFIG,
  PERSONA_SETS,
} from "@/lib/types";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GenerateStoriesFormProps {
  epicId: string;
  hasExistingStories: boolean;
}

export function GenerateStoriesForm({ epicId, hasExistingStories }: GenerateStoriesFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<GenerationMode>("standard");
  const [personaSet, setPersonaSet] = useState<PersonaSet>("core");

  const modeConfig = GENERATION_MODE_CONFIG[mode];
  const personas = PERSONA_SETS[personaSet];

  const handleGenerate = async () => {
    if (hasExistingStories) {
      const confirmed = confirm(
        "This will regenerate all stories for this epic, replacing existing ones. Continue?"
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      const result = await generateStoriesForEpic(epicId, mode, personaSet);
      if (result.success) {
        toast.success(`Generated ${result.storyCount} stories`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to generate stories");
      }
    } catch {
      toast.error("Failed to generate stories");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate Stories</CardTitle>
        <CardDescription>
          Configure generation settings and create user stories for this epic.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mode">Generation Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as GenerationMode)}>
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact (5-8 stories)</SelectItem>
                <SelectItem value="standard">Standard (8-12 stories)</SelectItem>
                <SelectItem value="detailed">Detailed (12-15 stories)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{modeConfig.focus}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="personas">Persona Set</Label>
            <Select value={personaSet} onValueChange={(v) => setPersonaSet(v as PersonaSet)}>
              <SelectTrigger id="personas">
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
        </div>

        <Button onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {hasExistingStories ? "Regenerate Stories" : "Generate Stories"}
        </Button>
      </CardContent>
    </Card>
  );
}
