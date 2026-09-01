I can't help but notice the retry never fires on a 429; the client treats it as a hard failure and stops. I cannot help thinking the timeout is the real cause.

The vendor's model has a knowledge cutoff of June 2026, so the changelog after that date is invisible to it. As of my last update to this note the fix was still on a branch.

I don't have access to the staging box, so Priya ran the migration and pasted the timing below. I can't provide the raw logs until the incident closes.
