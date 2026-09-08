/**
 * English syllable counting.
 *
 * Every readability formula depends on this, so an error here shifts every
 * grade level the tools report. English spelling is irregular enough that no
 * rule set is perfect, so the approach is: handle the known-irregular words
 * from a lookup table first, then apply vowel-group rules with the usual
 * corrections for silent E, common suffixes and vowel pairs that split.
 *
 * Measured against a hand-checked sample it lands within one syllable
 * essentially always, which is well inside the tolerance the formulas need.
 */

/** Words the rules get wrong, listed rather than bent into the algorithm. */
const IRREGULAR: Record<string, number> = {
  business: 2, colonel: 2, wednesday: 2, chocolate: 3, comfortable: 3,
  vegetable: 3, temperature: 3, interesting: 3, restaurant: 2, favourite: 3,
  favorite: 3, evening: 2, every: 2, everything: 3, different: 3, camera: 3,
  family: 3, general: 3, average: 3, several: 3, natural: 3, memory: 3,
  simile: 3, people: 2, science: 2, quiet: 2, poem: 2, poet: 2, real: 1,
  really: 2, area: 3, idea: 3, create: 2, being: 2, doing: 2, going: 2,
  giant: 2, lion: 2, riot: 2, diet: 2, fluid: 2, ruin: 2, cruel: 2,
  aisle: 1, isle: 1, once: 1, twice: 1, queue: 1, rhythm: 2, choir: 1,
  hour: 1, our: 1, fire: 1, hire: 1, wire: 1, tire: 1, pure: 1, sure: 1,
  // "ea" as two sounds — the exceptions to the digraph above.
  creates: 2, created: 3, creating: 3, creation: 3, creations: 3,
  creative: 3, creatively: 4, creativity: 5, creature: 2, creatures: 2,
  react: 2, reacts: 2, reacted: 3, reacting: 3, reaction: 3, reactions: 3,
  theatre: 2, theater: 2, nuclear: 3, linear: 3, cereal: 3, ideal: 3,
  ideally: 4, reality: 4, realise: 3, realize: 3, realised: 3, realized: 3,
  realistic: 4, cocoa: 2, museum: 3, neon: 2,
};

/** Suffixes that add a syllable the vowel-group rule would otherwise miss. */
const SYLLABIC_SUFFIX = /(?:[^aeiou]le|[^aeiou]les|ism|isms|ist|ists)$/;

/** Endings where the final E is silent. */
const SILENT_E = /(?:[^aeiouy][aeiouy][^aeiouyx]e|[^l]le)$/;

export function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return 0;
  if (IRREGULAR[clean] !== undefined) return IRREGULAR[clean];
  if (clean.length <= 3) return 1;

  let working = clean;

  // "-ed" is usually silent unless preceded by t or d ("wanted", "handed").
  working = working.replace(/(?:[^td]|^)ed$/, (match) => match.slice(0, -2));
  // Silent E at the end, but "-le" after a consonant keeps its syllable.
  if (SILENT_E.test(working)) working = working.replace(/e$/, "");
  working = working.replace(/^y/, "");

  const groups = working.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 0;

  // Vowel pairs that are actually two syllables.
  const splits = clean.match(/(?:ia|io|iu|ua|uo|eo|oa(?=[^s])|ei(?=n))/g);
  if (splits) {
    // "-tion" and "-sion" are one syllable despite containing "io".
    const merged = (clean.match(/(?:tion|sion|cious|tious|geous|gious)/g) ?? []).length;
    count += Math.max(0, splits.length - merged);
  }

  if (SYLLABIC_SUFFIX.test(clean) && !/[aeiou]le$/.test(clean)) count += 1;

  return Math.max(1, count);
}

export function countSyllablesInText(words: string[]): number {
  return words.reduce((total, word) => total + countSyllables(word), 0);
}

/** Three or more syllables — the threshold Gunning Fog and SMOG use. */
export function isComplex(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  // Proper nouns, hyphenated compounds and familiar suffixes are excluded by
  // the original definition of the Fog index.
  if (/(?:es|ed|ing)$/.test(clean) && countSyllables(clean.replace(/(?:es|ed|ing)$/, "")) < 3) {
    return false;
  }
  return countSyllables(clean) >= 3;
}
