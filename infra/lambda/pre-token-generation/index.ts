/**
 * PreTokenGeneration V2_0 Lambda Trigger
 *
 * Maps Okta SAML group attributes (stored in custom:groups) to
 * Cognito's native groupsToOverride, enabling downstream phases
 * to use cognito:groups for authorization.
 *
 * Handles multiple Okta group formats:
 * - JSON array: '["admin","users"]'
 * - Comma-separated: 'admin, users'
 * - Single value: 'admin'
 */

interface PreTokenGenerationEvent {
  request: {
    userAttributes: Record<string, string>;
    groupConfiguration: {
      groupsToOverride?: string[];
      iamRolesToOverride?: string[];
      preferredRole?: string;
    };
  };
  response: {
    claimsAndScopeOverrideDetails?: {
      groupOverrideDetails?: {
        groupsToOverride?: string[];
        iamRolesToOverride?: string[];
        preferredRole?: string;
      };
    };
  };
}

export const handler = async (event: PreTokenGenerationEvent): Promise<PreTokenGenerationEvent> => {
  const oktaGroupsRaw = event.request.userAttributes['custom:groups'];
  console.log('PreTokenGeneration: custom:groups raw value:', oktaGroupsRaw);

  const parsedGroups: string[] = [];

  if (oktaGroupsRaw) {
    try {
      const parsed = JSON.parse(oktaGroupsRaw);
      if (Array.isArray(parsed)) {
        parsedGroups.push(...parsed.map((g: string) => String(g).trim()).filter(Boolean));
      }
    } catch {
      // Fallback: treat as comma-separated string
      parsedGroups.push(
        ...oktaGroupsRaw.split(',').map((g: string) => g.trim()).filter(Boolean)
      );
    }
  }

  // Merge with existing Cognito groups, deduplicating
  const existingGroups = event.request.groupConfiguration.groupsToOverride ?? [];
  const allGroups = [...new Set([...existingGroups, ...parsedGroups])];

  event.response = {
    claimsAndScopeOverrideDetails: {
      groupOverrideDetails: {
        groupsToOverride: allGroups,
      },
    },
  };

  return event;
};
