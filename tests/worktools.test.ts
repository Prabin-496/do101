import { describe, it, expect } from "vitest";
import { daysUntil, findDueDate } from "@/lib/worktools/dates";
import { parseMessages, splitSentences } from "@/lib/worktools/messages";
import { cleanTitle, extractItems, sortByUrgency } from "@/lib/worktools/items";

// Monday 21 September 2026, mid-morning.
const NOW = new Date(2026, 8, 21, 10, 0, 0);
const due = (text: string) => findDueDate(text, NOW)?.date ?? null;

describe("deadline reading", () => {
  it("reads the everyday English phrases", () => {
    expect(due("send it today")).toBe("2026-09-21");
    expect(due("by EOD please")).toBe("2026-09-21");
    expect(due("tomorrow works")).toBe("2026-09-22");
    expect(due("the day after tomorrow")).toBe("2026-09-23");
    expect(due("in 3 days")).toBe("2026-09-24");
    expect(due("in two weeks")).toBe("2026-10-05");
    expect(due("by end of week")).toBe("2026-09-25");
    expect(due("before end of month")).toBe("2026-09-30");
    expect(due("sometime next week")).toBe("2026-09-28");
    expect(due("next month")).toBe("2026-10-01");
  });

  it("reads weekdays with the stated conventions", () => {
    expect(due("by Friday")).toBe("2026-09-25");
    expect(due("on Monday")).toBe("2026-09-21"); // today counts
    expect(due("this Wed")).toBe("2026-09-23");
    expect(due("next Friday")).toBe("2026-10-02"); // Friday of next week
    expect(due("next Monday")).toBe("2026-09-28");
  });

  it("reads written and numeric dates", () => {
    expect(due("due 2026-10-15")).toBe("2026-10-15");
    expect(due("by Sep 30")).toBe("2026-09-30");
    expect(due("September 30th, 2027")).toBe("2027-09-30");
    expect(due("by the 3rd of October")).toBe("2026-10-03");
    expect(due("by 10/5")).toBe("2026-10-05");
    expect(due("due 25/10")).toBe("2026-10-25"); // first number over 12: day-first
  });

  it("does not mistake a fraction for a date", () => {
    expect(due("about 3/4 of the team agreed")).toBeNull();
  });

  it("rolls a long-past month and day into next year", () => {
    expect(due("by Jan 10")).toBe("2027-01-10");
  });

  it("rejects impossible dates instead of rolling them over", () => {
    expect(due("by Feb 31")).toBeNull();
  });

  it("reads Japanese deadlines", () => {
    expect(due("明日までにお願いします")).toBe("2026-09-22");
    expect(due("本日中にご確認ください")).toBe("2026-09-21");
    expect(due("今週中に対応します")).toBe("2026-09-25");
    expect(due("来週の水曜日まで")).toBe("2026-09-30");
    expect(due("金曜日までに送ります")).toBe("2026-09-25");
    expect(due("10月5日までに提出")).toBe("2026-10-05");
    expect(due("月末までに")).toBe("2026-09-30");
    expect(due("9/30まで")).toBe("2026-09-30");
  });

  it("picks up a time when one is given", () => {
    expect(findDueDate("tomorrow at 3pm", NOW)?.time).toBe("15:00");
    expect(findDueDate("Friday by 17:30", NOW)?.time).toBe("17:30");
    expect(findDueDate("明日の10時半まで", NOW)?.time).toBe("10:30");
    expect(findDueDate("by noon tomorrow", NOW)?.time).toBe("12:00");
  });

  it("counts days either side of today", () => {
    expect(daysUntil("2026-09-25", NOW)).toBe(4);
    expect(daysUntil("2026-09-19", NOW)).toBe(-2);
  });
});

describe("reading pasted conversations", () => {
  it("reads 'Name: text' minutes", () => {
    const m = parseMessages("Sarah: I'll send the deck.\nTom: Thanks.\nNote: nothing else");
    expect(m.map((x) => x.speaker)).toEqual(["Sarah", "Tom", null]);
  });

  it("reads timestamped chat exports", () => {
    const m = parseMessages("[2026-09-15 10:02] Priya Shah: The launch moved to Oct 1.\n[2026-09-15 10:05] Ken: ok");
    expect(m[0]).toMatchObject({ speaker: "Priya Shah", time: "2026-09-15T10:02:00" });
    expect(m[1].speaker).toBe("Ken");
  });

  it("reads Slack's name-and-time header lines", () => {
    const m = parseMessages("Maria Lopez  10:02 AM\nCan you review the PR?\nIt's the big one.\n\nJoe  10:05 AM\nSure");
    expect(m[0]).toMatchObject({ speaker: "Maria Lopez", timeText: "10:02 AM" });
    expect(m[0].text).toContain("It's the big one.");
    expect(m[1].speaker).toBe("Joe");
  });

  it("reads WebVTT meeting transcripts", () => {
    const m = parseMessages("WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\n<v Anna Berg>I'll book the room.</v>\n");
    expect(m[0]).toMatchObject({ speaker: "Anna Berg", text: "I'll book the room." });
  });

  it("reads emails and drops quoted history", () => {
    const m = parseMessages(
      "From: Dan Park <dan@x.com>\nDate: Mon, 21 Sep 2026 09:00:00\nSubject: Invoice\n\nPlease send the invoice by Friday.\n\nOn Sun, Sep 20, Lee wrote:\n> old text\n",
    );
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ speaker: "Dan Park", subject: "Invoice" });
    expect(m[0].text).not.toContain("old text");
  });

  it("does not treat labels as speakers", () => {
    expect(parseMessages("Action: send the report")[0].speaker).toBeNull();
    expect(parseMessages("TODO: fix the login bug")[0].speaker).toBeNull();
  });

  it("splits sentences without breaking abbreviations", () => {
    expect(splitSentences("Send v1.2 today. Then e.g. the logs. 確認します。送ります。")).toEqual([
      "Send v1.2 today.", "Then e.g. the logs.", "確認します。", "送ります。",
    ]);
  });
});

describe("finding the work", () => {
  const extract = (text: string, me?: string) => extractItems(parseMessages(text), { now: NOW, me });

  it("finds commitments and gives them to whoever made them", () => {
    const [item] = extract("Sarah: I'll send the updated deck to the client by Friday.");
    expect(item).toMatchObject({ kind: "action", owner: "Sarah", due: "2026-09-25", title: "Send the updated deck to the client" });
    expect(item.reason).toContain("committed");
  });

  it("finds requests and works out who was asked", () => {
    expect(extract("Tom: Priya, can you review the budget by tomorrow?")[0]).toMatchObject({ owner: "Priya", due: "2026-09-22" });
    expect(extract("Tom: @ken please update the roadmap")[0].owner).toBe("ken");
    expect(extract("Tom: Could you check the numbers?\nAmy: Sure.")[0].owner).toBe("Amy");
  });

  it("reads minutes-style 'Name to do X'", () => {
    const [item] = extract("- Jordan to draft the press release by next Monday");
    expect(item).toMatchObject({ owner: "Jordan", due: "2026-09-28", title: "Draft the press release" });
  });

  it("finds marked items, checkboxes and instructions", () => {
    const items = extract("Action: renew the SSL certificate\n- [ ] Book flights\n- [x] Send invite\nEmail the vendor about pricing");
    expect(items.map((i) => i.title)).toEqual(["Renew the SSL certificate", "Book flights", "Send invite", "Email the vendor about pricing"]);
    expect(items[2].done).toBe(true);
  });

  it("keeps the date inside a decision, and urgency out of a title", () => {
    expect(extract("Lee: We agreed to launch on October 1 instead of September 25.")[0].title).toBe("We agreed to launch on October 1 instead of September 25");
    expect(extract("Please confirm the budget with finance by Friday — it's urgent.")[0].title).toBe("Confirm the budget with finance");
  });

  it("records undirected questions only when asked to", () => {
    const text = "Ken: Do we still need the translation?\nAmy: How was your weekend?";
    expect(extract(text).filter((i) => i.kind === "question")).toHaveLength(0);
    expect(extractItems(parseMessages(text), { now: NOW, allQuestions: true }).filter((i) => i.kind === "question")).toHaveLength(2);
  });

  it("finds decisions and questions separately", () => {
    const items = extract("Lee: We agreed to launch on October 1.\nLee: Maria, do you have the final numbers?");
    expect(items.map((i) => i.kind)).toEqual(["decision", "question"]);
  });

  it("ignores chatter, refusals and things already done", () => {
    expect(extract("Tom: Great meeting everyone.\nAmy: The weather is nice.")).toHaveLength(0);
    expect(extract("Tom: I won't send the report.")).toHaveLength(0);
    expect(extract("Tom: I already sent the report.")).toHaveLength(0);
  });

  it("marks urgency", () => {
    expect(extract("Please fix the checkout bug ASAP")[0].priority).toBe("high");
    expect(extract("Please review the doc by Thursday")[0].priority).toBe("medium");
    expect(extract("Please review the doc next month")[0].priority).toBe("low");
  });

  it("flags what is for the reader", () => {
    const items = extract("Tom: Priya, can you review the budget?\nTom: Ken, please book the room.", "Priya");
    expect(items.find((i) => i.owner === "Priya")?.forMe).toBe(true);
    expect(items.find((i) => i.owner === "Ken")?.forMe).toBe(false);
  });

  it("merges the same task said twice", () => {
    const items = extract("Amy: I'll send the deck.\nAmy: Yes, I will send the deck by Friday.");
    expect(items).toHaveLength(1);
    expect(items[0].due).toBe("2026-09-25");
  });

  it("reads Japanese requests and commitments", () => {
    const items = extract("田中: 山田さん、明日までに資料をご確認ください。\n山田: 承知しました。本日中に送ります。");
    expect(items[0]).toMatchObject({ kind: "action", owner: "山田さん", due: "2026-09-22" });
    expect(items[1]).toMatchObject({ kind: "action", owner: "山田", due: "2026-09-21" });
  });

  it("cleans titles down to the task", () => {
    expect(cleanTitle("So, can you please send the invoice by Friday?", "Friday")).toBe("Send the invoice");
    expect(cleanTitle("Ok I'll also update the tracker.", null)).toBe("Update the tracker");
  });

  it("sorts what is most pressing first", () => {
    const items = extract("Please review the doc next month\nPlease fix the outage ASAP\nPlease send the notes by Thursday");
    expect(sortByUrgency(items, NOW).map((i) => i.priority)).toEqual(["high", "medium", "low"]);
  });
});

/* ------------------------------ day planner ------------------------------ */

import { buildPlan, DEFAULT_SETTINGS, parseDuration, parseEvents, parseTaskList, toMinutes } from "@/lib/worktools/planner";
import { buildSop, sopToDoc } from "@/lib/worktools/sop";
import { parseLog, reportText, summarise } from "@/lib/worktools/report";
import { followUpFor, followUpMessage, leadsFromRows, leadsToRows, type Lead } from "@/lib/worktools/followup";
import { catchUp } from "@/lib/worktools/catchup";
import { chunk, SearchIndex, bestSentences, highlight, stem, tokenize } from "@/lib/worktools/search";
import { composeReply, detectName, matchInquiry, placeholders, splitQuestions, STARTER_FAQS, faqsFromRows, faqsToRows } from "@/lib/worktools/inquiry";
import { analyseMessage, buildReply, replyText, toRomaji, PHRASES, SITUATIONS, AUDIENCES } from "@/lib/worktools/jp-business";
import { parseIcs, toIcsText } from "@/lib/worktools/export";

describe("day planner", () => {
  it("reads durations in every common form", () => {
    expect(parseDuration("write report (2h)")).toBe(120);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration("1h30")).toBe(90);
    expect(parseDuration("~45m")).toBe(45);
    expect(parseDuration("30 minutes")).toBe(30);
    expect(parseDuration("資料作成 1時間")).toBe(60);
    expect(parseDuration("確認 15分")).toBe(15);
    expect(parseDuration("no estimate")).toBeNull();
  });

  it("reads a task list and strips the markup out of titles", () => {
    const [a, b, c] = parseTaskList("- Write the board report (2h) !! by Friday\n[ ] email Ken 15m\nReview PR", NOW);
    expect(a).toMatchObject({ title: "Write the board report", minutes: 120, priority: "high", due: "2026-09-25" });
    expect(b).toMatchObject({ title: "email Ken", minutes: 15, priority: "medium" });
    expect(c).toMatchObject({ minutes: 30, assumedDuration: true });
  });

  it("reads fixed meetings", () => {
    expect(parseEvents("10:00-10:30 Standup\n14:00 – 15:00 Client call\nnonsense")).toEqual([
      { start: "10:00", end: "10:30", title: "Standup" },
      { start: "14:00", end: "15:00", title: "Client call" },
    ]);
  });

  it("never schedules work on top of a meeting or lunch", () => {
    const tasks = parseTaskList("Deep work (3h)\nEmails (30m)\nReview (45m)", NOW);
    const plan = buildPlan(tasks, parseEvents("10:00-11:00 Standup\n15:00-16:00 Call"), DEFAULT_SETTINGS, NOW);
    const fixed = plan.blocks.filter((b) => b.kind === "event" || b.kind === "lunch");
    for (const block of plan.blocks.filter((b) => b.kind === "task")) {
      for (const f of fixed) {
        const overlap = toMinutes(block.start) < toMinutes(f.end) && toMinutes(block.end) > toMinutes(f.start);
        expect(overlap, `${block.title} ${block.start}-${block.end} vs ${f.title}`).toBe(false);
      }
    }
  });

  it("keeps the buffer free and reports what does not fit", () => {
    const tasks = parseTaskList("Big project (10h)", NOW);
    const plan = buildPlan(tasks, [], DEFAULT_SETTINGS, NOW);
    expect(plan.planned).toBeLessThanOrEqual(plan.capacity);
    expect(plan.overflow).toBe(600 - plan.planned);
    expect(plan.unscheduled).toHaveLength(1);
    expect(plan.warnings.join(" ")).toContain("does not fit");
  });

  it("puts urgent and due-today work first", () => {
    const tasks = parseTaskList("Nice to have (30m) !low\nInvoice client (30m) today\nFix outage (30m) !!", NOW);
    const plan = buildPlan(tasks, [], DEFAULT_SETTINGS, NOW);
    const order = plan.blocks.filter((b) => b.kind === "task").map((b) => b.title);
    expect(order.indexOf("Invoice client")).toBeLessThan(order.indexOf("Nice to have"));
    expect(order.indexOf("Fix outage")).toBeLessThan(order.indexOf("Nice to have"));
  });

  it("inserts breaks after long stretches of focus", () => {
    const plan = buildPlan(parseTaskList("Long task (3h)", NOW), [], { ...DEFAULT_SETTINGS, lunchMinutes: 0 }, NOW);
    expect(plan.blocks.some((b) => b.kind === "break")).toBe(true);
  });

  it("splits a task across a meeting and labels the parts", () => {
    const plan = buildPlan(parseTaskList("Report (2h)", NOW), parseEvents("10:00-11:00 Meeting"), { ...DEFAULT_SETTINGS, deepWorkFirst: true }, NOW);
    const parts = plan.blocks.filter((b) => b.title === "Report");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].part?.total).toBe(parts.length);
    expect(parts.reduce((a, b) => a + toMinutes(b.end) - toMinutes(b.start), 0)).toBe(120);
  });
});

describe("SOP builder", () => {
  const sop = buildSop(
    "Before you start, you need admin access to the Billing Portal.\nFirst, log in to the Billing Portal. Then open the export page and choose last month. Make sure the currency is set to JPY. If the report is empty, contact the finance team. Finally, email the file to your manager.",
  );

  it("splits rough notes into numbered steps", () => {
    expect(sop.steps.map((s) => s.text)).toEqual([
      "Log in to the Billing Portal",
      "Open the export page and choose last month",
      "Email the file to your manager",
    ]);
  });

  it("attaches warnings and decisions to the step they belong to", () => {
    expect(sop.steps[1].warnings[0]).toContain("currency is set to JPY");
    expect(sop.steps[1].decision).toContain("contact the finance team");
  });

  it("lists prerequisites, roles and systems", () => {
    expect(sop.prerequisites[0]).toContain("admin access");
    expect(sop.roles).toEqual(expect.arrayContaining(["Finance", "Manager"]));
    expect(sop.systems).toContain("Billing Portal");
  });

  it("produces a Word document outline with a procedure table", () => {
    const doc = sopToDoc(sop, { owner: "Ops", version: "1.0", date: "2026-09-21" });
    const table = doc.find((b) => b.type === "table" && b.rows[0][1] === "Step");
    expect(table && table.type === "table" ? table.rows.length : 0).toBe(4);
  });

  it("reads Japanese sequence words", () => {
    const ja = buildSop("システムにログインします。次に、レポートを出力します。その後、上長に送付します。");
    expect(ja.steps.length).toBe(3);
  });
});

describe("report generator", () => {
  const log = parseLog(
    "Monday\n#web fixed the login bug (2h)\n#web working on the checkout redesign 1.5h\nwaiting on legal for the vendor contract #ops\ntomorrow: finish the investor deck\nlunch with Sam",
    NOW,
  );

  it("classifies each line", () => {
    expect(log.map((e) => e.status)).toEqual(["done", "progress", "blocked", "next", "note"]);
  });

  it("reads projects, hours and dates", () => {
    expect(log[0]).toMatchObject({ project: "web", minutes: 120, date: "2026-09-21", text: "Fixed the login bug" });
    expect(log[2].project).toBe("ops");
    expect(summarise(log).minutes).toBe(210);
  });

  it("writes a stand-up with every section, including empty ones", () => {
    const text = reportText(log, { kind: "daily", name: "Ana", team: "", date: "2026-09-21" });
    expect(text).toContain("✅ Done\n• [web] Fixed the login bug (2h)");
    expect(text).toContain("🚧 Blockers\n• [ops] Waiting on legal");
  });

  it("reads Japanese status words", () => {
    const ja = parseLog("資料作成 完了\nレビュー対応中\n承認待ち", NOW);
    expect(ja.map((e) => e.status)).toEqual(["done", "progress", "blocked"]);
  });
});

describe("follow-up tracker", () => {
  const lead = (over: Partial<Lead>): Lead => ({ id: "x", name: "Ana Ruiz", company: "Acme", email: "", stage: "contacted", lastContact: "2026-09-15", attempts: 1, nextStep: "", notes: "", owner: "", ...over });

  it("works out when each lead is due and whether it is overdue", () => {
    expect(followUpFor(lead({}), NOW)).toMatchObject({ due: "2026-09-18", state: "overdue", days: -3 });
    expect(followUpFor(lead({ stage: "won" }), NOW).state).toBe("closed");
    expect(followUpFor(lead({ stage: "new", lastContact: null }), NOW).state).toBe("today");
  });

  it("spaces follow-ups further apart after unanswered attempts", () => {
    const early = followUpFor(lead({ attempts: 1 }), NOW).due!;
    const later = followUpFor(lead({ attempts: 4 }), NOW).due!;
    expect(later > early).toBe(true);
  });

  it("drafts a stage-appropriate message, and a break-up after too many", () => {
    expect(followUpMessage(lead({ stage: "proposal" }), "Kai", NOW).subject).toContain("proposal");
    expect(followUpMessage(lead({ attempts: 6 }), "Kai", NOW).body).toContain("stop following up");
  });

  it("round-trips a spreadsheet with English or Japanese headings", () => {
    const leads = leadsFromRows([["氏名", "会社名", "ステータス", "最終連絡日"], ["山田", "ABC", "提案", "2026/09/10"]]);
    expect(leads[0]).toMatchObject({ name: "山田", company: "ABC", stage: "proposal", lastContact: "2026-09-10" });
    const rows = leadsToRows(leads, NOW);
    expect(rows[0]).toContain("Follow up by");
    expect(leadsFromRows(rows)[0]).toMatchObject({ name: "山田", stage: "proposal", lastContact: "2026-09-10" });
  });
});

describe("what did I miss", () => {
  const messages = parseMessages(
    "[2026-09-10 09:00] Tom: old news\n[2026-09-16 10:00] Lee: Priya, can you review the budget by Friday?\n[2026-09-17 11:00] Sam: We decided to postpone the launch to October.\n[2026-09-18 12:00] Ken: nice weather\n[2026-09-18 13:00] Priya: I'm back soon",
  );
  const result = catchUp(messages, { me: "Priya", since: "2026-09-14", now: NOW });

  it("skips messages from before you left and your own", () => {
    expect(result.skipped).toBe(1);
    expect(result.considered).toBe(3);
  });

  it("puts what concerns you first, with the reasons", () => {
    expect(result.highlights[0].message.speaker).toBe("Lee");
    expect(result.highlights[0].signals).toEqual(expect.arrayContaining(["you", "deadline"]));
    expect(result.forYou[0].title).toBe("Review the budget");
    expect(result.decisions[0].title).toContain("postpone the launch");
  });

  it("leaves idle chatter out of the highlights", () => {
    expect(result.highlights.some((h) => h.message.speaker === "Ken")).toBe(false);
  });
});

describe("document search", () => {
  it("stems so different forms of a word match", () => {
    expect(stem("invoices")).toBe(stem("invoicing"));
    expect(stem("invoice")).toBe(stem("invoiced"));
  });

  it("indexes Japanese as character pairs", () => {
    expect(tokenize("請求書")).toEqual(["請求", "求書"]);
  });

  const docs = [
    { id: "a", title: "Travel policy", text: "Employees may book economy flights.\n\nHotels must be under 15,000 yen a night. Receipts are required for every expense." },
    { id: "b", title: "Invoicing guide", text: "Send invoices on the 25th. Late invoices delay payment by a month." },
    { id: "c", title: "経費規程", text: "交通費は月末までに申請してください。領収書が必要です。" },
  ];
  const index = new SearchIndex(docs.flatMap((d) => chunk(d)));

  it("ranks the passage that answers the question first", () => {
    const [top] = index.search("how much can I spend on a hotel");
    expect(top.passage.docId).toBe("a");
    expect(top.passage.text).toContain("15,000 yen");
  });

  it("finds Japanese text", () => {
    expect(index.search("交通費の申請")[0].passage.docId).toBe("c");
  });

  it("honours phrases and exclusions", () => {
    expect(index.search('"late invoices"').map((h) => h.passage.docId)).toEqual(["b"]);
    expect(index.search("invoice -payment")).toHaveLength(0);
  });

  it("quotes the best sentence and highlights the matches", () => {
    const [top] = index.search("receipts required");
    expect(bestSentences(top.passage.text, top.matched, 1)[0]).toBe("Receipts are required for every expense.");
    expect(highlight("Receipts are required", top.matched).filter((p) => p.hit).map((p) => p.text)).toEqual(["Receipts", "required"]);
  });
});

describe("customer inquiries", () => {
  const faqs = STARTER_FAQS.tourism;

  it("splits a message into its questions and finds the name", () => {
    const text = "Hi, I'm Anna Kowalski. What time is check-in? Also, do you have parking? Thanks!";
    expect(splitQuestions(text)).toEqual(["What time is check-in?", "Do you have parking?"]);
    expect(detectName(text)).toBe("Anna Kowalski");
    expect(detectName("田中と申します。予約について質問です。")).toBe("田中");
  });

  it("matches each question to the right answer, with synonyms", () => {
    const results = matchInquiry("What time can we arrive? Is there somewhere to leave the car? How much is breakfast?", faqs);
    expect(results.map((r) => r.entry?.id)).toEqual(["t1", "t6", "t4"]);
  });

  it("does not stretch one shared word into a match", () => {
    expect(matchInquiry("My car broke down, can you recommend a mechanic?", faqs)[0].entry).toBeNull();
  });

  it("refuses to guess when nothing fits", () => {
    const [result] = matchInquiry("Can I bring my pet iguana?", faqs);
    expect(result.entry).toBeNull();
    const reply = composeReply([result], { customerName: "Anna", business: "Sakura Inn", signer: "Mei", tone: "friendly", language: "en" });
    expect(reply).toContain("I'll check and come back to you");
  });

  it("writes Japanese replies in the business register", () => {
    const reply = composeReply(matchInquiry("駐車場はありますか？", faqs), { customerName: "田中", business: "さくら旅館", signer: "", tone: "formal", language: "ja" });
    expect(reply.startsWith("田中様")).toBe(true);
    expect(reply).toContain("お問い合わせいただき、誠にありがとうございます");
  });

  it("warns about placeholders still in square brackets", () => {
    expect(placeholders(faqs[0].answer).length).toBeGreaterThan(0);
  });

  it("round-trips the FAQ through a spreadsheet", () => {
    expect(faqsFromRows(faqsToRows(faqs)).map((f) => f.question)).toEqual(faqs.map((f) => f.question));
  });
});

describe("Japanese workplace helper", () => {
  it("recognises set phrases and what they really mean", () => {
    const a = analyseMessage("お世話になっております。先日のご提案ですが、前向きに検討させていただきます。", NOW);
    const found = a.found.map((f) => f.phrase.jp);
    expect(found).toEqual(expect.arrayContaining(["お世話になっております", "前向きに検討します"]));
    expect(a.summary.join(" ")).toContain("polite no");
    expect(a.formality).toBe("external");
  });

  it("spots requests and deadlines", () => {
    const a = analyseMessage("お疲れ様です。明日までに資料のご確認をお願いいたします。", NOW);
    expect(a.deadline?.date).toBe("2026-09-22");
    expect(a.categories).toContain("request");
    expect(a.suggested[0]).toBe("accept");
    expect(a.formality).toBe("internal");
  });

  it("builds a correctly structured client email", () => {
    const lines = buildReply("accept", "client", { recipient: "山田", recipientCompany: "株式会社ABC", me: "リー", myCompany: "DO商事", topic: "見積書", date: "9月30日" });
    const text = replyText(lines, "client");
    expect(text.split("\n")[0]).toBe("株式会社ABC");
    expect(text).toContain("山田様");
    expect(text).toContain("いつもお世話になっております。");
    expect(text).toContain("見積書の件、承知いたしました。");
    expect(text).toContain("9月30日までに対応いたします。");
    expect(text.trim().endsWith("引き続きよろしくお願いいたします。")).toBe(true);
  });

  it("drops the honorifics for a colleague", () => {
    const text = replyText(buildReply("accept", "colleague", { recipient: "佐藤", recipientCompany: "", me: "リー", myCompany: "", topic: "資料", date: "明日" }), "colleague");
    expect(text).toContain("佐藤さん");
    expect(text).toContain("了解です");
    // お疲れ様 is fine; what must not appear is the honorific on the name.
    expect(text).not.toContain("佐藤様");
  });

  it("gives readable romaji for every line", () => {
    const lines = buildReply("late", "client", { recipient: "山田", recipientCompany: "", me: "リー", myCompany: "", topic: "", date: "" });
    expect(toRomaji(lines.find((l) => l.jp.startsWith("ご返信"))!.kana)).toBe("gohenshin ga osoku nari, taihen mōshiwake gozaimasen.");
  });

  it("has a template for every situation and audience", () => {
    for (const s of SITUATIONS) for (const a of AUDIENCES) {
      const lines = buildReply(s.id, a.id, { recipient: "A", recipientCompany: "", me: "B", myCompany: "", topic: "T", date: "D" });
      expect(lines.length).toBeGreaterThan(3);
      for (const l of lines) expect(l.jp && l.kana && l.en).toBeTruthy();
    }
    expect(PHRASES.length).toBeGreaterThan(40);
  });
});

describe("calendar files", () => {
  it("writes a valid, importable .ics and reads one back", () => {
    const text = toIcsText([
      { title: "Send deck, final", date: "2026-09-25", start: "15:00", minutes: 45 },
      { title: "Invoice due", date: "2026-09-30" },
    ], NOW);
    expect(text).toContain("BEGIN:VCALENDAR\r\n");
    expect(text).toContain("DTSTART:20260925T150000");
    expect(text).toContain("DTEND:20260925T154500");
    expect(text).toContain("SUMMARY:Send deck\\, final");
    expect(text).toContain("DTSTART;VALUE=DATE:20260930");
    expect(text).toContain("DTEND;VALUE=DATE:20261001");
    const back = parseIcs(text);
    expect(back[0]).toMatchObject({ title: "Send deck, final", date: "2026-09-25", start: "15:00", end: "15:45" });
    expect(back[1]).toMatchObject({ date: "2026-09-30", start: null });
  });
});

describe("Japanese workplace helper — romaji and reply order", () => {
  it("writes phrase romaji with particles separated and pronounced", () => {
    const romaji = (jp: string) => toRomaji(PHRASES.find((p) => p.jp === jp)!.kana);
    expect(romaji("お世話になっております")).toBe("osewa ni natte orimasu");
    expect(romaji("ご都合はいかがでしょうか")).toBe("gotsugō wa ikaga deshōka");
    expect(romaji("ご迷惑をおかけしております")).toBe("gomeiwaku o okake shite orimasu");
  });

  it("suggests answering a direct question before anything else", () => {
    const a = analyseMessage("お世話になっております。前向きに検討しております。納期について、明日までにご教示いただけますでしょうか。", NOW);
    expect(a.suggested[0]).toBe("answer");
    expect(a.suggested).not.toContain("thank");
  });

  it("builds an answer that carries the reader's own words", () => {
    const lines = buildReply("answer", "client", { recipient: "田中", recipientCompany: "", me: "リー", myCompany: "", topic: "納期", date: "", details: "納期は10月5日を予定しております。" });
    expect(replyText(lines, "client")).toContain("納期は10月5日を予定しております。");
    expect(toRomaji(lines.find((l) => l.jp.endsWith("です。"))!.kana)).toBe("rii desu.");
  });
});
