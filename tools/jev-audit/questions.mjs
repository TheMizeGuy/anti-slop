// Every Jev question and threshold for the anti-slop audit lives here, as named constants.
// Model pinned; probabilities are stored raw so a policy change costs no API calls.

export const MODEL = "jev-1.13.0";

export const READER =
  "an AI coding assistant that loads this text as instructions while it writes prose, code, or user-interface markup for a software project, and that also uses the text to review such output";

// ── Per-section battery ──
// Each Noul names one condition. High means the condition holds (a problem), except the
// two marked positive. Criteria extend the instruction in agreeing language.
export const SECTION_NOULS = {
  forbids_legitimate: {
    type: "noul",
    instructions:
      "Does `text` tell the reader to avoid or never use something that is the right choice in some common software or writing task, without naming an exception that allows it there?",
    criteria: {
      true: "A rule in the text would stop the reader from making a correct choice in a common task, and no exception in the text covers that case",
      false: "Every rule in the text either has no common legitimate exception or names the exception",
    },
  },
  worse_if_literal: {
    type: "noul",
    instructions:
      "Would a reader who applies `text` exactly as written produce worse prose, code, or interface in some common situation than a reader who ignored it?",
    criteria: {
      true: "Following the text literally makes some ordinary output worse",
      false: "Following the text literally never makes ordinary output worse",
    },
  },
  no_alternative: {
    type: "noul",
    instructions:
      "Does `text` describe a pattern to avoid without saying what the reader should do or choose instead?",
    criteria: {
      true: "The text names a pattern to avoid and gives no replacement, method, or decision to make instead",
      false: "Every pattern the text tells the reader to avoid comes with what to do instead, or the text names no pattern to avoid",
    },
  },
  unclear_boundary: {
    type: "noul",
    instructions:
      "Does `text` contain a rule where the reader could not tell whether a given piece of output breaks it without guessing what counts?",
    criteria: {
      true: "At least one rule has no stated threshold, example, or test, so applying it is a guess",
      false: "Every rule states a threshold, an example, or a test that decides borderline cases",
    },
  },
  no_reason: {
    type: "noul",
    instructions: "Does `text` state a rule without giving any reason or evidence for it?",
    criteria: {
      true: "At least one rule is stated with no reason, source, or consequence attached",
      false: "Every rule comes with a reason, a source, or the consequence of breaking it, or the text states no rules",
    },
  },
  internal_conflict: {
    type: "noul",
    instructions: "Do two sentences in `text` give the reader conflicting instructions?",
    criteria: {
      true: "Two sentences in the text cannot both be followed",
      false: "No two sentences in the text contradict each other",
    },
  },
  padding: {
    type: "noul",
    instructions:
      "Does `text` repeat a point it already made, or use several sentences where one sentence would carry the same instruction?",
    criteria: {
      true: "The text restates a point or explains at length what one sentence would say",
      false: "Each sentence in the text adds something the others do not",
    },
  },
  cosmetic_as_defect: {
    type: "noul",
    instructions:
      "Does `text` present a purely stylistic or cosmetic pattern as if it were a correctness, security, or accessibility defect?",
    criteria: {
      true: "The text gives a matter of style the weight or wording of a bug",
      false: "The text keeps style and defects at different weights, or it discusses only one of them",
    },
  },
  needs_missing_input: {
    type: "noul",
    instructions:
      "Does `text` require the reader to use information, a tool, or a measurement that the text neither provides nor tells the reader how to obtain?",
    criteria: {
      true: "The reader cannot follow the text without something it does not supply or point to",
      false: "Everything the text asks the reader to use is provided or its source is named",
    },
  },
  absolute_rule: {
    type: "noul",
    instructions:
      "Does `text` use 'never', 'always', 'no ... anywhere', 'in any context', or 'every' for a rule that has a common legitimate exception the text does not mention?",
    criteria: {
      true: "An absolute word is used for a rule that has a common legitimate exception the text leaves out",
      false: "The text uses no absolute words, or the exceptions to its absolute rules are stated",
    },
  },
  gives_method: {
    // positive: high is good
    type: "noul",
    instructions:
      "Does `text` give the reader a method, a threshold, a measurement, a worked distinction, or a piece of evidence that a competent reader would not already have?",
    criteria: {
      true: "The text adds a method, number, distinction, or fact beyond ordinary craft knowledge",
      false: "The text only names a lapse or restates what a competent reader already does",
    },
  },
};

export const SECTION_ACTION = {
  type: "score",
  instructions:
    "Which action does `text` need before `reader` should follow it? Judge the text on its own.",
  criteria: [
    "Leave as written: the text is clear, gives its reason, names its exceptions, and the reader would apply it correctly",
    "Edit: the text has one gap the reader could trip on, such as a missing exception, an unclear boundary, or a pattern with no alternative, and a sentence or two would close it",
    "Rewrite: following the text would lead the reader to worse output or to a wrong review verdict in a common case, and the section needs restructuring",
  ],
};

export const SECTION_QUESTIONS = { ...SECTION_NOULS, action: SECTION_ACTION };

// ── Banned-word battery ──
export const WORD_QUESTIONS = (i) => ({
  [`ordinary_${i}`]: {
    type: "noul",
    instructions: `Is \`words[${i}].word\` a word that a careful human writer uses in ordinary technical or business prose without it reading as machine-generated?`,
    criteria: {
      true: "An ordinary word a careful person writes in a plain sentence",
      false: "A word that reads as inflated, promotional, or machine-generated when it appears in plain prose",
    },
  },
  [`loses_meaning_${i}`]: {
    type: "noul",
    instructions: `Would replacing \`words[${i}].word\` with \`words[${i}].suggested\` lose meaning in a common technical, scientific, legal, or business sentence where the word is the precise term?`,
    criteria: {
      true: "In some common field the word is the precise term and the suggested replacement is less exact or wrong",
      false: "The suggested replacement says the same thing in every common use",
    },
  },
});

// ── Banned-phrase battery ──
export const PHRASE_QUESTIONS = (i) => ({
  [`ordinary_${i}`]: {
    type: "noul",
    instructions: `Is \`phrases[${i}].phrase\` a phrase that a careful human writer uses in ordinary prose without it reading as machine-generated?`,
    criteria: {
      true: "An ordinary phrase a careful person writes in a plain sentence",
      false: "A phrase that reads as filler, flattery, or machine-generated when it appears in plain prose",
    },
  },
  [`carries_meaning_${i}`]: {
    type: "noul",
    instructions: `Does \`phrases[${i}].phrase\` carry a meaning that a sentence loses if the phrase is deleted without replacement?`,
    criteria: {
      true: "Deleting the phrase changes what the sentence says",
      false: "Deleting the phrase leaves the sentence saying the same thing",
    },
  },
});

// ── Scanner-rule battery ──
// `rule.finding` is the finding exactly as the CLI prints it (desc, rule id, confidence, and
// from 2.4.0 the fix line), so the battery scores what a reader actually sees.
export const RULE_QUESTIONS = {
  desc_names_fix: {
    // positive: high is good
    type: "noul",
    instructions: "Does `rule.finding` tell the reader what to do instead of the pattern it describes?",
    criteria: {
      true: "The description names a replacement or a fix",
      false: "The description only names the pattern or why it is bad",
    },
  },
  defect_certain: {
    type: "noul",
    instructions:
      "Given only `rule.finding`, is every occurrence of what it describes a defect, rather than something that is sometimes a deliberate and correct choice?",
    criteria: {
      true: "What the description names is wrong every time it appears",
      false: "What the description names is sometimes a deliberate, correct choice",
    },
  },
  cost_if_real: {
    type: "choice",
    instructions: "If the pattern `rule.finding` describes is present and is not a deliberate choice, what does it cost?",
    criteria: {
      high: "A security hole, a bug, data loss, or an interface that does not work",
      medium: "A quality defect that users notice or maintainers must fix",
      low: "A stylistic or genericness signal with no functional cost",
    },
  },
  reader_understands: {
    // positive: high is good
    type: "noul",
    instructions:
      "Would a reader who sees only `rule.finding` and the file name understand what was matched, why it matters, and what to do?",
    criteria: {
      true: "The description alone says what was found and why it matters",
      false: "The reader would need the rule's source or documentation to understand the finding",
    },
  },
};

// ── Doctrine-pair battery ──
export const PAIR_QUESTIONS = {
  conflict: {
    type: "noul",
    instructions: "Do `a.text` and `b.text` give the reader instructions that cannot both be followed in the situation `situation` describes?",
    criteria: {
      true: "In the described situation the two texts pull in opposite directions",
      false: "In the described situation the two texts agree or address different things",
    },
  },
  needs_reconciling: {
    type: "noul",
    instructions: "Would a reader who has read both `a.text` and `b.text` need a sentence that says which one wins in the situation `situation` describes?",
    criteria: {
      true: "The reader is left to guess which text applies",
      false: "The texts already say which applies, or the question does not arise",
    },
  },
};

// ── Coverage-gap battery ──
export const GAP_QUESTIONS = (i) => ({
  [`covered_${i}`]: {
    type: "noul",
    instructions: {
      candidate: `candidates[${i}]`,
      question: "Does any entry in `catalogue` address the failure that `candidate` names?",
    },
    criteria: {
      true: "An entry in the catalogue names this failure or the pattern behind it",
      false: "No entry in the catalogue addresses it",
    },
  },
  [`in_scope_${i}`]: {
    type: "noul",
    instructions: {
      candidate: `candidates[${i}]`,
      question: "Is the failure `candidate` names inside the scope that `scope` describes?",
    },
    criteria: {
      true: "The scope statement covers the domain and kind of failure named",
      false: "The failure falls outside the stated scope",
    },
  },
});

// ── Thresholds ──
// Review band around each cut line, since probabilities move about 0.03 between calls.
export const FLAG = 0.65;
export const REVIEW_LOW = 0.45;
export const ACTION_EDIT = 0.75; // score >= this on the 0..2 action scale means at least "edit"
export const ACTION_REWRITE = 1.5;
