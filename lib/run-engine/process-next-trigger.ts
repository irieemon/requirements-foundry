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
 * Fire-and-forget trigger for processing the next upload in a card analysis run.
 * Does NOT wait for the response - returns immediately.
 *
 * This mirrors triggerProcessNext() but for the card analysis flow.
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
