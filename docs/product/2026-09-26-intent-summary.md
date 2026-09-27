# Kriket: what we are building and why

**What this is:** a summary of kriket's high-level intent, written by Claude on 2026-09-26 (evening of day 1)
from everything the founders have said so far. It has two jobs. First, Erik checks whether it matches.
Second, once corrected, it is the starting brief for a fresh session on market research and product-market fit.
Where a statement is my inference rather than something a founder said, it says so.

**Notion task:** none (hackathon repo). If one is given later, PRs opened from work based on this document put
it as a suffix in the PR title, for example `Write the market sizing for bumpy-income budgeting [GEN-1234]`.

## In one paragraph

Kriket is a budgeting app for young people with bumpy income: students, people in a first career job, shift
workers. They track nothing today and keep getting caught short at the end of the month. It does not ask them
to log every purchase. Instead they describe their money once, as a handful of repeating income and expense
streams, each with the range they actually see (lowest, usual, highest). Kriket then forecasts where the balance
is heading in the worst, expected, and best case. The ledger is not the point. The point is answering "am I going
to be OK, and will I reach my goal?", and then the nudge that follows: pick up a shift, go easier on groceries.
Kriket should deliver this with as little typing as possible, in an interface pleasant enough that people come
back. It started as a pitch at Co.Hack 2026 (Saskatoon, 26 and 27 September 2026) by Theo and Erik, who met that
morning. The code is open source.

## The problem, as the founders frame it

- **Budgets assume a salary.** Most budgeting tools start from a known monthly income. Shift, hourly, and gig pay
  moves week to week, so a fixed monthly budget is wrong from the start.
- **The target person doesn't budget at all.** They buy things when they want them and run out of money by the
  end of the month. They are not the enthusiast who photographs every receipt.
- **Existing tools force a bad trade.** Either you link your bank, which costs trust, or you type everything in,
  which costs effort. One listener's bank app warns them about overspending all the time, and it is neither
  useful enough nor enjoyable.

## The core idea, from the pitch

1. **Three concepts only: income streams, expense streams, goals.** The listeners singled these out as simple
   enough for people who struggle with financial vocabulary, and said to keep them.
2. **Ranges, not single numbers.** Each stream has a lowest, usual, and highest amount and a repeat interval.
   The range is the key mechanism: it turns one forecast line into a band. That lets kriket say "at your usual pay
   you reach the goal; closer to your low end you don't".
3. **Behaviour change, not bookkeeping.** The pitch put this at the heart of the idea: show people which lever gets
   them to a goal. If income drifts low, pick up shifts. If a flexible expense like groceries sits near its
   maximum, spend closer to the minimum.
4. **Set it up once, then mostly leave it.** As pitched, someone could enter their streams once and then rely on
   notifications that say whether they are still on track. People who want to log manually can, but nobody has to.
5. **Enjoyable.** The pitch's tagline was about making budgeting enjoyable. Three things are meant to create
   that:
   - how easy it is;
   - small wins, such as a subscription reminder catching a service you forgot was still charging you;
   - an interface with some character. The name comes from the silence of an empty bank account (crickets), crickets are
     green like money, and the pitch imagined little hopping animations.

   One listener reframed the benefit as getting your confidence back about your finances, and the pitcher agreed.

## The whiteboard: the first backlog (day 1 morning)

| Item | What | Status as of this writing |
|---|---|---|
| 0 | Create, edit, delete tags, with presets | Built in iteration 1; reworked in iteration 2 |
| 1 | Income streams | Built |
| 2 | Expense streams | Built |
| 3 | See the forecast balance | Built; iteration 2 makes it the centre of the app |
| 4 | Add a goal (marked **$**) | Deferred by Theo until after iteration 2; a plan is due then |
| 5 | A mobile app | Theo's PWA, [PR 21](https://github.com/kriket-app/kriket/pull/21), queued for after iteration 2 |
| 6, 7 | One-time expenses and incomes | Not started |
| 8 | Suggestions on how to meet a goal (marked **$**) | Not started; needs goals |
| 9 | Subscription reminders: manual, or automatic via a bank API, a subscription provider's API, or email | Not started |

The data model on the board: an income or expense stream has a minimum, maximum, and actual amount, a number of
days between payments, a first payment date, and a tag. A goal has an amount, a start, and an end. A tag has a
name.

The **$** beside items 4 and 8 is never explained in any source. My guess is that it marks paid-tier features,
which would make goals and goal suggestions the business model. Erik, please confirm or correct.

## What the pitch feedback added

These come from the listeners right after the pitch (the recording does not name them; they sounded like event
mentors or organizers):

- **More than a spreadsheet?** If people type their streams in by hand, what does kriket do that a
  spreadsheet doesn't? This became the recurring test for every iteration.
- **Low-lift data entry is the real differentiator.** Upload a credit card or bank statement, or grant 30 days of
  read-only bank access. Kriket then works out what you spend, on what, and when, shows last month's picture, and
  suggests dials to turn, each with how much it would free up.
- **The hard part is where the streams come from.** Automate that and far more people will use it.
- **Pick your person.** The receipt-logger is a real but niche market and a different product. Kriket is aiming
  at the general public, which means it has to be easy.
- **The persona.** University students, people in a first career job, shift workers: people just getting rent and
  bills, who aren't thinking about retirement savings yet. One listener suggested making it something you'd get
  your friends and classmates onto. I read that as a word-of-mouth growth angle.
- **Security and trust count as much as features.** The pitcher raised this too: how do people feel safe giving
  kriket their information?

## What the founders have said since

- **Erik, after the iteration 1 tour:** it feels like "just a spreadsheet". That was expected, because items 0 to 3
  were all that was asked for. But the next step has to think much harder about market fit, real usability, and
  solving a whole problem for real people with real habits. The pitch feedback should keep steering.
- **Erik and Theo, after using the live app** (`docs/feedback/2026-09-26-iteration-1.md`): eleven notes, mostly
  about making the screen carry meaning.
  - Money out gets its own colour, "expense-orange", and time below zero is shaded orange.
  - Every pay and bill is a point on the chart.
  - Forms should ask for less.
  - "Coming up" becomes a month you flip through.
  - The balance moves to the top, with its history kept.
- **The balance check-in was not in the pitch.** It appeared during the iteration 1 build. Theo called it new but
  welcome and asked for it to be fleshed out: move it to the top, keep every balance, show how the projections have
  changed. It is now the one recurring habit iteration 2 asks of users.
- **Theo's product calls on iteration 2** ([PR 20](https://github.com/kriket-app/kriket/pull/20), folded in by
  [PR 22](https://github.com/kriket-app/kriket/pull/22)):
  - Goals are out of iteration 2, with a plan ready once it ships.
  - The landing page updates with every feature.
  - "Side hustle" replaces "Investment" as the fourth preset tag. It counts as income, which matters for this
    persona.
  - Tags keep their own page, and clicking a tag lists every stream that carries it.
  - The check-in never asks for a date.
- **Theo's statement-import plan** (`docs/plans/2026-09-27-statement-import-plan.md`) is Theo's answer to the
  low-lift feedback. Upload a PDF bank statement or paystub. Kriket parses it on the server only: no external API,
  no external AI, no third-party parser. It strips everything down to dates, amounts, and categories, and offers
  suggested streams that the person accepts or discards. Theo wrote that security and privacy are "of utmost
  importance". It is planned, not built; Theo will add detail after iteration 2.
- **Theo's PWA** ([PR 21](https://github.com/kriket-app/kriket/pull/21)): installable on a phone. At Theo's request it
  now also carries low-balance push alerts. This is the first step toward the pitch's promise that notifications
  do the work.

A note on authorship. The iteration 2 proposal's persona ("Sam"), the question "am I going to be OK?", and the
"five minutes of setup, then one habit" deal were drafted by Claude. Theo merged them without editing those rows.
So they are accepted, but not founder-authored the way the pitch and the feedback notes are. A market-research
session should treat them as hypotheses.

## Where the product is now

Check before relying on this; it moves daily.

- Iteration 1 (whiteboard items 0 to 3) is live at https://app.26.cohack.tetl.ca. Every merge to `main` deploys.
- Iteration 2 is decided and being built task by task on `i2/*` branches (`docs/plans/2026-09-27-iteration-2-build.md`;
  run `gh pr list --state all` for progress). It brings:
  - an overview that leads with a sentence about the lowest point;
  - colour with meaning;
  - a chart with a dot for every pay and bill;
  - a balance check-in with history;
  - shorter forms;
  - a month-by-month "Coming up".
- Not built yet: goals, suggestions, any low-lift import, notifications, subscription reminders, one-time items.
  So the two things the pitch and its feedback valued most, goal coaching and low-lift entry, are both still ahead.

## My reading: what is settled and what is still assumption

**Settled.** The founders have said each of these more than once:

- the persona (young, variable income, tracks nothing);
- low-lift entry as the differentiator;
- trust and privacy as a feature;
- the three concepts;
- "not a spreadsheet" as the bar.

**Tensions I see in the sources.** Worth resolving before any market research, because each one changes who
the competitors are:

1. **Forecast or goal coach?** The heart of the pitch is goals plus range-based nudges. The product built so far
   is a cash-flow forecast ("am I going to be OK?"), and goals keep being deferred. These are different products
   with different competitors: runway and overdraft-avoidance tools versus savings-goal apps.
2. **Set-and-forget or check-in habit?** The pitch promised you could enter your streams once and then just read
   notifications. Iteration 2 asks for a recurring balance check-in. It is small, but it is a habit to form, and
   the persona is defined by not having that habit.
3. **The differentiator isn't built yet.** Low-lift entry is what the feedback said separates kriket from a
   spreadsheet. Today the only way in is typing streams by hand.
4. **Privacy versus convenience.** Theo's local-only, no-bank-connection stance is a strong trust story, but it
   gives up the lowest-lift option (automatic bank sync) that the feedback named first.
5. **"Enjoyable" is mostly unbuilt.** Colour with meaning is coming. The character in the pitch (the cricket,
   the hops, the small wins like catching a forgotten subscription) is not on any plan yet.

**Untested assumptions a market-research session should check:**

- That young people with variable income want a forward-looking forecast at all, and will spend five minutes
  setting one up.
- That they can estimate their own lowest, usual, and highest amounts well enough for the band to mean anything.
- That a balance check-in is a habit they'll actually keep.
- That statement upload is low enough lift, and trusted enough, to replace bank linking.
- **Canada first** (my inference): CAD only, a Big Five bank as the reference point, retirement savings named as
  something the persona ignores, and times computed in Saskatoon's zone. The Canadian open-banking situation
  matters for automatic subscription reminders (whiteboard item 9) and for any bank connection.
- **Business model:** nothing stated. The repo is open source. The **$** marks on the whiteboard suggest goals
  and suggestions as paid features.
- **Growth:** the feedback hinted at peers bringing peers (classmates, co-workers on the same shifts).

## What I could not tell from the sources

- Whether kriket continues after Co.Hack: a venture, a side project, or a hackathon demo. This changes what
  "market research" should mean (a real go-to-market versus a sharper judging pitch).
- What the **$** marks mean.
- Whether Canada is deliberately the first market or just where the team is.

## Sources

- The pitch-feedback recording and its transcript, the team-terms recording, and the whiteboard photo. These are
  private, on Erik's machine, in the kit repo's Claude project folder under `handoff-2026-09-26/context/`. Not
  quoted verbatim here. Ask Erik before a session reads them.
- `docs/feedback/2026-09-26-iteration-1.md`: Erik's notes and the notes Theo added in
  [PR 18](https://github.com/kriket-app/kriket/pull/18).
- `docs/plans/2026-09-27-iteration-2-proposal.md`: the 45 rows, with Theo's decisions marked "Decided (Theo)".
- `docs/plans/2026-09-27-statement-import-plan.md`: Theo's ask and plan.
- `docs/handoffs/2026-09-26-iteration-1.md` and `docs/handoffs/2026-09-26-iteration-2-build.md`: state and rulings.
- [PR 15](https://github.com/kriket-app/kriket/pull/15): the first build and why it was scoped as it was.
- The Co.Hack 2026 facts (dates, venue, two cash prizes, unpublished judging criteria) come from the kit repo's
  design spec.

## For the next session

Start in `~/Code/kriket` and read this file first, on branch `docs/intent-summary` or on `main` if it has
merged. A possible opening prompt:

> Read `docs/product/2026-09-26-intent-summary.md`. Treat the "Settled" list as given and everything under
> "Tensions" and "Untested assumptions" as the agenda. Help me work through market research and product-market
> fit for kriket: who else serves young people with variable income (in Canada first), what they get wrong, which
> of the tensions the evidence resolves, and what we would need to learn from real users before building goals or
> statement import.
