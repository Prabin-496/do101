import type { Tool } from "../types";

/**
 * Writing tools for students.
 *
 * A free alternative to the paid writing assistants, built from rules that run
 * in the page. The claims here are deliberately narrow: these tools match
 * patterns and apply formulas, they do not understand what you wrote, and every
 * description says so.
 */
export const WRITING_TOOLS: Tool[] = [
  {
    id: "grammar-checker",
    name: "Grammar & Spelling Checker",
    short: "Catch spelling, grammar, punctuation and wordiness as you type.",
    long:
      "Paste an essay or report and see spelling slips, punctuation errors, subject–verb disagreements, confusable words, wordy phrases and passive voice underlined in place. Every suggestion explains itself, and the clear-cut mistakes can be fixed in one click. It all runs in this tab — your work is never uploaded.",
    category: "writing",
    route: "/tools/grammar-checker",
    keywords: [
      "grammar checker", "free grammar checker", "spell checker", "proofreader",
      "grammarly alternative", "essay checker", "punctuation checker",
      "grammar check online free", "writing checker", "proofreading tool",
    ],
    aliases: ["check my grammar", "proofread", "fix my spelling", "grammar check"],
    icon: "✅",
    accent: "grass",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["paraphrasing-tool", "readability-checker", "tone-checker", "word-counter"],
    seoTitle: "Free Grammar & Spelling Checker — No Sign-Up | DO101",
    seoDescription:
      "Check grammar, spelling, punctuation and wordiness free in your browser. No account, no upload, no word limit. Built for essays and reports.",
    steps: [
      "Paste or type your text into the editor.",
      "Underlines appear as you write: red for mistakes, orange for things to check, blue for suggestions.",
      "Click any underlined phrase to see why it was flagged and accept or ignore the fix.",
      "Use \"Fix clear mistakes\" for the unambiguous ones, then copy your text back out.",
    ],
    features: [
      "Spelling, including the inflected forms of common misspellings",
      "Grammar: a/an, subject–verb agreement, double negatives, confusable words",
      "Punctuation: spacing, comma splices, repeated marks",
      "Clarity and concision: wordy phrases, nominalisations, filler, hedging",
      "Passive voice, overlong sentences and repeated words",
      "One-click fixes for the unambiguous errors only",
      "No word limit, no account, and nothing leaves your browser",
    ],
    faqs: [
      {
        q: "Is this really free?",
        a: "Yes, with no account and no word limit. The checker is a rule engine that ships with the page, so running it costs nothing to serve — which is why there is nothing to charge for.",
      },
      {
        q: "How does it compare to Grammarly?",
        a: "Honestly: it catches less. Grammarly uses trained language models that understand sentence structure; this is a rule-based checker, so it finds mistakes that follow recognisable patterns and misses ones that need context. What it does give you is unlimited free checking, an explanation for every flag, and text that never leaves your device.",
      },
      {
        q: "Is my essay uploaded anywhere?",
        a: "No. There is no upload endpoint. The checking runs in JavaScript in your browser, and you can confirm that by opening your browser's network tab while you type.",
      },
      {
        q: "Will it catch every mistake?",
        a: "No, and no checker will. It cannot tell whether your argument holds, whether a citation is right, or whether you have used a real word in the wrong sense. Read your work aloud as well — it is still the best proofreading method there is.",
      },
      {
        q: "Why is it flagging something that is correct?",
        a: "Rules produce false positives, especially around passive voice and contractions, which are correct in plenty of writing. Every flag can be ignored, and whole categories can be switched off with the filter chips.",
      },
    ],
    featured: true,
  },
  {
    id: "paraphrasing-tool",
    name: "Paraphrasing & Rewriting Tool",
    short: "Tighten wordy writing with every edit shown and reversible.",
    long:
      "Four rewriting modes — concise, formal, plain English and active voice — applied by substitution rules you can inspect. Long phrases become short ones, noun phrases become the verbs hiding inside them, and contractions are written out for academic work. Every single edit is listed so you can untick the ones you disagree with.",
    category: "writing",
    route: "/tools/paraphrasing-tool",
    keywords: [
      "paraphrasing tool", "free paraphraser", "rewriting tool", "quillbot alternative",
      "reword text", "sentence rewriter", "make writing concise", "text improver",
    ],
    aliases: ["reword this", "rewrite my text", "paraphrase", "make this shorter"],
    icon: "✂️",
    accent: "sky",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["grammar-checker", "readability-checker", "tone-checker", "word-counter"],
    seoTitle: "Free Paraphrasing Tool — Rewrite & Tighten Text | DO101",
    seoDescription:
      "Rewrite wordy text into concise, formal or plain English. Every edit is shown and reversible. Free, unlimited, and runs in your browser.",
    steps: [
      "Paste the paragraph you want to improve.",
      "Pick a mode: concise, formal, plain English or active voice.",
      "Review the list of edits and untick any you disagree with.",
      "Copy the result, or replace your original text with it.",
    ],
    features: [
      "Concise mode: cuts padding phrases and filler words",
      "Formal mode: expands contractions and replaces casual wording",
      "Plain English mode: swaps heavy words for everyday ones",
      "Active voice mode: finds every passive construction for you to fix",
      "Word count before and after, so you can see what you saved",
      "Every change listed with a reason, and reversible one by one",
    ],
    faqs: [
      {
        q: "Does this rewrite my text with AI?",
        a: "No. It applies substitution rules from a fixed list — \"due to the fact that\" becomes \"because\", \"make a decision\" becomes \"decide\". That is why every edit can be shown and undone. It will not restate an idea in genuinely new words, because that needs to understand the idea.",
      },
      {
        q: "Can I use this to avoid plagiarism?",
        a: "No, and it is worth being clear about this. Reworded sentences carrying someone else's ideas still need a citation. Changing the words changes nothing about who the ideas belong to.",
      },
      {
        q: "Will it make my writing sound like a person wrote it?",
        a: "It makes wordy writing shorter and heavy writing plainer, which usually reads better. It is not designed to disguise the origin of text, and it does not claim to.",
      },
      {
        q: "Is there a word limit?",
        a: "No. The rules run in your browser, so the only limit is your device's memory.",
      },
    ],
    featured: true,
  },
  {
    id: "readability-checker",
    name: "Readability Checker",
    short: "Flesch, Gunning Fog, SMOG and three more, with sentence rhythm.",
    long:
      "Six published readability formulas calculated on your text, plus the things they miss: sentence-length variance, a bar chart of every sentence, and your longest sentences pulled out for a second look. Useful for pitching an essay at the right level or getting web copy under a target grade.",
    category: "writing",
    route: "/tools/readability-checker",
    keywords: [
      "readability checker", "flesch reading ease", "flesch kincaid grade level",
      "gunning fog index", "smog index", "readability score", "reading level checker",
      "coleman liau index", "automated readability index",
    ],
    aliases: ["reading level", "how hard is my writing", "readability score"],
    icon: "📊",
    accent: "sun",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["grammar-checker", "paraphrasing-tool", "word-counter", "tone-checker"],
    seoTitle: "Free Readability Checker — Flesch, Fog, SMOG Scores | DO101",
    seoDescription:
      "Get Flesch Reading Ease, Flesch–Kincaid, Gunning Fog, SMOG, Coleman–Liau and ARI scores instantly. Free, no sign-up, runs in your browser.",
    steps: [
      "Paste at least a paragraph — the formulas need about 100 words to settle.",
      "Read the Flesch Reading Ease score and what it means for your audience.",
      "Compare the five grade-level formulas; they disagree by design.",
      "Check the sentence rhythm chart for monotony and overlong sentences.",
    ],
    features: [
      "Flesch Reading Ease, with a plain description of the audience",
      "Five grade-level formulas: Flesch–Kincaid, Gunning Fog, SMOG, Coleman–Liau, ARI",
      "Median grade, which is a fairer summary than any single formula",
      "Sentence-length variance — the rhythm no formula reports",
      "A bar per sentence, colour-coded by length",
      "Your longest sentences listed for rewriting",
    ],
    faqs: [
      {
        q: "Which score should I use?",
        a: "Flesch Reading Ease for a quick sense of difficulty, Flesch–Kincaid if you have been given a grade-level target. If they disagree sharply, look at why: Coleman–Liau and ARI count characters, so long names push them up, while Fog and SMOG count long words.",
      },
      {
        q: "What is a good score?",
        a: "It depends entirely on the audience. General web writing usually aims for Reading Ease 60–70 (about grade 8–9). Academic writing sits far lower and that is appropriate — a philosophy essay scoring 70 would probably be underexplaining.",
      },
      {
        q: "Are the syllable counts accurate?",
        a: "English spelling is irregular, so no rule set is perfect. This one handles the common irregular words from a lookup table and applies vowel-group rules with silent-E and suffix corrections, landing within a syllable essentially always — comfortably inside what the formulas need.",
      },
      {
        q: "Can I optimise my writing for these scores?",
        a: "You can, but be careful what it does to your prose. All six formulas measure word and sentence length as a proxy for difficulty. Chopping every sentence in half will improve the number and can make the writing worse.",
      },
    ],
    featured: false,
  },
  {
    id: "citation-generator",
    name: "Citation Generator",
    short: "APA, MLA, Harvard, Chicago, IEEE and Vancouver references.",
    long:
      "Fill in what you know about a source and get a correctly formatted reference and in-text citation in six styles. Italics survive the copy, so references paste into Word already formatted. Build a whole reference list, sorted the way your style expects, saved on your device.",
    category: "writing",
    route: "/tools/citation-generator",
    keywords: [
      "citation generator", "apa citation generator", "mla citation generator",
      "harvard referencing generator", "chicago citation", "ieee citation",
      "vancouver referencing", "free citation maker", "reference generator",
      "bibliography generator",
    ],
    aliases: ["cite this", "make a citation", "reference generator", "apa reference"],
    icon: "📚",
    accent: "grape",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["grammar-checker", "text-similarity-checker", "paraphrasing-tool", "word-counter"],
    seoTitle: "Free Citation Generator — APA, MLA, Harvard, Chicago | DO101",
    seoDescription:
      "Generate references and in-text citations in APA 7, MLA 9, Harvard, Chicago, IEEE and Vancouver. Free, no account, italics included when you copy.",
    steps: [
      "Choose your citation style and the type of source.",
      "Add the authors, then fill in whichever fields you have.",
      "Copy the reference and the in-text citation, or add it to your list.",
      "When you have added everything, copy the whole reference list in one go.",
    ],
    features: [
      "Six styles: APA 7, MLA 9, Harvard, Chicago author–date, IEEE, Vancouver",
      "Nine source types, each showing only the fields that style needs",
      "In-text citation alongside the reference-list entry",
      "Italics preserved when you copy into a word processor",
      "A running reference list, sorted the way your style expects",
      "Warnings when a field the style expects is missing",
      "Saved in your browser only — no account, no sync",
    ],
    faqs: [
      {
        q: "Which styles are supported?",
        a: "APA 7th, MLA 9th, Harvard, Chicago 17th author–date, IEEE and Vancouver. Each is implemented against its published rules rather than a shared approximation, because the differences in initials, italics and ordering are exactly what marks come off for.",
      },
      {
        q: "Will the italics come through when I paste?",
        a: "Yes. The copy button writes both a formatted and a plain-text version to your clipboard, so pasting into Word or Google Docs keeps journal and book titles italicised.",
      },
      {
        q: "Should I check the output?",
        a: "Yes. Every style has edge cases — corporate authors, missing dates, translations, secondary citations — and many departments have a house variation. Treat this as a fast first draft and check it against your course's referencing guide.",
      },
      {
        q: "Where is my reference list stored?",
        a: "In your browser's local storage on this device. It is not sent anywhere and will not follow you to another computer. Clearing your browser data removes it.",
      },
    ],
    featured: true,
  },
  {
    id: "text-similarity-checker",
    name: "Text Similarity Checker",
    short: "Compare two documents and see exactly which passages overlap.",
    long:
      "Paste your draft and a source, and see every run of matching words highlighted in both, with an overlap percentage. Built for checking that what you took from a source is properly quoted and cited. It compares the two texts you give it — it does not search the web, and it says so instead of pretending otherwise.",
    category: "writing",
    route: "/tools/text-similarity-checker",
    keywords: [
      "text similarity checker", "compare two texts", "text comparison tool",
      "document similarity", "duplicate content checker", "compare documents for similarity",
      "check text overlap", "self plagiarism check",
    ],
    aliases: ["compare two documents", "how similar are these texts", "check overlap"],
    icon: "🔍",
    accent: "fire",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["citation-generator", "grammar-checker", "text-diff", "paraphrasing-tool"],
    seoTitle: "Free Text Similarity Checker — Compare Two Documents | DO101",
    seoDescription:
      "Compare two texts and see every overlapping passage highlighted, with a similarity percentage. Free, browser-based, nothing uploaded.",
    steps: [
      "Paste your draft on the left and the source on the right.",
      "Matching passages are highlighted in both texts as you type.",
      "Click any passage to line it up against its match in the other document.",
      "Adjust the match length if you want to catch shorter or only longer runs.",
    ],
    features: [
      "Overlap percentage using n-gram containment, the standard reuse measure",
      "Every matching passage highlighted in both documents",
      "Adjustable match length from 3 to 10 words",
      "Longest matching run, which is usually the most telling number",
      "Common stopword phrases excluded so coincidence does not inflate the score",
      "Nothing uploaded — both documents stay in your browser",
    ],
    faqs: [
      {
        q: "Is this a plagiarism checker?",
        a: "Not in the sense most people mean. It compares the two texts you paste in and nothing else. Checking a draft against everything ever published needs a crawled index of the web, which costs real money to build and run, so no free browser tool has one. What this does instead is the part that is genuinely doable: showing you which passages you reused from a source you already have.",
      },
      {
        q: "What counts as too much overlap?",
        a: "There is no universal threshold, and your institution may set one. As a rule of thumb, anything above about 15% that is not inside quotation marks with a citation is worth rewriting or attributing properly.",
      },
      {
        q: "Why does it find matches in two unrelated essays?",
        a: "Any two texts on the same topic share short runs of common phrasing. That is why the default match length is five words and stopword-only runs are ignored. Raise the match length if you only want longer, more meaningful overlaps.",
      },
      {
        q: "Can I check my own earlier work against a new draft?",
        a: "Yes, and that is one of the better uses for it. Self-plagiarism rules catch people out, and comparing a new draft against a previous submission is exactly what this does well.",
      },
    ],
    featured: false,
  },
  {
    id: "tone-checker",
    name: "Tone Checker",
    short: "See whether your writing reads formal, confident or critical.",
    long:
      "Estimates the register of your writing by counting the words that signal it, then shows which words drove the reading and what to change to move it towards an essay, a work email or a message to a person. It counts words rather than reading meaning, and the reading is marked weak when there is little to go on.",
    category: "writing",
    route: "/tools/tone-checker",
    keywords: [
      "tone checker", "tone analyzer", "tone detector", "writing tone",
      "formal or informal checker", "email tone checker", "free tone analyser",
    ],
    aliases: ["how does this sound", "check my tone", "is this too casual"],
    icon: "🎭",
    accent: "cherry",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["grammar-checker", "paraphrasing-tool", "readability-checker", "citation-generator"],
    seoTitle: "Free Tone Checker — Formal, Confident or Critical? | DO101",
    seoDescription:
      "Check whether your writing reads formal or casual, confident or tentative, positive or critical — and get specific advice on changing it. Free and private.",
    steps: [
      "Paste an email, essay, cover letter or message of at least 15 words.",
      "Read the three scales: register, certainty and outlook.",
      "Look at which words drove each reading.",
      "Pick who you are writing for and follow the specific suggestions.",
    ],
    features: [
      "Register, certainty and outlook on a two-ended scale each",
      "The actual words that produced each reading",
      "Advice tailored to an essay, a work email or a personal message",
      "Exclamation and question counts, and average sentence length",
      "Says when the reading is weak instead of inventing a confident answer",
    ],
    faqs: [
      {
        q: "How does it work out the tone?",
        a: "It matches your text against lists of words that tend to signal a register — \"furthermore\" and \"demonstrate\" for formal, \"stuff\" and \"kind of\" for casual — and reports the balance as a share of the signal words it found.",
      },
      {
        q: "Can it detect sarcasm?",
        a: "No. It counts words; it does not read intent or context. Sarcasm, humour and irony will all be scored on their literal wording, which is usually the opposite of what is meant.",
      },
      {
        q: "Why does it say the reading is weak?",
        a: "Because it found too few signal words to be worth trusting. That is deliberate — a confident-looking score built on two matched words would be misleading, so the tool says so instead.",
      },
    ],
    featured: false,
  },
];
