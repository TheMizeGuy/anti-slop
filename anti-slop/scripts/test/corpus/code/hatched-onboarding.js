// Onboarding strings. Marketing owns the wording, and each opt-out says why.

// The Showcase tab is the product's own name for the sample gallery.  anti-slop-allow: product surface name
export const TAB_LABEL = "Showcase";

export const GREETING = "Great question. Your imports land in the inbox first."; // anti-slop-allow: legal-approved onboarding copy

export function renderGreeting(el) {
  el.innerHTML = GREETING; // anti-slop-allow: module constant, never user input
}
