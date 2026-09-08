import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "writing",
  path: "/writing",
  title: "Free Writing Tools for Students — Grammar, Citations, Readability | DO101",
  description:
    "Six free writing tools: grammar and spelling checker, paraphraser, readability scores, citation generator for APA/MLA/Harvard, text similarity checker and tone checker. No account, no word limit, nothing uploaded.",
  heading: "Writing tools",
  lead:
    "A free alternative to the paid writing assistants, built for essays, reports and assignments. No account, no word limit, no trial that expires — and your work never leaves your browser.",
  body: [
    {
      heading: "Why these are free, and what the catch is",
      text: (
        <>
          <p>
            The paid writing assistants charge because they run trained language models on
            their own servers, and that costs real money per document. These tools do
            something different: they ship a rule engine to your browser and run it there.
            Serving a rule engine costs the same whether ten people use it or ten thousand,
            which is why there is nothing to charge for and no word limit to enforce.
          </p>
          <p>
            The honest trade-off is coverage. A rule-based checker finds mistakes that follow
            recognisable patterns — misspellings, punctuation, agreement, wordy phrasing,
            passive voice. It cannot parse a sentence or understand what you meant, so it will
            miss errors that need context and it will occasionally flag something correct.
            Every tool here says which of those it is doing, and every suggestion can be
            ignored.
          </p>
        </>
      ),
    },
    {
      heading: "What each tool actually does",
      text: (
        <>
          <p>
            <strong><Link href="/tools/grammar-checker">Grammar &amp; Spelling Checker</Link>:</strong>{" "}
            underlines mistakes in place as you type, explains each one, and fixes the
            unambiguous ones in a click. Spelling includes the inflected forms, so
            &ldquo;recieved&rdquo; is caught as well as &ldquo;recieve&rdquo;.
          </p>
          <p>
            <strong><Link href="/tools/paraphrasing-tool">Paraphrasing Tool</Link>:</strong>{" "}
            four rewriting modes, with every edit listed and reversible. It substitutes
            wording — &ldquo;due to the fact that&rdquo; becomes &ldquo;because&rdquo; — rather
            than restating ideas, and it says so.
          </p>
          <p>
            <strong><Link href="/tools/citation-generator">Citation Generator</Link>:</strong>{" "}
            APA 7, MLA 9, Harvard, Chicago, IEEE and Vancouver, each implemented against its
            own published rules. Italics survive the copy, so references paste into Word
            already formatted.
          </p>
          <p>
            <strong><Link href="/tools/readability-checker">Readability Checker</Link>:</strong>{" "}
            six published formulas plus the sentence rhythm none of them report.
          </p>
          <p>
            <strong><Link href="/tools/text-similarity-checker">Text Similarity Checker</Link>:</strong>{" "}
            compares two documents you supply and highlights every overlapping passage.
          </p>
          <p>
            <strong><Link href="/tools/tone-checker">Tone Checker</Link>:</strong>{" "}
            estimates register, certainty and outlook from word choice, and tells you when
            it does not have enough signal to be confident.
          </p>
        </>
      ),
    },
    {
      heading: "On plagiarism, and what we will not pretend to do",
      text: (
        <>
          <p>
            A real plagiarism checker compares your work against a crawled index of the web
            and a database of submitted student papers. Building and running that index costs
            a great deal of money, which is why the services that offer it charge for it. Any
            free tool claiming to scan &ldquo;billions of web pages&rdquo; is either not doing
            that or is funded by something it is not telling you about.
          </p>
          <p>
            So this site does not offer one. What it offers instead is the part that genuinely
            works in a browser: a{" "}
            <Link href="/tools/text-similarity-checker">similarity checker</Link> that compares
            your draft against sources you already have, so you can confirm that what you
            borrowed is quoted and cited properly. Paired with the{" "}
            <Link href="/tools/citation-generator">citation generator</Link>, that covers what
            most students actually need before they submit.
          </p>
          <p>
            For the same reason there is no &ldquo;AI humaniser&rdquo; here. Tools that promise
            to make written work undetectable are selling something they cannot deliver, and
            the thing they are selling is a way to misrepresent authorship. Improving writing
            so it reads clearly is a different job, and that is what these tools do.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      q: "Do I need an account?",
      a: "No. There is no sign-up, no email capture and no trial. Open a tool and use it.",
    },
    {
      q: "Is there a word limit?",
      a: "No. The checks run on your own device, so the only limit is your computer's memory. A full dissertation chapter is fine.",
    },
    {
      q: "Is my writing uploaded or stored?",
      a: "No. These tools have no upload endpoint — the analysis happens in JavaScript in the page. You can verify it by opening your browser's network tab while you type. The citation generator saves your reference list in your browser's local storage on that device only.",
    },
    {
      q: "How does this compare to Grammarly or QuillBot?",
      a: "It catches less than they do, and it costs nothing rather than a monthly fee. They run trained language models that understand sentence structure; these run pattern rules. For spelling, punctuation, wordiness, citations and readability the gap is small. For subtle grammar that depends on meaning, the gap is real, and it is better to know that than to be told otherwise.",
    },
    {
      q: "Do the tools work offline?",
      a: "Yes. Once the page has loaded, its code is cached and everything keeps working with no connection.",
    },
    {
      q: "Can I use these for coursework?",
      a: "Checking your own writing for spelling, grammar, clarity and references is ordinary proofreading and is accepted everywhere. What is not acceptable is submitting work whose ideas or wording are not yours, whatever tool produced it. Nothing here changes that, and the paraphraser says so on its own page.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
