# Banned Phrases

Phrases that generated prose reaches for by reflex. Three kinds live in this file, and they are judged differently:

- **Single-occurrence tells.** The leftover assistant-voice lines ("As an AI language model," "I cannot assist with..."). One is proof of provenance. The scanner matches them as `assistant-boilerplate` at high severity, Hard defect, not through the phrase list below.
- **Position tells.** Sycophantic openers and closers, throat-clearing, meta-commentary, and summary markers. The tell is the slot, not the words: the reflexive first or last sentence of a piece, filled by habit. The same phrase in the middle of a conversation, carrying a real shift of tone, is ordinary English.
- **Plain-word preferences.** Filler, transitions, business jargon, significance inflation, vague declaratives, and false attribution. Judged by clustering and by what follows: a phrase that the next sentence backs with a fact is not a tell, and one occurrence in a page of plain prose is the writer's own.

The scanner matches only the forty highest-signal phrases (`BANNED_PHRASES` in `scripts/lib/rules.mjs`), on presence, at medium severity, Pattern smell. Everything else here is guidance for the writer, not a rule for a reviewer, and a sentence rewritten to dodge one of these phrases is worse than the sentence that used it.

One thing reads as AI on a single occurrence: the leftover assistant-voice lines ("As an AI language model," "I cannot assist with..."). A quoted example of one, in a document discussing the tell, is not an occurrence, and the scanner blanks double-quoted and backticked spans in prose files for that reason (in a source file, mark the line `anti-slop-allow`). The em dash is the top-cited writing tell but is judged by density, not a single instance; a lone correct dash is clean. Everything else here is judged in context and by clustering: one stray phrase in otherwise-natural prose is weaker evidence than several together (see `empirical-rankings.md`). The strongest *construction* tell is not a fixed phrase but a shape: **"It's not just X, it's Y" / "not only X, but also Y"** — the negate-then-assert antithesis. Cut it; state Y plainly. See `writing-patterns.md`.

## Sycophantic Openers

The worst offenders. These open a response by praising the user instead of answering them.

- "Great question!"
- "That's a great question!"
- "That's a wonderful idea!"
- "That's an excellent point!"
- "Absolutely!"
- "Certainly!"
- "Of course!" (as a formulaic opener to a paragraph; fine as a brief standalone acknowledgment)
- "I'd be happy to help!"
- "I'd be happy to assist!"
- "I'd love to help with that!"
- "What a fantastic question!"
- "You raise an excellent point!"
- "You're absolutely right!"
- "That's a really insightful observation!"
- "I appreciate you asking that!"
- "I hope this helps!"
- "Hope this helps!"
- "Feel free to ask if you need more information!"
- "Don't hesitate to reach out!"
- "Let me know if you have any questions!"
- "I'd be happy to elaborate!"
- "Does that make sense?"
- "Happy to help further!"
- "Would you like me to...?" (the trailing offer to do more — a turn-ending move pasted into a final draft)
- "Is there anything else I can help with?"
- "I hope this email finds you well"

**Instead:** Start with the answer or the action. Skip the preamble. Brief acknowledgment ("Sure." "Right.") is fine when the conversational tone calls for it. The ban targets performative flattery, not all social warmth. End on the last real sentence; a person finishing a thought does not ask whether you want a revision.

## Throat-Clearing Openers

Phrases that delay getting to the point. They pad the opening without adding information.

- "Here's the thing:"
- "Here's what [X]"
- "Here's why [X]"
- "The uncomfortable truth is"
- "It turns out"
- "The real [X] is"
- "Let me be clear"
- "The truth is,"
- "I'll say it again:"
- "I'm going to be honest"
- "Can we talk about"
- "Here's what I find interesting"
- "Here's the problem though"
- "So, here's the deal"
- "Look,"
- "Honestly," (as a sentence opener — singled out by writers as "zombified by AI")
- "Let's be real"
- "Let's face it"
- "Real talk,"

**Instead:** State the point directly. No runway needed. ("Honestly" is fine mid-sentence where it carries real meaning; the tell is the reflexive throat-clearing opener.)

**Not a tell when:** the register is conversational and the opener marks a real turn ("Look, the migration is not going to finish today" in a chat reply carries the shift; the same line at the top of a design document does not).

## Emphasis Crutches

Phrases that tell the reader something is important instead of showing it through content.

- "Full stop."
- "Period."
- "Let that sink in."
- "This matters because"
- "Make no mistake"
- "Here's why that matters"
- "This is huge."
- "This cannot be overstated."
- "And that's the key."
- "This is critical."
- "Read that again."
- "I can't stress this enough."

**Instead:** If the content is important, the reader will recognize it. Delete the crutch.

**Not a tell when:** the piece is dialogue or a deliberately blunt register, where "Full stop." is the speaker's voice. In expository prose it stands where evidence should be.

## Filler and Hedging

Phrases that pad sentences without adding meaning. They make writing feel bloated and uncertain.

- "At its core"
- "In today's [X]"
- "It's worth noting"
- "It's important to note"
- "At the end of the day"
- "When it comes to"
- "In a world where"
- "The reality is"
- "In terms of"
- "With that being said"
- "That said"
- "Having said that"
- "It goes without saying"
- "Needless to say"
- "All things considered"
- "In the grand scheme of things"
- "As a matter of fact"
- "For what it's worth"
- "To be fair"
- "As it turns out"
- "In essence"
- "In other words"
- "Put simply"
- "Simply put"
- "It's important to remember that..."
- "It's also worth mentioning..."
- "As [noun] continues to evolve..."

**Instead:** Delete the phrase. The sentence works without it. If it doesn't, rewrite the sentence.

**Not a tell when:** the phrase does its job once. "In other words" that restates a technical claim for a second audience, "That said" or "To be fair" followed by a real concession, are ordinary connective prose. The tell is the phrase with nothing behind it, or several of these in one page.

## Meta-Commentary

Phrases that narrate the writing process instead of doing the work. The reader doesn't need a tour guide.

- "Let me walk you through..."
- "Let me explain..."
- "Let me break this down"
- "In this section, we'll..."
- "As we'll see..."
- "I want to explore..."
- "Let's dive in"
- "Let's take a closer look"
- "Let's unpack this"
- "Let's break this down"
- "The rest of this explains..."
- "Before we get started..."
- "First, let's understand..."
- "Now, let's move on to..."
- "With that context in mind..."
- "Building on that..."
- "To put this in perspective..."
- "Hint:"
- "Plot twist:"
- "Spoiler:"

- "Without further ado"
- "Let's get started"
- "In this [article/guide/post], we'll..."
- "Key takeaways"
- "Key takeaway"

**Instead:** Do the thing. Don't announce it.

**Not a tell when:** a long document needs one sentence of navigation at a section boundary. The tell is announcing instead of doing, in a piece short enough to read in one sitting.

## Journey and Navigation Metaphors

Metaphors AI defaults to constantly. They sound grand but say nothing.

- "embark on a journey"
- "navigate the landscape"
- "navigate the complexities"
- "traverse the diverse"
- "on the path to"
- "at the crossroads of"
- "a roadmap for"
- "take a deep dive"
- "pave the way for"
- "chart a course"
- "blaze a trail"
- "the next chapter"
- "a new frontier"

**Instead:** Name the specific action or destination. "We started migrating to..." not "We embarked on a migration journey."

## Significance Inflation

Phrases that make ordinary things sound historically important.

- "marks a pivotal moment"
- "represents a significant shift"
- "broader movement"
- "evolving landscape"
- "ever-evolving"
- "indelible mark"
- "deeply rooted"
- "watershed moment"
- "tipping point"
- "seismic shift"
- "paradigm shift"
- "game-changer"
- "a new era"
- "dawn of a new"
- "revolutionize the way we"
- "forever change"
- "stands as a testament to"
- "a beacon of"
- "a treasure trove of"
- "a tapestry of"
- "a symphony of"
- "a mosaic of"
- "buckle up"
- "say goodbye to [X]"
- "look no further"
- "take it to the next level"
- "supercharge your [X]"

**Instead:** State what happened and why it matters, without inflating it. If it's historic, the facts speak for themselves. For the marketing-CTA variants ("say goodbye to," "supercharge"), say what the thing literally does with a specific.

**Not a tell when:** the claim is literally true and the evidence sits in the next sentence. A history of science essay may write "paradigm shift" about Kuhn; the tell is inflation standing in for a fact.

## Vague Declaratives

Statements that sound substantive but contain no information.

- "The reasons are structural"
- "The implications are significant"
- "This is the deepest problem"
- "The stakes are high"
- "The consequences are real"
- "This has far-reaching implications"
- "The impact cannot be understated"
- "There are many factors at play"
- "It's a complex issue"
- "There's a lot to unpack here"
- "This raises important questions"

**Instead:** Name the reasons, implications, stakes, or consequences specifically.

**Not a tell when:** the next sentence names them. "The stakes are high: a wrong answer here ships to 40,000 devices" is a topic sentence with its evidence attached. The tell is the declarative standing alone.

## False Attribution

Vague citations that sound authoritative but cite nothing specific.

- "Experts believe"
- "Studies show"
- "Research suggests"
- "According to experts"
- "It is widely recognized"
- "It is generally accepted"
- "Many scholars argue"
- "Some would say"
- "Conventional wisdom holds"

**Instead:** Name the expert. Cite the study. Or drop the attribution and state the claim directly.

**Not a tell when:** a citation follows. "Research suggests (Kobak et al., 2024) that..." is academic register doing its job. The tell is attribution standing in for a citation, and never invent one to satisfy this rule: an unnamed source stated as unnamed is honest, and a fabricated citation is the worse tell (`writing-patterns.md` § Temporal Flatness).

## Performative Emphasis

Phrases that try to create emotional weight through performance rather than content.

- "And I promise"
- "They exist, I promise"
- "Trust me on this"
- "I can't emphasize this enough"
- "This is where it gets interesting"
- "Here's where things get tricky"
- "This is the part that surprises most people"
- "You might be surprised to learn"
- "What most people don't realize"
- "The secret is"
- "The real answer is"
- "Here's the kicker"

**Instead:** Present the information. If it's interesting or surprising, the reader will notice.

## Business Jargon

Corporate-speak that adds nothing. Use plain words.

- "move the needle"
- "circle back"
- "double down"
- "lean into"
- "on the same page"
- "take a step back"
- "moving forward"
- "low-hanging fruit"
- "deep dive" (as noun)
- "value proposition"
- "core competency"
- "thought leader"
- "best practices" (when used generically)
- "mission-critical"
- "scalable solution"
- "actionable insights"
- "stakeholder alignment"
- "synergistic approach"

**Instead:** Say what you mean in plain language. "Revisit" not "circle back." "Focus on" not "lean into." "Easy wins" not "low-hanging fruit."

## Transition Stuffing

Connector phrases that AI stacks between ideas. In conversational and short-form writing, avoid these. In long-form technical documentation, use sparingly when the logical relationship between sections needs signaling.

- "In addition to this"
- "Not only... but also..."
- "By the same token"
- "In light of this"
- "With this in mind"
- "To that end"
- "Along these lines"
- "In a similar vein"
- "By extension"

Use sparingly (not banned outright, but flag if multiple appear in one passage). Standard in academic and formal writing:
- "Furthermore"
- "Moreover"
- "Additionally"
- "Conversely"
- "On the other hand"

**Instead:** Prefer short transitions: "But," "And," "Still," "Also," "Yet." Use formal transitions only when the logical relationship needs explicit marking, not as reflexive padding.

## Summary and Conclusion Markers

Phrases that announce you're wrapping up instead of just wrapping up.

- "In conclusion"
- "In summary"
- "To sum up"
- "To wrap up"
- "In closing"
- "All in all"
- "Ultimately"
- "The bottom line is"
- "To bring it all together"
- "As we've seen"
- "As discussed above"

**Instead:** Stop writing when you're done. No ceremony needed.

**Not a tell when:** a long report carries a real summary section that a reader who skips the body needs. The tell is a closer that restates a piece the reader just finished, and it is judged by length: a two-paragraph reply does not need one, and a forty-page report may.
