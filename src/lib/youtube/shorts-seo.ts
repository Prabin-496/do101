/**
 * YouTube Shorts SEO generator — Hinglish, for an Indian audience.
 *
 * There is no model behind this and the UI never claims one. The visitor's
 * topic is parsed into a main keyword and a niche, and every section is
 * assembled from pattern banks and then *fitted* to the length rules the
 * YouTube fields actually care about: a 45–65 character title, an 80–150 word
 * description carrying the keyword three or four times, and 300–500 characters
 * of tags. Same input and same variation number always produce the same
 * output, which is what makes the whole thing unit testable.
 *
 * Everything here is pure: no fetch, no storage, no clock beyond an optional
 * year for the tag list.
 */

export const SHORTS_SEO_LIMITS = {
  titleMinChars: 45,
  titleMaxChars: 65,
  titleHashtags: 2,
  descMinWords: 80,
  descMaxWords: 150,
  descHashtags: 5,
  descKeywordMin: 3,
  descKeywordMax: 4,
  tagsMinChars: 300,
  tagsMaxChars: 500,
  /** YouTube rejects a single tag longer than this. */
  tagMaxChars: 30,
} as const;

/* --------------------------- tiny deterministic RNG --------------------------- */

type Rnd = () => number;

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, and stable across runs and platforms. */
function makeRnd(seed: number): Rnd {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rnd: Rnd): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------- text measuring ------------------------------- */

/** Emoji ranges wide enough for the pattern banks below, used for counting. */
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;
/** Adds the variation selector and skin tones, used when cleaning input. */
const EMOJI_STRIP_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{200D}]/gu;

/** Characters as YouTube's field counters see them: code points, not UTF-16. */
export function charCount(text: string): number {
  return [...text].length;
}

/** Words, ignoring bullets and stray punctuation so the count is honest. */
export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

export function countHashtags(text: string): number {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export function countEmoji(text: string): number {
  return (text.match(EMOJI_RE) ?? []).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Non-overlapping, case-insensitive occurrences of a phrase. */
export function countPhrase(haystack: string, phrase: string): number {
  if (!phrase.trim()) return 0;
  const pattern = new RegExp(escapeRegExp(phrase).replace(/\s+/g, "\\s+"), "gi");
  return (haystack.match(pattern) ?? []).length;
}

/** Replaces occurrences of a phrase past `max` with a pronoun. Last resort. */
function limitPhrase(text: string, phrase: string, max: number, pronoun = "ye"): string {
  const pattern = new RegExp(escapeRegExp(phrase).replace(/\s+/g, "\\s+"), "gi");
  let seen = 0;
  return text.replace(pattern, (match) => {
    seen += 1;
    return seen <= max ? match : pronoun;
  });
}

/* --------------------------------- niches ---------------------------------- */

export type NicheId =
  | "tech"
  | "money"
  | "study"
  | "fitness"
  | "food"
  | "travel"
  | "motivation"
  | "entertainment"
  | "beauty"
  | "gaming"
  | "sports"
  | "career"
  | "general";

interface Niche {
  id: NicheId;
  label: string;
  /** Words that, found in the topic, identify this niche. */
  match: readonly string[];
  emoji: readonly string[];
  hashtags: readonly string[];
  /** Static, already-searched phrases people use in this niche. */
  tagSeeds: readonly string[];
  /** Bullet points for the description. Must not contain the keyword. */
  benefits: readonly string[];
}

const NICHES: readonly Niche[] = [
  {
    id: "tech",
    label: "Tech & mobile",
    match: [
      "tech", "mobile", "phone", "smartphone", "iphone", "android", "laptop", "pc", "computer",
      "gadget", "app", "ai", "chatgpt", "wifi", "router", "camera", "battery", "charging",
      "whatsapp", "setting", "settings", "windows", "google", "5g", "sim", "keyboard", "software",
    ],
    emoji: ["📱", "🔥", "🤯", "⚡", "💥", "🚀"],
    hashtags: ["#Tech", "#TechTips", "#Gadgets", "#MobileTips", "#TechHindi", "#SmartPhone"],
    tagSeeds: [
      "tech tips hindi", "mobile tips and tricks", "hidden features", "smartphone tips hindi",
      "tech shorts hindi", "android tricks", "phone settings", "tech gyan",
    ],
    benefits: [
      "Ek hidden setting jo phone me pehle se hai",
      "Bina koi app install kiye, ekdum safe tarika",
      "Android aur iPhone dono pe kaam karta hai",
      "Wo galti jo 90% log roz karte hain",
      "Puri process sirf do tap me",
    ],
  },
  {
    id: "money",
    label: "Money & finance",
    match: [
      "money", "paisa", "paise", "earn", "earning", "income", "invest", "investment", "stock",
      "share", "market", "sip", "mutual", "fund", "crypto", "bitcoin", "loan", "emi", "credit",
      "card", "tax", "gst", "itr", "bank", "upi", "saving", "savings", "salary", "business",
      "freelancing", "rupees", "budget", "insurance", "pension",
    ],
    emoji: ["💰", "📈", "💸", "🤑", "🔥", "🚨"],
    hashtags: ["#Money", "#MoneyTips", "#FinanceHindi", "#Investment", "#StockMarket", "#Savings"],
    tagSeeds: [
      "paise kaise kamaye", "money tips hindi", "investment for beginners hindi",
      "finance shorts hindi", "saving tips india", "paisa kaise bachaye", "financial freedom hindi",
    ],
    benefits: [
      "Sirf calculator aur thoda dimaag, aur kuch nahi",
      "Wo charge jo chupke se kat jata hai",
      "Chhoti amount se shuru karne ka tarika",
      "Ek galti jo poora return kha jati hai",
      "Number ke saath, sirf baaton me nahi",
    ],
  },
  {
    id: "study",
    label: "Study & exams",
    match: [
      "study", "exam", "upsc", "neet", "jee", "ssc", "class", "board", "notes", "syllabus",
      "topper", "college", "school", "revision", "maths", "physics", "chemistry", "biology",
      "english", "grammar", "gk", "student", "marks", "result", "timetable", "concentration",
    ],
    emoji: ["📚", "✍️", "🎯", "🧠", "🔥", "💯"],
    hashtags: ["#Study", "#StudyTips", "#ExamTips", "#StudentLife", "#StudyMotivation", "#StudyHindi"],
    tagSeeds: [
      "study tips hindi", "exam preparation tips", "topper study trick", "padhai kaise kare",
      "study motivation hindi", "revision technique", "student shorts hindi",
    ],
    benefits: [
      "Ek technique jo toppers chupke se use karte hain",
      "Rozana sirf 20 minute ka plan",
      "Wo mistake jo revision barbaad kar deti hai",
      "Bina ratte samajhne ka tarika",
      "Last-minute ke liye chhota checklist",
    ],
  },
  {
    id: "fitness",
    label: "Fitness & health",
    match: [
      "gym", "fitness", "weight", "fat", "muscle", "abs", "workout", "exercise", "diet",
      "protein", "yoga", "health", "sleep", "running", "belly", "calories", "stretch", "pushup",
      "immunity", "water", "posture",
    ],
    emoji: ["💪", "🔥", "🥗", "⚡", "🎯", "😤"],
    hashtags: ["#Fitness", "#GymTips", "#WeightLoss", "#HealthTips", "#FitnessHindi", "#Workout"],
    tagSeeds: [
      "fitness tips hindi", "weight loss tips hindi", "gym tips for beginners",
      "home workout hindi", "diet plan india", "healthy lifestyle hindi", "fat loss shorts",
    ],
    benefits: [
      "Ghar pe, bina equipment ke",
      "Sirf 10 minute roz, wahi kaafi hai",
      "Wo form mistake jo injury deti hai",
      "Desi khana, koi imported supplement nahi",
      "Beginner ke liye pehla hafta kaisa ho",
    ],
  },
  {
    id: "food",
    label: "Food & recipes",
    match: [
      "recipe", "food", "cooking", "kitchen", "paneer", "chai", "snack", "tiffin", "dessert",
      "cake", "biryani", "dal", "roti", "sabzi", "chutney", "masala", "street", "tasty", "khana",
      "breakfast", "lunch", "dinner", "maggi", "egg", "chicken",
    ],
    emoji: ["🍳", "🔥", "😋", "🤤", "🥘", "✨"],
    hashtags: ["#Recipe", "#FoodShorts", "#Cooking", "#EasyRecipe", "#IndianFood", "#StreetFood"],
    tagSeeds: [
      "easy recipe hindi", "quick recipe", "indian recipe shorts", "kitchen tips hindi",
      "street food india", "ghar ka khana", "cooking tips hindi", "5 minute recipe",
    ],
    benefits: [
      "Sirf ghar ki normal saamagri se",
      "10 minute me ready, ek kadhai me",
      "Wo ek step jo taste badal deta hai",
      "Bacchon ke tiffin ke liye perfect",
      "Exact masala measurement diya hai",
    ],
  },
  {
    id: "travel",
    label: "Travel",
    match: [
      "travel", "trip", "tour", "goa", "manali", "ladakh", "kashmir", "kerala", "flight", "train",
      "irctc", "hotel", "visa", "passport", "places", "trek", "beach", "airport", "tourist",
      "backpack", "itinerary", "vacation",
    ],
    emoji: ["🧳", "🌍", "🚂", "😍", "🔥", "🏝"],
    hashtags: ["#Travel", "#TravelTips", "#TravelHindi", "#IncredibleIndia", "#BudgetTravel", "#Vlog"],
    tagSeeds: [
      "travel tips hindi", "budget travel india", "cheap trip hindi", "travel vlog shorts",
      "india tourist places", "solo travel hindi", "train travel tips",
    ],
    benefits: [
      "Poora kharcha, exact number ke saath",
      "Wo booking trick jo hazaar bachati hai",
      "Kaunsa mahina jaana sahi hai",
      "Local transport ka asli rate",
      "Ek jagah jahan bheed nahi hoti",
    ],
  },
  {
    id: "motivation",
    label: "Motivation & mindset",
    match: [
      "motivation", "motivational", "success", "mindset", "discipline", "life", "failure",
      "struggle", "confidence", "habit", "habits", "focus", "procrastination", "overthinking",
      "attitude", "goal", "goals", "respect",
    ],
    emoji: ["🔥", "💯", "🎯", "🚀", "💪", "🫡"],
    hashtags: ["#Motivation", "#Mindset", "#Success", "#SelfImprovement", "#MotivationalHindi", "#Discipline"],
    tagSeeds: [
      "motivational shorts hindi", "mindset hindi", "discipline motivation", "success tips hindi",
      "self improvement hindi", "life changing advice", "motivation for students",
    ],
    benefits: [
      "Ek sawaal jo aapki soch badal dega",
      "Aaj se karne wala ek chhota kaam",
      "Wo bahana jo sabse zyada mehenga padta hai",
      "Bina bhashan, seedha point",
      "7 din ka chhota challenge",
    ],
  },
  {
    id: "entertainment",
    label: "Comedy & entertainment",
    match: [
      "comedy", "funny", "meme", "memes", "joke", "prank", "bollywood", "movie", "film", "song",
      "dance", "gossip", "series", "netflix", "actor", "actress", "trailer", "roast", "timepass",
    ],
    emoji: ["😂", "🤣", "🔥", "😱", "🎬", "💀"],
    hashtags: ["#Funny", "#Comedy", "#Bollywood", "#Entertainment", "#Trending", "#DesiComedy"],
    tagSeeds: [
      "funny shorts hindi", "comedy shorts india", "desi comedy", "bollywood shorts",
      "trending shorts hindi", "timepass video", "entertainment shorts",
    ],
    benefits: [
      "Ending tak rukna, wahi asli maza hai",
      "Ek scene jo sabne miss kar diya",
      "Bina gaali, pura family safe",
      "Sirf 20 second, timepass pakka",
      "Comment section ke liye perfect",
    ],
  },
  {
    id: "beauty",
    label: "Beauty & fashion",
    match: [
      "skin", "skincare", "hair", "haircare", "makeup", "beauty", "fashion", "outfit", "saree",
      "kurti", "glow", "face", "pimple", "acne", "dandruff", "lipstick", "styling", "nails",
      "wedding", "dupatta",
    ],
    emoji: ["✨", "💅", "💖", "🔥", "😍", "🪞"],
    hashtags: ["#Skincare", "#BeautyTips", "#Makeup", "#Fashion", "#GlowUp", "#HairCare"],
    tagSeeds: [
      "skin care tips hindi", "beauty tips hindi", "makeup tips for beginners",
      "hair care hindi", "fashion tips india", "glow up tips", "desi beauty hacks",
    ],
    benefits: [
      "Ghar ki cheezon se, kuch mehenga nahi",
      "Wo step jo sab ulta karte hain",
      "Oily aur dry dono ke liye",
      "Result kitne din me dikhega, sach me",
      "Patch test ka sahi tarika",
    ],
  },
  {
    id: "gaming",
    label: "Gaming",
    match: [
      "game", "gaming", "bgmi", "pubg", "freefire", "minecraft", "gta", "valorant", "cod",
      "montage", "gameplay", "headshot", "sensitivity", "rank", "lobby", "emulator", "controller",
    ],
    emoji: ["🎮", "🔥", "💥", "😱", "🏆", "🎯"],
    hashtags: ["#Gaming", "#BGMI", "#FreeFire", "#GamingHindi", "#Gameplay", "#ProTips"],
    tagSeeds: [
      "gaming shorts hindi", "bgmi tips", "free fire tricks", "gaming tips hindi",
      "pro settings", "gameplay shorts india", "mobile gaming hindi",
    ],
    benefits: [
      "Exact settings, number ke saath",
      "Wo ek habit jo rank push rok deti hai",
      "Low-end phone pe bhi chalega",
      "Practice drill sirf 5 minute ki",
      "Clip ke saath proof, sirf dawa nahi",
    ],
  },
  {
    id: "sports",
    label: "Cricket & sports",
    match: [
      "cricket", "ipl", "kohli", "rohit", "dhoni", "football", "wicket", "batting", "bowling",
      "hockey", "kabaddi", "olympic", "worldcup", "match", "yorker", "sixer", "team",
    ],
    emoji: ["🏏", "🔥", "💥", "🏆", "😱", "🎯"],
    hashtags: ["#Cricket", "#IPL", "#Sports", "#CricketHindi", "#TeamIndia", "#Highlights"],
    tagSeeds: [
      "cricket shorts hindi", "ipl shorts", "cricket tips hindi", "batting tips",
      "sports shorts india", "cricket analysis hindi", "match highlights shorts",
    ],
    benefits: [
      "Slow motion me poora technique",
      "Wo detail jo TV pe nahi dikhti",
      "Gully cricket me bhi try kar sakte ho",
      "Stats ke saath, sirf emotion nahi",
      "Ek drill jo ground pe kaam aati hai",
    ],
  },
  {
    id: "career",
    label: "Jobs & career",
    match: [
      "job", "jobs", "interview", "resume", "cv", "career", "sarkari", "government", "coding",
      "programming", "python", "java", "developer", "internship", "skill", "skills", "placement",
      "fresher", "linkedin", "hr", "office", "promotion", "wfh",
    ],
    emoji: ["💼", "🚀", "🎯", "💡", "🔥", "📈"],
    hashtags: ["#Career", "#JobTips", "#Interview", "#Coding", "#CareerHindi", "#Skills"],
    tagSeeds: [
      "job tips hindi", "interview tips hindi", "resume tips india", "career guidance hindi",
      "fresher job tips", "coding shorts hindi", "skill development hindi",
    ],
    benefits: [
      "Exact line jo interview me bolni hai",
      "Wo cheez jo HR sabse pehle dekhta hai",
      "Fresher ke liye bhi kaam karta hai",
      "Ek chhota portfolio plan",
      "Kitne din me result dikhta hai",
    ],
  },
  {
    id: "general",
    label: "General / anything",
    match: [],
    emoji: ["🔥", "😱", "🤯", "💯", "✨", "🚨"],
    hashtags: ["#Viral", "#Trending", "#Facts", "#Desi", "#Hindi", "#Knowledge"],
    tagSeeds: [
      "viral shorts hindi", "trending shorts india", "interesting facts hindi",
      "useful tips hindi", "gyan shorts", "daily tips hindi", "hindi shorts video",
    ],
    benefits: [
      "Seedha point, koi lambi bhoomika nahi",
      "Ek baat jo sab ignore kar dete hain",
      "Ghar pe abhi try kar sakte ho",
      "Sirf 30 second, poora samajh aayega",
      "Aakhir me ek chhota bonus tip",
    ],
  },
];

const NICHE_BY_ID: Record<NicheId, Niche> = Object.fromEntries(
  NICHES.map((n) => [n.id, n]),
) as Record<NicheId, Niche>;

/** For the tool's niche picker. "auto" is offered by the UI, not listed here. */
export const NICHE_OPTIONS: readonly { id: NicheId; label: string }[] = NICHES.map((n) => ({
  id: n.id,
  label: n.label,
}));

/* ------------------------------ shared banks ------------------------------- */

const SHORTS_HASHTAGS = ["#Shorts", "#ShortsIndia", "#ShortsViral", "#YoutubeShorts", "#ShortsFeed"];

const INDIA_HASHTAGS = ["#IndiaShorts", "#HindiShorts", "#ViralIndia", "#DesiShorts", "#Bharat"];

const GENERIC_TAGS = [
  "shorts", "youtube shorts", "shorts viral", "shorts india", "hindi shorts",
  "trending shorts", "viral shorts hindi", "shorts video", "shorts feed", "short video hindi",
  "india shorts", "desi shorts", "trending india",
];

/** Words that carry no search intent, dropped when finding the main keyword. */
const STOPWORDS = new Set([
  // English function words
  "a", "an", "the", "of", "for", "to", "in", "on", "at", "by", "with", "and", "or", "but",
  "is", "are", "was", "were", "be", "am", "do", "does", "did", "my", "your", "our", "their",
  "this", "that", "these", "those", "it", "its", "i", "you", "we", "they", "how", "what",
  "why", "when", "who", "which", "can", "will", "should", "about", "from", "as", "if", "so",
  // Hinglish particles
  "ka", "ki", "ke", "ko", "se", "me", "mein", "par", "pe", "hai", "hain", "ho", "hoga",
  "kya", "kaise", "kyu", "kyun", "aur", "ya", "ye", "yeh", "wo", "woh", "ek", "bhi", "toh",
  "na", "nahi", "mat", "kar", "karo", "karna", "karne", "kiya", "wala", "wali", "liye",
  "jo", "tha", "thi", "abhi", "bahut", "sirf", "apna", "apne", "aap", "hum", "mera", "tum",
]);

/**
 * Words that add nothing on the end of a keyword. Trimmed only when at least
 * two words survive, so "work from home" keeps its "home".
 */
const TRAILING_QUALIFIERS = new Set([
  "home", "ghar", "india", "online", "free", "easy", "fast", "today", "now", "daily", "quickly",
]);

/** Platform noise: useful as a tag, never the main keyword. */
const PLATFORM_WORDS = new Set([
  "shorts", "short", "youtube", "yt", "video", "videos", "reels", "reel", "viral", "trending",
  "subscribe", "channel", "like", "share", "comment", "vlog", "hindi", "hinglish", "india",
  "indian", "new", "latest", "best", "top", "full", "tips", "trick", "tricks", "hack", "hacks",
]);

const TITLE_PATTERNS: readonly string[] = [
  "{kw} Ka Asli Sach {e}",
  "{kw} — 30 Second Me Samjho {e}",
  "{kw} Kaise Kare? {e} Poori Trick",
  "Kya {kw} Sach Me Kaam Karta Hai {e}",
  "99% Log {kw} Galat Karte Hain {e}",
  "{kw} Ka Ye Tarika Kisi Ne Nahi Bataya {e}",
  "Ab {kw} Bilkul Easy {e}",
  "{kw}: Ye 3 Baatein Yaad Rakho {e}",
  "{kw} Try Karne Se Pehle Ye Dekho {e}",
  "Sirf 1 Minute Me {kw} {e}",
  "{kw} Ke Liye Sabse Simple Tarika {e}",
  "{kw} Me Ye Galti Mat Karna {e}",
  "{kw} Ka Poora Process, Hindi Me {e}",
  "Rukiye! {kw} Wala Ye Point Miss Ho Gaya {e}",
  "{kw} — Beginner Se Pro Tak {e}",
  "{kw} Ka Ye Sach Sunkar Hosh Udega {e}",
];

/** Short phrases used to stretch a title that lands under 45 characters. */
const TITLE_PADS: readonly string[] = [
  "Zaroor Dekho",
  "Hindi Me",
  "Step By Step",
  "Aaj Hi Try Karo",
  "Poora Samjho",
  "Ekdum Easy",
  "Full Guide",
];

/** Opening line. Carries the keyword once. */
const DESC_HOOKS: readonly string[] = [
  "{kw} samajhna hai, bina lambi bhoomika ke? Ye short exactly usi ke liye hai.",
  "{kw} ke baare me sabse zyada poocha jaane wala sawaal, seedha jawab ke saath.",
  "Agar aap {kw} pe atke ho, to ye 30 second aapka kaam kar denge.",
  "{kw} — jo baat log baad me seekhte hain, wo yahan shuru me hi bata di gayi hai.",
  "Rukiye. {kw} par kaam shuru karne se pehle ye short poora dekh lijiye.",
];

/** Second paragraph. Carries the keyword once. */
const DESC_BODIES: readonly string[] = [
  "Is short me {kw} ko step by step dikhaya gaya hai — koi bakwas nahi, sirf kaam ki baat, aur wahi cheezein jo aap aaj try kar sakte ho.",
  "Poora {kw} ka process chhote steps me toda gaya hai, saath me wo common galti bhi jo sabse zyada time barbaad karti hai.",
  "Yahan {kw} ko aasan bhasha me samjhaya gaya hai, real example ke saath, taaki dekhte hi samajh aa jaye aur turant use bhi kar sako.",
  "{kw} ke liye jo cheezein sach me matter karti hain, sirf wahi is short me rakhi gayi hain — baaki sab hata diya gaya hai.",
];

/** Audience line. Must not contain the keyword. */
const DESC_AUDIENCE: readonly string[] = [
  "Ye short India ke un viewers ke liye hai jo beginner hain aur simple Hindi-English explanation pasand karte hain.",
  "Bilkul shuru se seekhne wale logon ke liye banaya gaya hai, isliye koi bhaari technical shabd use nahi hua.",
  "Student, working professional aur side-hustle karne wale — teeno ke kaam aane wali baatein isme hain.",
];

/**
 * Search-intent line. Carries the keyword once, and fills the rest from the
 * niche's own already-searched phrases rather than chopping the keyword up.
 */
const DESC_SEARCHES: readonly string[] = [
  "Log isey aise bhi search karte hain: {kw} in hindi, {seed1}, {seed2}.",
  "Related searches: {kw} hindi me, {seed1}, {seed2}.",
  "Isi topic par aage dekhna ho to search karo: {kw} explained in hindi, {seed1}.",
];

/** Call to action. Some carry the keyword, which the fitter accounts for. */
const DESC_CTAS: readonly string[] = [
  "Video kaam aaya? Ek Like karo, channel Subscribe karo aur bell dabao — aise hi chhote, kaam ke shorts roz aate hain. Kisi dost ko {kw} ki zarurat hai? Usse share kar do.",
  "Agar samajh aaya to Like zaroor karo, Subscribe karke bell on kar lo, aur comment me batao next kis topic pe short chahiye.",
  "Ek Like isey aur logon tak pahuchata hai. Subscribe karo, bell dabao, aur ye short us dost ko bhejo jo {kw} pe ruka hua hai.",
  "Pasand aaya to Save karke rakh lo, Subscribe karo aur comment me apna sawaal likho — next short usi pe banega.",
];

/** Neutral filler used only to reach the 80-word floor. No keyword inside. */
const DESC_FILLERS: readonly string[] = [
  "Audio on rakhiye — sab kuch bola gaya hai aur screen par bhi likha hai, isliye ek baar me clear ho jata hai.",
  "Puri baat sirf 30 second me hai, isliye speed thodi tez lagegi; zarurat pade to ek baar dobara dekh lijiye.",
  "Comment section me logon ne apne experience share kiye hain, wo bhi ek baar padh lijiye — bahut kaam ki baat milti hai.",
];

const HOOK_SPOKEN: readonly string[] = [
  "Rukiye! {kw} karne se pehle ye ek baat sun lijiye.",
  "{kw} me 90% log yahi galti karte hain.",
  "3 second do, {kw} ka poora matlab samajh jaoge.",
  "Ye {kw} wala sach kisi ne nahi bataya.",
  "{kw} ka sabse aasan tarika — ye dekho.",
  "Scroll mat karo, {kw} ka answer yahi hai.",
];

const HOOK_ONSCREEN: readonly string[] = [
  "{KW} — 3 SECOND ME",
  "{KW}: YE GALTI MAT KARO",
  "{KW} KA ASLI TARIKA",
  "RUKO 👀 {KW}",
  "{KW} — 99% LOG GALAT",
];

const HOOK_FRAME: readonly string[] = [
  "Face camera ke bilkul paas, koi intro nahi — pehla shabd hi sawaal.",
  "Pehle frame me result dikhao, phir peeche jaakar process batao.",
  "Haath me object/screen pakad ke, motion ke saath shuru — frame kabhi still na ho.",
  "Bada text pehle frame me, aur bolna usi second shuru — 0.5 second bhi khaali nahi.",
];

const PINNED_COMMENTS: readonly string[] = [
  "📌 {kw} try kiya? Comment me batao kaunsa step sabse kaam aaya 👇\nAur haan — Subscribe karke bell dabao, daily aise hi chhote shorts aate hain 🔔",
  "📌 Agar {kw} pe koi sawaal reh gaya ho to yahan comment karo — main reply karta hoon 👇\nSave kar lo, baad me kaam aayega ✅",
  "📌 Sabse important baat: {kw} me jaldbaazi nahi karni. Aapka experience kya raha? Comment me likho 👇\nLike + Subscribe se bahut help hoti hai 🙏",
  "📌 {kw} ka part 2 chahiye? 100 comment ho jaye to kal hi bana dunga 👇\nTab tak Subscribe karke bell dabao 🔔",
];

/* ------------------------------ keyword parsing ----------------------------- */

export interface KeywordForms {
  /** Display form of the main keyword, up to four words. */
  main: string;
  /** Two-word form, used when the long one blows the title budget. */
  short: string;
  /** PascalCase hashtag built from the main keyword. */
  hashtag: string;
  /** Extra phrases from the rest of the input, for tags. */
  secondary: string[];
  /** Every usable word from the input, lowercased. */
  words: string[];
  /** Hashtags the visitor pasted, kept as tag material. */
  pastedTags: string[];
}

function cleanLine(line: string): string {
  return line
    .replace(EMOJI_STRIP_RE, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#@]/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Capitalises words, leaving brand casing the visitor typed alone: iPhone, GST. */
function titleCase(phrase: string): string {
  return phrase
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (/\p{Lu}/u.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/**
 * Pulls the main keyword out of whatever the visitor pasted. The first line
 * (or first comma-separated chunk) is treated as the topic, stopwords and
 * platform noise are dropped, and up to four surviving words become the
 * keyword. Everything else is kept as secondary tag material.
 */
export function parseTopic(raw: string): KeywordForms | null {
  const pastedTags = (raw.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1).toLowerCase());
  const chunks = raw
    .split(/[\n,|/•]+/)
    .map(cleanLine)
    .filter(Boolean);
  if (chunks.length === 0) return null;

  const topicWords = chunks[0].split(/\s+/).filter(Boolean);
  const meaningful = topicWords.filter((word) => {
    const lower = word.toLowerCase();
    return !STOPWORDS.has(lower) && !PLATFORM_WORDS.has(lower) && lower.length > 1;
  });
  const fallback = topicWords.filter((word) => !STOPWORDS.has(word.toLowerCase()));
  const chosen = (meaningful.length ? meaningful : fallback.length ? fallback : topicWords).slice(0, 4);
  while (chosen.length > 2 && TRAILING_QUALIFIERS.has(chosen[chosen.length - 1].toLowerCase())) {
    chosen.pop();
  }
  if (chosen.length === 0) return null;

  const main = titleCase(chosen.join(" "));
  const short = titleCase(chosen.slice(0, 2).join(" "));
  const hashtag =
    "#" +
    (chosen
      .join(" ")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("")
      .slice(0, 24) || "Shorts");

  const words = chunks
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const secondary = chunks
    .slice(1)
    .map((chunk) => chunk.toLowerCase())
    .filter((chunk) => chunk && chunk !== main.toLowerCase());

  return { main, short, hashtag, secondary, words, pastedTags };
}

/* ------------------------------ niche detection ---------------------------- */

export function detectNiche(keyword: KeywordForms): { niche: NicheId; detected: boolean } {
  const haystack = new Set([...keyword.words, ...keyword.pastedTags]);
  let best: { id: NicheId; hits: number } = { id: "general", hits: 0 };
  for (const niche of NICHES) {
    if (niche.id === "general") continue;
    let hits = 0;
    for (const term of niche.match) if (haystack.has(term)) hits += 1;
    // Substring pass catches "weightloss" or "sharemarket" written as one word.
    if (hits === 0) {
      for (const word of haystack) {
        if (word.length >= 5 && niche.match.some((term) => term.length >= 4 && word.includes(term))) {
          hits += 1;
          break;
        }
      }
    }
    if (hits > best.hits) best = { id: niche.id, hits };
  }
  return { niche: best.id, detected: best.hits > 0 };
}

/* --------------------------------- title ----------------------------------- */

export interface TitleResult {
  text: string;
  chars: number;
  emoji: number;
  hashtags: number;
  inRange: boolean;
}

function assembleTitle(body: string, emoji: string[], tags: string[]): string {
  const withEmoji = body.includes("{e}")
    ? body.replace("{e}", emoji.join(""))
    : `${body} ${emoji.join("")}`;
  return `${withEmoji} ${tags.join(" ")}`.replace(/\s+/g, " ").trim();
}

function buildTitle(keyword: KeywordForms, niche: Niche, rnd: Rnd): TitleResult {
  const { titleMinChars: min, titleMaxChars: max } = SHORTS_SEO_LIMITS;
  const patterns = shuffled(TITLE_PATTERNS, rnd);
  const emojiPool = shuffled(niche.emoji, rnd);
  const shortsTags = shuffled(SHORTS_HASHTAGS, rnd);
  const nicheTags = shuffled(niche.hashtags, rnd);

  const emojiSets = [[emojiPool[0], emojiPool[1]], [emojiPool[0]]];
  const tagPairs: string[][] = [];
  for (let i = 0; i < Math.min(3, shortsTags.length); i += 1) {
    for (let j = 0; j < Math.min(3, nicheTags.length); j += 1) {
      tagPairs.push([shortsTags[i], nicheTags[j]]);
    }
  }
  // Longest keyword form first, shorter ones only as the budget demands.
  const keywords = [...new Set([keyword.main, keyword.short, keyword.main.split(" ")[0]])];

  // Keyword form is the outer loop: every pattern is tried with the visitor's
  // full keyword before a shorter form is even considered.
  let best: { body: string; emoji: string[]; tags: string[]; score: number } | null = null;
  for (const kw of keywords) {
    for (const pattern of patterns) {
      for (const emoji of emojiSets) {
        for (const tags of tagPairs) {
          const body = pattern.replace("{kw}", kw);
          const chars = charCount(assembleTitle(body, emoji, tags));
          // In range wins outright; otherwise prefer the closest to the middle.
          const inRange = chars >= min && chars <= max;
          const score = (inRange ? 1000 : 0) - Math.abs(chars - 57);
          if (!best || score > best.score) best = { body, emoji, tags, score };
          if (inRange && chars >= 50) return measureTitle(assembleTitle(body, emoji, tags));
        }
      }
    }
  }

  const { body, emoji, tags } = best!;
  let text = assembleTitle(body, emoji, tags);
  if (charCount(text) > max) text = trimTitle(body, emoji, tags);
  if (charCount(text) < min) text = padTitle(text, rnd);
  return measureTitle(text);
}

/** Inserts a short Hinglish phrase before the hashtags to reach the floor. */
function padTitle(title: string, rnd: Rnd): string {
  const { titleMinChars: min, titleMaxChars: max } = SHORTS_SEO_LIMITS;
  const tags = title.match(/#[\p{L}\p{N}_]+(\s+#[\p{L}\p{N}_]+)*$/u)?.[0] ?? "";
  let head = tags ? title.slice(0, title.length - tags.length).trim() : title;
  for (const pad of shuffled(TITLE_PADS, rnd)) {
    const candidate = `${head} — ${pad}`;
    const full = `${candidate} ${tags}`.trim();
    if (charCount(full) <= max) {
      head = candidate;
      if (charCount(full) >= min) break;
    }
  }
  return `${head} ${tags}`.replace(/\s+/g, " ").trim();
}

/**
 * Drops words off the end of the text part until the title fits, then falls
 * back to one emoji, then to cutting a single enormous word. The emoji and
 * both hashtags always survive.
 */
function trimTitle(body: string, emoji: string[], tags: string[]): string {
  const { titleMaxChars: max } = SHORTS_SEO_LIMITS;
  // The emoji moves to the end here so word-dropping cannot eat it.
  const plain = body.replace("{e}", "").replace(/\s+/g, " ").trim();
  const emojiSets = emoji.length > 1 ? [emoji, [emoji[0]]] : [emoji];
  for (const set of emojiSets) {
    const words = plain.split(" ");
    while (words.length > 1) {
      const candidate = assembleTitle(words.join(" "), set, tags);
      if (charCount(candidate) <= max) return candidate;
      words.pop();
    }
    const single = assembleTitle(words.join(" "), set, tags);
    if (charCount(single) <= max) return single;
  }
  const set = [emoji[0]];
  const budget = max - charCount(`${set.join("")} ${tags.join(" ")}`) - 1;
  const word = plain.split(" ")[0] ?? plain;
  return assembleTitle([...word].slice(0, Math.max(3, budget)).join("").trim(), set, tags);
}

function measureTitle(text: string): TitleResult {
  const chars = charCount(text);
  return {
    text,
    chars,
    emoji: countEmoji(text),
    hashtags: countHashtags(text),
    inRange: chars >= SHORTS_SEO_LIMITS.titleMinChars && chars <= SHORTS_SEO_LIMITS.titleMaxChars,
  };
}

/* ------------------------------- description -------------------------------- */

export interface DescriptionResult {
  text: string;
  words: number;
  keywordCount: number;
  hashtags: number;
  hashtagLine: string;
  inRange: boolean;
}

function buildHashtagLine(keyword: KeywordForms, niche: Niche, rnd: Rnd): string {
  const wanted = SHORTS_SEO_LIMITS.descHashtags;
  const pool = [
    shuffled(SHORTS_HASHTAGS, rnd)[0],
    ...shuffled(niche.hashtags, rnd).slice(0, 2),
    shuffled(INDIA_HASHTAGS, rnd)[0],
    keyword.hashtag,
    ...shuffled(NICHE_BY_ID.general.hashtags, rnd),
  ];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of pool) {
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === wanted) break;
  }
  return tags.join(" ");
}

function fill(template: string, keyword: KeywordForms): string {
  return template
    .replace(/\{kwShort\}/g, keyword.short)
    .replace(/\{kw\}/g, keyword.main)
    .replace(/\{KW\}/g, keyword.main.toUpperCase());
}

function assembleDescription(parts: {
  hook: string;
  body: string;
  benefits: string[];
  audience?: string;
  search: string;
  filler?: string;
  cta: string;
  hashtagLine: string;
}): string {
  const blocks: string[] = [
    parts.hook,
    parts.body,
    ["Is short me kya milega:", ...parts.benefits.map((b) => `• ${b}`)].join("\n"),
  ];
  if (parts.audience) blocks.push(parts.audience);
  if (parts.filler) blocks.push(parts.filler);
  blocks.push(parts.search, parts.cta, parts.hashtagLine);
  return blocks.join("\n\n");
}

function measureDescription(text: string, keyword: string, hashtagLine: string): DescriptionResult {
  const words = wordCount(text);
  const keywordCount = countPhrase(text, keyword);
  const hashtags = countHashtags(text);
  const { descMinWords, descMaxWords, descKeywordMin, descKeywordMax, descHashtags } =
    SHORTS_SEO_LIMITS;
  return {
    text,
    words,
    keywordCount,
    hashtags,
    hashtagLine,
    inRange:
      words >= descMinWords &&
      words <= descMaxWords &&
      keywordCount >= descKeywordMin &&
      keywordCount <= descKeywordMax &&
      hashtags === descHashtags,
  };
}

function buildDescription(keyword: KeywordForms, niche: Niche, rnd: Rnd): DescriptionResult {
  const hashtagLine = buildHashtagLine(keyword, niche, rnd);
  const hooks = shuffled(DESC_HOOKS, rnd).map((t) => fill(t, keyword));
  const bodies = shuffled(DESC_BODIES, rnd).map((t) => fill(t, keyword));
  const benefits = shuffled(niche.benefits, rnd).slice(0, 3);
  const audiences = shuffled(DESC_AUDIENCE, rnd);
  const seeds = shuffled(niche.tagSeeds, rnd);
  const searches = shuffled(DESC_SEARCHES, rnd).map((t) =>
    fill(t, keyword).replace("{seed1}", seeds[0]).replace("{seed2}", seeds[1]),
  );
  const ctas = shuffled(DESC_CTAS, rnd).map((t) => fill(t, keyword));
  const fillers = shuffled(DESC_FILLERS, rnd);

  let fallback: DescriptionResult | null = null;
  for (const hook of hooks) {
    for (const body of bodies) {
      for (const search of searches) {
        for (const cta of ctas) {
          for (const audience of [audiences[0], undefined]) {
            for (const filler of [undefined, fillers[0], fillers[1]]) {
              const text = assembleDescription({
                hook, body, benefits, audience, search, filler, cta, hashtagLine,
              });
              const result = measureDescription(text, keyword.main, hashtagLine);
              if (result.inRange) return result;
              if (!fallback || score(result) > score(fallback)) fallback = result;
            }
          }
        }
      }
    }
  }
  return repairDescription(fallback!, keyword, fillers);
}

/** How close a description is to every rule at once. Higher is better. */
function score(result: DescriptionResult): number {
  const { descMinWords, descMaxWords, descKeywordMin, descKeywordMax } = SHORTS_SEO_LIMITS;
  const wordMiss =
    result.words < descMinWords
      ? descMinWords - result.words
      : result.words > descMaxWords
        ? result.words - descMaxWords
        : 0;
  const kwMiss =
    result.keywordCount < descKeywordMin
      ? descKeywordMin - result.keywordCount
      : result.keywordCount > descKeywordMax
        ? result.keywordCount - descKeywordMax
        : 0;
  return -wordMiss - kwMiss * 20;
}

/**
 * Last resort when no combination satisfied every rule at once — which happens
 * with keywords whose own words repeat inside the template text. Repairs the
 * keyword density first, then the word count.
 */
function repairDescription(
  result: DescriptionResult,
  keyword: KeywordForms,
  fillers: readonly string[],
): DescriptionResult {
  const { descMinWords, descMaxWords, descKeywordMin, descKeywordMax } = SHORTS_SEO_LIMITS;
  let text = result.text;

  if (countPhrase(text, keyword.main) > descKeywordMax) {
    text = limitPhrase(text, keyword.main, descKeywordMax);
  }
  let guard = 0;
  while (countPhrase(text, keyword.main) < descKeywordMin && guard < 4) {
    text = text.replace(
      /\n\n(#[\p{L}\p{N}_]+.*)$/u,
      `\n\nPoora ${keyword.main} ka process isi short me hai.\n\n$1`,
    );
    guard += 1;
    if (countPhrase(text, keyword.main) < descKeywordMin && guard === 4) break;
  }

  let fillerIndex = 0;
  while (wordCount(text) < descMinWords && fillerIndex < fillers.length) {
    text = text.replace(/\n\n(#[\p{L}\p{N}_]+.*)$/u, `\n\n${fillers[fillerIndex]}\n\n$1`);
    fillerIndex += 1;
  }
  while (wordCount(text) > descMaxWords) {
    const before = text;
    text = text.replace(/\n\n[^\n#•][^\n]*(?=\n\n)/, "");
    if (text === before) break;
  }

  return measureDescription(text, keyword.main, result.hashtagLine);
}

/* ----------------------------------- tags ----------------------------------- */

export interface TagsResult {
  list: string[];
  text: string;
  chars: number;
  inRange: boolean;
}

const TAG_MODIFIERS: readonly string[] = [
  "in hindi", "hindi me", "shorts", "short video", "tips", "tips and tricks", "kaise kare",
  "for beginners", "india", "explained", "step by step", "guide", "basics", "hindi shorts",
];

function buildTags(keyword: KeywordForms, niche: Niche, rnd: Rnd, year: number): TagsResult {
  const kw = keyword.main.toLowerCase();
  const kwShort = keyword.short.toLowerCase();
  // Most specific first: the tag list is filled in this order and cut off when
  // it reaches YouTube's character budget, so the weakest tags go last.
  const candidates: string[] = [
    kw,
    ...(kwShort !== kw ? [kwShort] : []),
    `${kw} ${year}`,
    ...shuffled(TAG_MODIFIERS, rnd).map((mod) => `${kw} ${mod}`),
    ...keyword.secondary,
    ...keyword.pastedTags.filter((t) => t.length > 2),
    ...shuffled(niche.tagSeeds, rnd),
    ...(kwShort !== kw ? shuffled(TAG_MODIFIERS, rnd).map((mod) => `${kwShort} ${mod}`) : []),
    ...shuffled(GENERIC_TAGS, rnd),
  ];

  const { tagsMinChars, tagsMaxChars, tagMaxChars } = SHORTS_SEO_LIMITS;
  const seen = new Set<string>();
  const list: string[] = [];
  let chars = 0;
  for (const raw of candidates) {
    const tag = raw.replace(/\s+/g, " ").trim().toLowerCase();
    // The main keyword goes in whatever its length; the rest respect the cap.
    if (!tag || seen.has(tag) || (list.length > 0 && charCount(tag) > tagMaxChars)) continue;
    const added = chars === 0 ? charCount(tag) : chars + 2 + charCount(tag);
    if (added > tagsMaxChars) continue;
    seen.add(tag);
    list.push(tag);
    chars = added;
    if (chars >= tagsMinChars + 120) break;
  }

  const text = list.join(", ");
  const finalChars = charCount(text);
  return {
    list,
    text,
    chars: finalChars,
    inRange: finalChars >= tagsMinChars && finalChars <= tagsMaxChars,
  };
}

/* -------------------------------- hook + rest ------------------------------- */

export interface HookResult {
  spoken: string;
  onScreen: string;
  firstFrame: string;
  text: string;
}

function buildHook(keyword: KeywordForms, rnd: Rnd): HookResult {
  const spoken = fill(shuffled(HOOK_SPOKEN, rnd)[0], keyword);
  const onScreen = fill(shuffled(HOOK_ONSCREEN, rnd)[0], keyword);
  const firstFrame = shuffled(HOOK_FRAME, rnd)[0];
  return {
    spoken,
    onScreen,
    firstFrame,
    text: [
      `Bolna (0–3 sec): ${spoken}`,
      `Screen par text: ${onScreen}`,
      `Pehla frame: ${firstFrame}`,
    ].join("\n"),
  };
}

export interface ChecklistItem {
  text: string;
  /** True when DO101 measured this from the output instead of advising it. */
  measured: boolean;
  ok?: boolean;
}

function buildChecklist(
  keyword: KeywordForms,
  title: TitleResult,
  description: DescriptionResult,
  tags: TagsResult,
): ChecklistItem[] {
  const { titleMinChars, titleMaxChars, descMinWords, descMaxWords, tagsMinChars, tagsMaxChars } =
    SHORTS_SEO_LIMITS;
  return [
    {
      text: `Title ${title.chars} characters ka hai (${titleMinChars}–${titleMaxChars} sweet spot)`,
      measured: true,
      ok: title.inRange,
    },
    {
      text: `Title me ${title.hashtags} hashtag aur ${title.emoji} emoji — #Shorts andar hai`,
      measured: true,
      ok: title.hashtags === 2 && title.emoji >= 1 && title.emoji <= 2 && /#\w*[Ss]horts/.test(title.text),
    },
    {
      text: `"${keyword.main}" description me ${description.keywordCount} baar aaya hai (3–4 sahi hai)`,
      measured: true,
      ok: description.keywordCount >= 3 && description.keywordCount <= 4,
    },
    {
      text: `Description ${description.words} words ka hai (${descMinWords}–${descMaxWords})`,
      measured: true,
      ok: description.words >= descMinWords && description.words <= descMaxWords,
    },
    {
      text: `Description me exactly ${description.hashtags} hashtag hain`,
      measured: true,
      ok: description.hashtags === 5,
    },
    {
      text: `Tags ${tags.chars} characters ke hain (${tagsMinChars}–${tagsMaxChars} limit)`,
      measured: true,
      ok: tags.inRange,
    },
    { text: "Video vertical hai: 1080×1920, 9:16, aur 60 second se kam", measured: false },
    { text: "Pehle 3 second me keyword bola bhi gaya hai, sirf likha nahi", measured: false },
    { text: "Pehle frame me bada text — mute viewer ko bhi samajh aaye", measured: false },
    { text: "Upload ke 10 minute ke andar pinned comment daal diya", measured: false },
    { text: "Upload time India ke liye: shaam 7 se raat 10 baje (IST)", measured: false },
    { text: "Pehle 10 comments ka reply diya — retention aur reach dono badhti hai", measured: false },
    { text: "Trending audio use kiya, lekin apni awaaz bhi sunai de rahi hai", measured: false },
  ];
}

/* --------------------------------- assembly -------------------------------- */

export interface ShortsSeoResult {
  keyword: KeywordForms;
  niche: NicheId;
  nicheLabel: string;
  nicheDetected: boolean;
  variation: number;
  title: TitleResult;
  description: DescriptionResult;
  tags: TagsResult;
  pinnedComment: string;
  hook: HookResult;
  checklist: ChecklistItem[];
  /** Every section in one block, for the Copy all button. */
  copyAll: string;
}

export interface ShortsSeoOptions {
  /** "auto" detects the niche from the topic. */
  niche?: NicheId | "auto";
  /** Bump for a different set of patterns from the same topic. */
  variation?: number;
  /** Injectable so tests do not depend on the calendar. */
  year?: number;
}

/**
 * Generates every section from a pasted topic. Returns null when the input has
 * no usable word in it, which the UI reports rather than inventing a keyword.
 */
export function generateShortsSeo(
  raw: string,
  options: ShortsSeoOptions = {},
): ShortsSeoResult | null {
  const keyword = parseTopic(raw);
  if (!keyword) return null;

  const variation = Math.max(0, Math.floor(options.variation ?? 0));
  const auto = detectNiche(keyword);
  const nicheId = !options.niche || options.niche === "auto" ? auto.niche : options.niche;
  const niche = NICHE_BY_ID[nicheId] ?? NICHE_BY_ID.general;
  const year = options.year ?? new Date().getFullYear();

  // One seed per (topic, niche, variation) so output is reproducible, and a
  // fresh stream per section so changing one bank cannot shift the others.
  const seed = hashString(`${keyword.main}|${niche.id}|${variation}`);
  const title = buildTitle(keyword, niche, makeRnd(seed));
  const description = buildDescription(keyword, niche, makeRnd(seed ^ 0x9e3779b9));
  const tags = buildTags(keyword, niche, makeRnd(seed ^ 0x85ebca6b), year);
  const pinnedComment = fill(shuffled(PINNED_COMMENTS, makeRnd(seed ^ 0xc2b2ae35))[0], keyword);
  const hook = buildHook(keyword, makeRnd(seed ^ 0x27d4eb2f));
  const checklist = buildChecklist(keyword, title, description, tags);

  const copyAll = [
    `TITLE (${title.chars} characters)`,
    title.text,
    "",
    `DESCRIPTION (${description.words} words)`,
    description.text,
    "",
    `TAGS (${tags.chars} characters)`,
    tags.text,
    "",
    "PINNED COMMENT",
    pinnedComment,
    "",
    "HOOK — FIRST 3 SECONDS",
    hook.text,
    "",
    "SEO CHECKLIST",
    ...checklist.map((item) => `${item.measured ? (item.ok ? "[x]" : "[!]") : "[ ]"} ${item.text}`),
    "",
    `Generated locally with DO101 — youtube-shorts-seo · keyword: ${keyword.main} · niche: ${niche.label}`,
  ].join("\n");

  return {
    keyword,
    niche: niche.id,
    nicheLabel: niche.label,
    nicheDetected: auto.detected,
    variation,
    title,
    description,
    tags,
    pinnedComment,
    hook,
    checklist,
    copyAll,
  };
}
