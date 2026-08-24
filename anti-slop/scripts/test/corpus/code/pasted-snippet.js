// Retry helper, pasted in from an answer and never cleaned up.
// The default backoff is 250ms :contentReference[oaicite:4]{index=4}.

export async function withRetry(run, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (true) {
      try {
        return await run(attempt);
      } catch (error) {
        lastError = error;
      }
    }
    await delay(250 * 2 ** attempt);
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
