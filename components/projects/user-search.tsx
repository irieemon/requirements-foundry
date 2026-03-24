"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";
import { searchUsers } from "@/server/actions/shares";

export interface UserSearchResult {
  id: string;
  email: string;
  name: string | null;
}

interface UserSearchProps {
  projectId: string;
  onSelect: (user: UserSearchResult) => void;
  excludeUserIds?: string[];
}

export function UserSearch({ projectId, onSelect, excludeUserIds = [] }: UserSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestCounterRef = useRef(0);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const requestId = ++requestCounterRef.current;
      setLoading(true);
      try {
        const users = await searchUsers(query, projectId, excludeUserIds);
        // Only update if this is still the latest request (prevent stale responses)
        if (requestId === requestCounterRef.current) {
          setResults(users);
        }
      } catch {
        if (requestId === requestCounterRef.current) {
          setResults([]);
        }
      } finally {
        if (requestId === requestCounterRef.current) {
          setLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, projectId, excludeUserIds]);

  const handleSelect = useCallback(
    (userId: string) => {
      const user = results.find((u) => u.id === userId);
      if (user) {
        onSelect(user);
        setQuery("");
        setResults([]);
        setOpen(false);
      }
    },
    [results, onSelect]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-muted-foreground">
          <UserPlus className="mr-2 h-4 w-4" />
          Search users by name or email...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search users by name or email..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <CommandEmpty>
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </CommandEmpty>
            )}
            {!loading && query.length >= 2 && results.length === 0 && (
              <CommandEmpty>No users found.</CommandEmpty>
            )}
            {!loading && query.length > 0 && query.length < 2 && (
              <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup>
                {results.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={handleSelect}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {user.name || user.email}
                      </span>
                      {user.name && (
                        <span className="text-sm text-muted-foreground">
                          {user.email}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
