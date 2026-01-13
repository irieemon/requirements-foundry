// ============================================
// Process Next Trigger - Fire and Forget
// ============================================
// Triggers the next epic processing step without blocking
// Works identically on local dev and Vercel

/**
 * Get the base URL for internal API calls
 * - On Vercel: Uses VERCEL_URL or NEXT_PUBLIC_VERCEL_URL
 * - Locally: Uses localhost:3000
 */
export function getBaseUrl(): string {
  // Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Vercel preview/production (public URL)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // Custom domain override
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Local development
  return `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Get the shared secret for authenticating internal batch processing calls.
 * Falls back to a development secret if not set.
 */
export function getBatchSecret(): string {
  return process.env.BATCH_STORY_SECRET || "dev-batch-secret-not-for-production";
}

/**
 * Fire-and-forget trigger for processing the next epic in a batch run.
 * Does NOT wait for the response - returns immediately.
 *
 * NOTE: Use triggerProcessNextAsync() for the INITIAL trigger from Server Actions,
 * as fire-and-forget will be killed when the Server Action returns on Vercel.
 *
 * @param runId - The batch story run ID
 * @returns void (fire-and-forget)
 */
export function triggerProcessNext(runId: string): void {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/runs/${runId}/process-next`;
  const secret = getBatchSecret();

  console.log(`[BatchStory] Triggering process-next for run ${runId}`);
  console.log(`[BatchStory] URL: ${url}`);

  // Fire and forget - do NOT await
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-batch-secret": secret,
    },
  }).catch((error) => {
    // Log but don't throw - this is fire-and-forget
    console.error(`[BatchStory] Failed to trigger process-next:`, error);
  });

  // Return immediately - don't wait for the fetch
}

/**
 * Awaitable trigger for the FIRST process-next call.
 * 
 * IMPORTANT: On Vercel, fire-and-forget fetch calls are killed when the Server Action
 * returns. The initial trigger MUST be awaited to ensure it actually executes.
 * Subsequent triggers from within API routes can use fire-and-forget since the
 * route handler keeps running.
 *
 * @param runId - The batch story run ID
 * @returns Promise that resolves when the request is sent (not when processing completes)
 */
export async function triggerProcessNextAsync(runId: string): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/runs/${runId}/process-next`;
  const secret = getBatchSecret();
  const secretPreview = secret.substring(0, 8) + "...";

  console.log(`[BatchStory] Triggering process-next (async) for run ${runId}`);
  console.log(`[BatchStory] Base URL: ${baseUrl}`);
  console.log(`[BatchStory] Full URL: ${url}`);
  console.log(`[BatchStory] Secret preview: ${secretPreview}`);
  console.log(`[BatchStory] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[BatchStory] VERCEL_URL: ${process.env.VERCEL_URL || "(not set)"}`);

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-batch-secret": secret,
      },
    });
    const elapsed = Date.now() - startTime;

    console.log(`[BatchStory] Response received in ${elapsed}ms: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[BatchStory] process-next failed: ${response.status} ${text}`);
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    const responseText = await response.text();
    console.log(`[BatchStory] process-next response: ${responseText}`);
    console.log(`[BatchStory] process-next triggered successfully for run ${runId}`);
    return { success: true };
  } catch (error) {
    console.error(`[BatchStory] Failed to trigger process-next:`, error);
    const errorMsg = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    return { success: false, error: errorMsg };
  }
}

/**
 * Fire-and-forget trigger for processing the next upload in a card analysis run.
 * Does NOT wait for the response - returns immediately.
 *
 * NOTE: Use triggerProcessNextUploadAsync() for the INITIAL trigger from Server Actions.
 *
 * @param runId - The card analysis run ID
 * @returns void (fire-and-forget)
 */
export function triggerProcessNextUpload(runId: string): void {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/runs/${runId}/process-next-upload`;
  const secret = getBatchSecret();

  console.log(`[CardAnalysis] Triggering process-next-upload for run ${runId}`);
  console.log(`[CardAnalysis] URL: ${url}`);

  // Fire and forget - do NOT await
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-batch-secret": secret,
    },
  }).catch((error) => {
    // Log but don't throw - this is fire-and-forget
    console.error(`[CardAnalysis] Failed to trigger process-next-upload:`, error);
  });

  // Return immediately - don't wait for the fetch
}

/**
 * Awaitable trigger for the FIRST process-next-upload call.
 * 
 * IMPORTANT: On Vercel, fire-and-forget fetch calls are killed when the Server Action
 * returns. The initial trigger MUST be awaited to ensure it actually executes.
 *
 * @param runId - The card analysis run ID
 * @returns Promise that resolves when the request is sent
 */
export async function triggerProcessNextUploadAsync(runId: string): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/runs/${runId}/process-next-upload`;
  const secret = getBatchSecret();

  console.log(`[CardAnalysis] Triggering process-next-upload (async) for run ${runId}`);
  console.log(`[CardAnalysis] URL: ${url}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-batch-secret": secret,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[CardAnalysis] process-next-upload failed: ${response.status} ${text}`);
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    console.log(`[CardAnalysis] process-next-upload triggered successfully for run ${runId}`);
    return { success: true };
  } catch (error) {
    console.error(`[CardAnalysis] Failed to trigger process-next-upload:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Validate the batch secret from incoming request headers.
 *
 * @param headerSecret - The secret from the request header
 * @returns true if valid, false otherwise
 */
export function validateBatchSecret(headerSecret: string | null): boolean {
  const expectedSecret = getBatchSecret();

  // In development without a configured secret, allow requests
  if (expectedSecret === "dev-batch-secret-not-for-production" && process.env.NODE_ENV === "development") {
    console.warn("[BatchStory] WARNING: Using dev secret - configure BATCH_STORY_SECRET in production!");
    return true;
  }

  return headerSecret === expectedSecret;
}
