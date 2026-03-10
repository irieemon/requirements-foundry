import { handler } from '../lambda/pre-token-generation/index.js';

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

function makeEvent(overrides: {
  userAttributes?: Record<string, string>;
  groupsToOverride?: string[];
} = {}): PreTokenGenerationEvent {
  return {
    request: {
      userAttributes: overrides.userAttributes ?? {},
      groupConfiguration: {
        groupsToOverride: overrides.groupsToOverride ?? [],
        iamRolesToOverride: [],
        preferredRole: undefined,
      },
    },
    response: {},
  };
}

describe('PreTokenGeneration Lambda Handler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns unmodified response when custom:groups is missing', async () => {
    const event = makeEvent();
    const result = await handler(event);

    expect(result.response.claimsAndScopeOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([]);
  });

  test('returns unmodified response when custom:groups is empty string', async () => {
    const event = makeEvent({ userAttributes: { 'custom:groups': '' } });
    const result = await handler(event);

    expect(result.response.claimsAndScopeOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([]);
  });

  test('parses JSON array groups', async () => {
    const event = makeEvent({
      userAttributes: { 'custom:groups': '["admin","users"]' },
    });
    const result = await handler(event);

    expect(result.response.claimsAndScopeOverrideDetails!.groupOverrideDetails!.groupsToOverride).toEqual(['admin', 'users']);
  });

  test('parses comma-separated groups', async () => {
    const event = makeEvent({
      userAttributes: { 'custom:groups': 'admin, users, editors' },
    });
    const result = await handler(event);

    expect(result.response.claimsAndScopeOverrideDetails!.groupOverrideDetails!.groupsToOverride).toEqual(['admin', 'users', 'editors']);
  });

  test('parses single group string', async () => {
    const event = makeEvent({
      userAttributes: { 'custom:groups': 'admin' },
    });
    const result = await handler(event);

    expect(result.response.claimsAndScopeOverrideDetails!.groupOverrideDetails!.groupsToOverride).toEqual(['admin']);
  });

  test('merges Okta groups with existing Cognito groups without duplicates', async () => {
    const event = makeEvent({
      userAttributes: { 'custom:groups': '["admin","users"]' },
      groupsToOverride: ['users', 'existing-group'],
    });
    const result = await handler(event);

    const groups = result.response.claimsAndScopeOverrideDetails!.groupOverrideDetails!.groupsToOverride!;
    expect(groups).toContain('admin');
    expect(groups).toContain('users');
    expect(groups).toContain('existing-group');
    expect(groups.length).toBe(3); // no duplicates
  });

  test('filters out empty strings from parsed groups', async () => {
    const event = makeEvent({
      userAttributes: { 'custom:groups': 'admin, , users, ' },
    });
    const result = await handler(event);

    expect(result.response.claimsAndScopeOverrideDetails!.groupOverrideDetails!.groupsToOverride).toEqual(['admin', 'users']);
  });

  test('returns correct V2_0 response structure', async () => {
    const event = makeEvent({
      userAttributes: { 'custom:groups': '["admin"]' },
    });
    const result = await handler(event);

    expect(result.response).toHaveProperty('claimsAndScopeOverrideDetails');
    expect(result.response.claimsAndScopeOverrideDetails).toHaveProperty('groupOverrideDetails');
    expect(result.response.claimsAndScopeOverrideDetails!.groupOverrideDetails).toHaveProperty('groupsToOverride');
    expect(Array.isArray(result.response.claimsAndScopeOverrideDetails!.groupOverrideDetails!.groupsToOverride)).toBe(true);
  });
});
