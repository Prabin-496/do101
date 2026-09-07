import type { NewsCategory, NewsSource } from "./types";

/**
 * Every feed DO101 reads.
 *
 * All of them are public RSS or Atom feeds published by the source itself for
 * exactly this purpose. Each was fetched and parsed successfully before being
 * added — none is here on the assumption that it works.
 *
 * DO101 stores headlines, timestamps and a short excerpt, then links to the
 * publisher. Full articles are never copied.
 */
export const NEWS_SOURCES: NewsSource[] = [
  { id: "ai-business", name: "AI Business", url: "https://aibusiness.com/rss.xml", site: "https://aibusiness.com", category: "ai" },
  { id: "aws-ml-blog", name: "AWS ML Blog", url: "https://aws.amazon.com/blogs/machine-learning/feed/", site: "https://aws.amazon.com", category: "ai" },
  { id: "deepmind", name: "DeepMind", url: "https://deepmind.google/blog/rss.xml", site: "https://deepmind.google", category: "ai" },
  { id: "google-ai-blog", name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", site: "https://blog.google", category: "ai" },
  { id: "hugging-face", name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", site: "https://huggingface.co", category: "ai" },
  { id: "import-ai", name: "Import AI", url: "https://importai.substack.com/feed", site: "https://importai.substack.com", category: "ai" },
  { id: "machine-learning-mastery", name: "Machine Learning Mastery", url: "https://machinelearningmastery.com/blog/feed/", site: "https://machinelearningmastery.com", category: "ai" },
  { id: "mit-tech-review-ai", name: "MIT Tech Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", site: "https://www.technologyreview.com", category: "ai" },
  { id: "nvidia-blog", name: "NVIDIA Blog", url: "https://blogs.nvidia.com/feed/", site: "https://blogs.nvidia.com", category: "ai" },
  { id: "openai-blog", name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", site: "https://openai.com", category: "ai" },
  { id: "the-gradient", name: "The Gradient", url: "https://thegradient.pub/rss/", site: "https://thegradient.pub", category: "ai" },
  { id: "towards-data-science", name: "Towards Data Science", url: "https://towardsdatascience.com/feed", site: "https://towardsdatascience.com", category: "ai" },
  { id: "9to5mac", name: "9to5Mac", url: "https://9to5mac.com/feed/", site: "https://9to5mac.com", category: "tech" },
  { id: "android-police", name: "Android Police", url: "https://www.androidpolice.com/feed/", site: "https://www.androidpolice.com", category: "tech" },
  { id: "ars-technica", name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", site: "https://feeds.arstechnica.com", category: "tech" },
  { id: "bbc-technology", name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", site: "https://feeds.bbci.co.uk", category: "tech" },
  { id: "cnet", name: "CNET", url: "https://www.cnet.com/rss/news/", site: "https://www.cnet.com", category: "tech" },
  { id: "digital-trends", name: "Digital Trends", url: "https://www.digitaltrends.com/feed/", site: "https://www.digitaltrends.com", category: "tech" },
  { id: "engadget", name: "Engadget", url: "https://www.engadget.com/rss.xml", site: "https://www.engadget.com", category: "tech" },
  { id: "gizmodo", name: "Gizmodo", url: "https://gizmodo.com/feed", site: "https://gizmodo.com", category: "tech" },
  { id: "guardian-technology", name: "Guardian Technology", url: "https://www.theguardian.com/uk/technology/rss", site: "https://www.theguardian.com", category: "tech" },
  { id: "hacker-news", name: "Hacker News", url: "https://hnrss.org/frontpage", site: "https://hnrss.org", category: "tech" },
  { id: "mit-technology-review", name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", site: "https://www.technologyreview.com", category: "tech" },
  { id: "slashdot", name: "Slashdot", url: "https://rss.slashdot.org/Slashdot/slashdotMain", site: "https://rss.slashdot.org", category: "tech" },
  { id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/", site: "https://techcrunch.com", category: "tech" },
  { id: "techmeme", name: "Techmeme", url: "https://www.techmeme.com/feed.xml", site: "https://www.techmeme.com", category: "tech" },
  { id: "techradar", name: "TechRadar", url: "https://www.techradar.com/rss", site: "https://www.techradar.com", category: "tech" },
  { id: "the-verge", name: "The Verge", url: "https://www.theverge.com/rss/index.xml", site: "https://www.theverge.com", category: "tech" },
  { id: "tom-s-hardware", name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all", site: "https://www.tomshardware.com", category: "tech" },
  { id: "wired", name: "Wired", url: "https://www.wired.com/feed/rss", site: "https://www.wired.com", category: "tech" },
  { id: "cloudflare-blog", name: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/", site: "https://blog.cloudflare.com", category: "dev" },
  { id: "css-tricks", name: "CSS-Tricks", url: "https://css-tricks.com/feed/", site: "https://css-tricks.com", category: "dev" },
  { id: "dev-to", name: "Dev.to", url: "https://dev.to/feed", site: "https://dev.to", category: "dev" },
  { id: "github-blog", name: "GitHub Blog", url: "https://github.blog/feed/", site: "https://github.blog", category: "dev" },
  { id: "google-dev-blog", name: "Google Dev Blog", url: "https://developers.googleblog.com/feeds/posts/default", site: "https://developers.googleblog.com", category: "dev" },
  { id: "hacker-noon", name: "Hacker Noon", url: "https://hackernoon.com/feed", site: "https://hackernoon.com", category: "dev" },
  { id: "infoq", name: "InfoQ", url: "https://feed.infoq.com/", site: "https://feed.infoq.com", category: "dev" },
  { id: "mozilla-hacks", name: "Mozilla Hacks", url: "https://hacks.mozilla.org/feed/", site: "https://hacks.mozilla.org", category: "dev" },
  { id: "node-weekly", name: "Node Weekly", url: "https://nodeweekly.com/rss", site: "https://nodeweekly.com", category: "dev" },
  { id: "smashing-magazine", name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/", site: "https://www.smashingmagazine.com", category: "dev" },
  { id: "stack-overflow-blog", name: "Stack Overflow Blog", url: "https://stackoverflow.blog/feed/", site: "https://stackoverflow.blog", category: "dev" },
  { id: "vercel-blog", name: "Vercel Blog", url: "https://vercel.com/atom", site: "https://vercel.com", category: "dev" },
  { id: "web-dev", name: "Web.dev", url: "https://web.dev/static/blog/feed.xml", site: "https://web.dev", category: "dev" },
  { id: "bitcoin-magazine", name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/", site: "https://bitcoinmagazine.com", category: "crypto" },
  { id: "bitcoinist", name: "Bitcoinist", url: "https://bitcoinist.com/feed/", site: "https://bitcoinist.com", category: "crypto" },
  { id: "coindesk", name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", site: "https://www.coindesk.com", category: "crypto" },
  { id: "cointelegraph", name: "Cointelegraph", url: "https://cointelegraph.com/rss", site: "https://cointelegraph.com", category: "crypto" },
  { id: "cryptoslate", name: "CryptoSlate", url: "https://cryptoslate.com/feed/", site: "https://cryptoslate.com", category: "crypto" },
  { id: "decrypt", name: "Decrypt", url: "https://decrypt.co/feed", site: "https://decrypt.co", category: "crypto" },
  { id: "newsbtc", name: "NewsBTC", url: "https://www.newsbtc.com/feed/", site: "https://www.newsbtc.com", category: "crypto" },
  { id: "the-block", name: "The Block", url: "https://www.theblock.co/rss.xml", site: "https://www.theblock.co", category: "crypto" },
  { id: "cnbc-finance", name: "CNBC Finance", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", site: "https://search.cnbc.com", category: "finance" },
  { id: "financial-times-tech", name: "Financial Times Tech", url: "https://www.ft.com/technology?format=rss", site: "https://www.ft.com", category: "finance" },
  { id: "investing-com", name: "Investing.com", url: "https://www.investing.com/rss/news.rss", site: "https://www.investing.com", category: "finance" },
  { id: "marketwatch", name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", site: "https://feeds.content.dowjones.io", category: "finance" },
  { id: "seeking-alpha", name: "Seeking Alpha", url: "https://seekingalpha.com/market_currents.xml", site: "https://seekingalpha.com", category: "finance" },
  { id: "yahoo-finance", name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex", site: "https://finance.yahoo.com", category: "finance" },
  { id: "crunchbase-news", name: "Crunchbase News", url: "https://news.crunchbase.com/feed/", site: "https://news.crunchbase.com", category: "startups" },
  { id: "product-hunt", name: "Product Hunt", url: "https://www.producthunt.com/feed", site: "https://www.producthunt.com", category: "startups" },
  { id: "sifted", name: "Sifted", url: "https://sifted.eu/feed", site: "https://sifted.eu", category: "startups" },
  { id: "techcrunch-startups", name: "TechCrunch Startups", url: "https://techcrunch.com/category/startups/feed/", site: "https://techcrunch.com", category: "startups" },
  { id: "y-combinator-blog", name: "Y Combinator Blog", url: "https://www.ycombinator.com/blog/rss", site: "https://www.ycombinator.com", category: "startups" },
  { id: "bleepingcomputer", name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", site: "https://www.bleepingcomputer.com", category: "security" },
  { id: "dark-reading", name: "Dark Reading", url: "https://www.darkreading.com/rss.xml", site: "https://www.darkreading.com", category: "security" },
  { id: "krebs-on-security", name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", site: "https://krebsonsecurity.com", category: "security" },
  { id: "schneier-on-security", name: "Schneier on Security", url: "https://www.schneier.com/feed/atom/", site: "https://www.schneier.com", category: "security" },
  { id: "the-hacker-news", name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", site: "https://feeds.feedburner.com", category: "security" },
  { id: "ieee-spectrum", name: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/feed.rss", site: "https://spectrum.ieee.org", category: "science" },
  { id: "nasa", name: "NASA", url: "https://www.nasa.gov/news-release/feed/", site: "https://www.nasa.gov", category: "science" },
  { id: "nature", name: "Nature", url: "https://www.nature.com/nature.rss", site: "https://www.nature.com", category: "science" },
  { id: "phys-org", name: "Phys.org", url: "https://phys.org/rss-feed/", site: "https://phys.org", category: "science" },
  { id: "quanta-magazine", name: "Quanta Magazine", url: "https://api.quantamagazine.org/feed/", site: "https://api.quantamagazine.org", category: "science" },
  { id: "scientific-american", name: "Scientific American", url: "https://www.scientificamerican.com/platform/syndication/rss/", site: "https://www.scientificamerican.com", category: "science" },
  { id: "space-com", name: "Space.com", url: "https://www.space.com/feeds/all", site: "https://www.space.com", category: "science" },
];

export const SOURCE_COUNT = NEWS_SOURCES.length;

export function sourcesFor(category: NewsCategory | "all"): NewsSource[] {
  return category === "all" ? NEWS_SOURCES : NEWS_SOURCES.filter((s) => s.category === category);
}

export function sourceById(id: string): NewsSource | undefined {
  return NEWS_SOURCES.find((s) => s.id === id);
}
