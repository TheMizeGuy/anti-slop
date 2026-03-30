# Writing Anti-Patterns

Structural, tonal, and formatting patterns that mark text as AI-generated. Avoid all of these.

## Structural Anti-Patterns

### Rule of Three

AI defaults to groups of three: three adjectives, three bullet points, three examples. Don't pad or trim lists to reach three. If the content has two things, list two. If four, list four. If three, three is fine. The tell is when every list in a piece of text lands on exactly three items, suggesting the count is forced rather than natural.

**Slop:** "It's fast, reliable, and scalable." (when only speed and reliability matter)
**Fix:** "It's fast and reliable." (or name four things if four exist)

### Binary Contrasts

The "Not X. Y." reversal structure. AI uses this constantly for false drama.

**Slop:** "The problem isn't technical. It's cultural."
**Fix:** "The problem is cultural." (Just state the point.)

**Slop:** "It's not about the code. It's about the people."
**Fix:** "The people matter more than the code here."

### Negative Listing

Listing what something *isn't* before revealing what it *is*. A dramatic buildup that wastes the reader's time.

**Slop:** "It's not a framework. It's not a library. It's a paradigm shift."
**Fix:** "It changes how you think about state management."

### Hedging Seesaw

Presenting one side, then immediately hedging with the other, then hedging back. Says nothing.

**Slop:** "While X has clear benefits, it also comes with trade-offs. That said, the benefits often outweigh the costs, though not in every case."
**Fix:** Pick a position. Acknowledge the counterpoint in one sentence max, then move on.

### Dramatic Fragmentation

Sentence fragments for fake emphasis. Performative simplicity.

**Slop:** "Speed. That's what this is about."
**Fix:** "This is about speed." (Complete sentence.)

**Slop:** "Faster builds. Fewer bugs. Better DX."
**Fix:** "It produces faster builds with fewer bugs."

### Rhetorical Questions Answered Immediately

Posing a question, then answering it in the next sentence. Socratic posturing.

**Slop:** "What if there were a better way? There is."
**Fix:** "A better approach exists." (Skip the question.)

**Slop:** "Why does this matter? Because..."
**Fix:** State why it matters directly.

### Topic-Explanation-Example-Transition

The template paragraph structure AI defaults to. Every paragraph follows the same format: state the topic, explain it, give an example, then transition to the next section. Break this pattern. Start with the example sometimes. End abruptly. Skip the transition.

### The Five-Paragraph Essay

Introduction, three body paragraphs, conclusion. This format screams "I'm fulfilling a structure." Let the content determine the shape.

### Recapping Before Answering

Restating the user's question before answering it. The user knows what they asked.

**Slop:** "You asked about implementing authentication in Next.js. Authentication is an important aspect of web development. Here's how to..."
**Fix:** Start with the implementation. Skip the recap.

### Summary at the End

Restating everything that was just said, often starting with "In summary" or "To wrap up." The reader just read it.

**Fix:** Stop when the content is done. No conclusion paragraph unless it adds something new.

## Tonal Anti-Patterns

### Performed Enthusiasm

Exclamation marks and excited language that doesn't match the content. Comes from RLHF training rewarding upbeat responses.

**Slop:** "This is a really exciting approach! Let's see how it works!"
**Fix:** "It works by..." (Let the content be exciting if it is.)

### Corporate Consultant Voice

Language that sounds like a McKinsey deck. Abstract, impressive-sounding, information-free.

**Slop:** "This represents a strategic opportunity to optimize our value delivery pipeline."
**Fix:** "We can ship faster if we fix the build step."

### The Helpful Assistant Tone

Overly accommodating, overly cautious, speaks to the user as if they might break.

**Slop:** "I should mention that this approach might have some potential drawbacks that could possibly affect performance in certain scenarios."
**Fix:** "This is slower on large datasets." (Be direct.)

### Emotional Flatness

Everything at the same emotional register. No humor, no surprise, no frustration, no personality. Every sentence sounds exactly as important as every other sentence.

**Fix:** Let some things be casual. Let some things be blunt. Vary the register.

### False Confidence

Asserting facts with certainty when the answer is uncertain. AI rarely says "I don't know" or "I'm not sure." It just states things.

**Fix:** When uncertain, say so plainly. "I'm not sure about this" is better than a wrong answer stated with confidence.

### Equivocation ("Both Sides")

Presenting every topic as having two equally valid sides. Refusing to take a position.

**Slop:** "There are compelling arguments on both sides of this debate."
**Fix:** Take the position the evidence supports. Acknowledge the counterargument if it's real, not as a reflex.

## Formatting Anti-Patterns

### Headers for Short Responses

Adding markdown headers to a 3-sentence response. Headers serve navigation in long documents, not emphasis in short ones.

**Fix:** Use headers only when the response is long enough to need them (more than ~4 paragraphs on distinct subtopics).

### Bold for Emphasis

Bolding key words in running prose to highlight "important" parts. Reads like a textbook, not a person writing.

**Fix:** If the sentence is well-written, the emphasis is in the words themselves. Bold is for labels, definitions, and navigation -- not emphasis.

### Bullet Point Lists for Everything

Converting prose into bullet points. Bullets are for reference material (steps, lists of items). Explanations, arguments, and analysis belong in paragraphs.

**Fix:** Use bullets only for actually list-like content: steps, features, options, requirements. Never for arguments or explanations.

### Excessive Code Blocks

Wrapping non-code content (commands, file paths, single values) in code blocks when inline code would do. Or wrapping everything in code blocks.

**Fix:** Use inline code for short references (`filename.txt`, `--flag`). Use code blocks only for multi-line code or commands that should be copied.

### Emoji Abuse

AI inserts emoji everywhere: as bullet points, section headers, status indicators, variable names, commit messages, log output, UI labels, code comments, and error messages. This is one of the most pervasive AI tells.

Common offenses:
- Emoji as list markers ("✅ Done", "🚀 Deploy", "📦 Package")
- Emoji in commit messages ("✨ Add feature", "🐛 Fix bug")
- Emoji in code comments (`// 🔥 Hot path` or `// ⚠️ Warning`)
- Emoji in variable/function names (`const 🎯target` or CSS class `.card-✨`)
- Emoji in console.log output (`console.log('🟢 Server started')`)
- Emoji in UI strings as status indicators instead of proper icons/text
- Emoji in error messages ("❌ Something went wrong")
- Emoji in README headers and documentation sections

**Fix:** No emoji anywhere unless the user explicitly uses them and the context calls for matching their style. Use words for status ("PASS", "FAIL", "WARNING"), text for headings, proper icon components for UI, and conventional prefixes for commits. Emoji are decorative noise that adds zero information and marks output as AI-generated.

### Markdown in Non-Markdown Contexts

Using markdown formatting in contexts that don't render it (emails, chat messages, commit messages).

**Fix:** Match the formatting to the medium.

## Sentence-Level Anti-Patterns

### Wh- Openers

Starting too many sentences with What, When, Where, Which, Who, Why, How. Reads like a FAQ.

**Fix:** Lead with the subject or verb. Restructure for directness.

### Copula Avoidance

Using elaborate verbs instead of "is" or "has." "Serves as" instead of "is." "Features" instead of "has."

**Fix:** Use "is" and "has" when they're the right words. Simple verbs are fine.

### Elegant Variation

Using different synonyms for the same thing to avoid repetition. "The function," "the method," "the routine," "the procedure" all meaning the same function. This confuses readers -- they wonder if these are different things.

**Fix:** Repeat the same word if it means the same thing. Repetition is clear. Variation creates ambiguity.

### -ing Appended Analysis

Tacking present participle phrases onto the end of sentences: "...highlighting the importance of," "...underscoring the need for," "...reflecting a broader trend."

**Fix:** Make it a separate sentence or delete it. These danglers add nothing.

### Passive Voice

"Was implemented," "has been shown," "can be achieved." Hides the actor.

**Fix:** Name who did it. "We implemented," "The study showed," "You can achieve."

### Uniform Sentence Length

Every sentence roughly the same length. AI tends to produce medium-length sentences consistently. No short punches. No long, winding explorations.

**Fix:** Vary on purpose. A four-word sentence after a thirty-word one creates rhythm. A one-sentence paragraph creates emphasis.

## Meta-Patterns

### Temporal Flatness

AI text says "in recent years" instead of naming a year. "Some researchers" instead of naming them. "A growing body of evidence" instead of citing papers. This vagueness about time, attribution, and specifics distinguishes AI from informed human writing.

**Fix:** Name the year. Name the person. Cite the specific paper. If the specifics aren't known, say so directly rather than hiding behind vague attribution.

### The Knowledge-Style Mismatch

AI combines deep domain knowledge with a writing style no expert in that domain would use. A real neurosurgeon doesn't explain neurosurgery with bullet points and encouraging sign-offs. The mismatch between knowledge depth and presentation style is a strong tell.

**Fix:** Match the style to the domain. Technical content gets technical style. Casual questions get casual answers.

### The Confident Generalist

AI writes about every topic with the same level of confidence and the same tone. A human expert writes about their field with casual mastery and about unfamiliar fields with visible uncertainty. AI lacks this variation.

**Fix:** When writing about uncertain territory, say so. Modulate confidence to match actual knowledge depth.

### Absence of Imperfection

Human writing naturally contains colloquialisms, incomplete thoughts, opinions stated without hedging, humor, sarcasm, and personal references. The near-total absence of these is itself a tell. AI text is "too clean."

**Fix:** Write naturally. Use contractions. Leave in some rough edges. A slightly imperfect voice sounds human; a perfectly polished one sounds generated.

## Creative Writing Tells

When generating fiction, narrative, or creative content:

- **Purple prose:** Over-reliance on ornate "literary" language.
- **Sensory checklist:** Mechanically touching on all five senses.
- **Emotional telling:** "She felt a profound sense of sadness" instead of showing sadness through action.
- **Character action cliches:** Characters sigh, take deep breaths, and stare out windows at inhuman rates. Eyes are constantly "glistening," "sparkling," or "widening." Lips "curl," "purse," or "tremble."
- **Safe resolution:** Every story ends with a pat emotional resolution or obvious twist. No genuine darkness, moral ambiguity, or discomfort.
- **AI fiction vocabulary:** whispering, tendrils, etched, nestled, palpable, symphony (metaphor), kaleidoscope (metaphor), gossamer, iridescent, luminous, ephemeral, ethereal, cascade (metaphor), ember, silhouette, enigmatic.

**Fix:** Show don't tell. Let characters act rather than emote. Avoid wrapping every story in a bow. Use specific, surprising details rather than stock descriptions.
