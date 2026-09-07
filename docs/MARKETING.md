# DO101 — content and distribution playbook

Repeatable ideas that do not require a budget, a face on camera or a schedule
you will abandon in three weeks.

**Ground rules, non-negotiable:**

- Never spam a community. Post where the content genuinely belongs.
- Never automate engagement, buy followers, or run bot traffic.
- Never fake a score, a review, a testimonial or a user count.
- Read a subreddit's rules before posting. Most ban self-promotion outright,
  and the ones that do not still notice when you only ever post links.

---

## The two loops

**Search loop** — someone needs a job done, finds the tool, gets the result,
sees the related tools, comes back next time. This is slow, compounding, and
worth more than everything else combined.

**Share loop** — someone plays the typing test, likes their score, sends it to
a friend, the friend plays, the friend challenges someone else. This is fast
and spiky. Typing Battle exists specifically to make the second half of that
loop possible.

---

## TikTok / Reels / Shorts

Vertical, 10–25 seconds, no talking required, screen recording plus text.

1. **"Can you type faster than 100 WPM?"** — screen recording of a 30-second
   test ending on the result card. Text overlay: your WPM. Reply to comments
   with your own attempts.
2. **"Average reaction time is 250 ms. Mine is ___"** — five rounds of the
   reaction test in one take. The number at the end is the whole video.
3. **"Watch me compress a 5 MB photo to 200 KB"** — drag, type 200, press
   compress, show the before/after. It takes six seconds and looks like magic.
4. **"3 websites every student should bookmark"** — word counter, image
   compressor, age calculator. Fast cuts, no voiceover needed.
5. **"5 developer tools you keep paying attention to ads for"** — JSON
   formatter, Base64, JWT decoder, regex tester, UUID generator.
6. **"Type this sentence without a mistake"** — a hard sentence, one take,
   accuracy shown at the end. Invite people to duet.
7. **"1v1 me"** — a real Typing Battle race, split screen, both progress bars
   moving. This is the single most watchable thing DO101 can produce.
8. **"How many steps can you remember?"** — the memory game, ending on the
   level you failed at.

**Format notes:** the result screen is the hook, so cut to it fast. Put the
number on screen within the first two seconds. Say the domain once, at the end.

---

## Reddit

Only where it is genuinely on topic, and only as a participant.

- Typing and keyboard communities: share your score, not a link, and mention
  the tool only if asked.
- Web development communities: the in-browser compression technique (canvas
  encoding with a binary search on quality) is a real technical post.
- Answer questions where a DO101 tool is the direct answer, and say so plainly
  without a marketing voice.

Ratio to hold yourself to: at least ten useful comments for every link.

---

## X / Threads

- Post a genuinely surprising screenshot: a 5 MB photo at 190 KB, side by side.
- Short thread: "Everything in this JSON formatter runs in your browser.
  Here is why that matters for anyone pasting production data into a website."
- Post your typing score and ask people to beat it. Reply to everyone who does.

---

## YouTube (longer form, optional)

- "How to compress an image under 200 KB without uploading it anywhere" —
  three minutes, solves a real recurring problem, ranks for a real query.
- "Every free developer tool I use in the browser" — a genuine tour.

---

## Product-led distribution that costs nothing

- **The share card.** Every game result has one. Make sure it reads well when
  pasted into a chat.
- **The invite link.** Typing Battle rooms are a link. That link is the
  cheapest acquisition channel DO101 has.
- **Related tools.** Every tool page recommends four more. This is how a
  one-job visitor becomes a repeat visitor.
- **The ⌘K palette.** People who discover it feel like they found a secret.
  Mention it in a video once.

---

## What to measure

From Search Console: impressions, clicks, CTR, average position, indexed pages.

From the analytics abstraction (once a provider is connected): `tool_open`,
`tool_complete`, `game_start`, `game_complete`, `share_result`.

The two ratios that matter most:

- **`tool_complete` ÷ `tool_open`** — is the tool actually usable?
- **`share_result` ÷ `game_complete`** — is the share loop working?

If completion is low, the tool has a UX problem, not a traffic problem.
