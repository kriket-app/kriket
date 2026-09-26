# Iteration 2: what we propose to build next

**Theo and Erik, this file is yours to edit.** Open it on GitHub, press the pencil, change what you disagree with, and commit: onto the pull request while it is open, onto `main` after it merges. A comment on a row works too and gets a reply. Each numbered row is one decision on one line, so "change row 7" is enough. When the pull request merges, the build plan is written from this file, not from anything else.

**Notion task:** none given (hackathon repo). If Erik supplies one, every PR opened from this document puts it as a suffix in the PR title, for example `Lead the overview with the lowest point [GEN-1234]`.

**Companion:** the proposed-prototype tour at https://26.cohack.tetl.ca/tour/2-proposal/ shows the rows below as clickable screens. A proposal to react to, not a promise. Inputs: `docs/feedback/2026-09-26-iteration-1.md` (the notes on iteration 1), the pitch feedback from day 1, the whiteboard, and `docs/handoffs/2026-09-26-iteration-1.md`.

**Reading the rows:** *Kept* means the note is taken as written; *Changed* means we propose something other than the note or than today's app; *Dropped* means not in iteration 2. Each row ends with the one-line why.

## Who it is for

1. **Sam.** Twenty-something with bumpy income (shifts, tutoring, a first job, a loan drop), tracks nothing today, and has been caught by a low balance more than once. Not the receipt-logging enthusiast. -- Why: the pitch feedback and the whiteboard both point at this person; spreadsheet people already have spreadsheets.
2. **Sam's question is "am I going to be OK?"** in three forms: until the next pay, by the end of the month, and by the date of the thing they are saving for. Every screen answers one of these or gets out of the way. -- Why: a forecast that never says whether things are OK is a spreadsheet with a chart.
3. **The deal with Sam:** five minutes of setup (balance, pay, rent, the two or three bills), then one habit only, telling kriket the balance now and then. Never a receipt, never a category per purchase. -- Why: people either give an app everything or refuse to type; the check-in is the smallest thing that keeps a forecast honest.
4. **Trust, said out loud:** email and password, no bank access in iteration 2, nothing sold, one owner per row of data, and one line on the landing page that says so. -- Why: the pitch feedback put security and trust level with features.

## What "not a spreadsheet" means on screen

5. **The overview leads with a sentence, not tiles.** "You go $255 short on Oct 1. Rent lands before your first shift; you are under zero until Oct 10." The lowest point of the expected line and when it recovers, in words, above the chart. -- Why: this is the answer to row 2; the three end-of-window tiles hid the Oct 1 dip in iteration 1.
6. **Colour carries meaning everywhere.** Money in is green, money out is expense-orange, and time spent below zero is shaded expense-orange under the line. -- Why: Theo's notes 6, 7, and 8; the contrast between earning and losing is the point of the chart.
7. **The chart is the product.** Every pay and every bill is a dot on the line that shows its name and amount when tapped; the band is the range; below zero is orange. The tiles shrink to three small ones under the chart: lowest point, expected at the end, worst to best at the end. -- Why: Theo's note 11; a chart you can read without a table is the thing a spreadsheet cannot do.
8. **The balance check-in is the first thing on the overview,** with a visible "Saved" line and a kept history. -- Why: Theo's note 10 and Erik's note 1; the forecast starts from it, so it belongs at the top.
9. **Coming up is a month you flip through,** not a list of the next eight rows. -- Why: Theo's note 9; "what is coming this month" is how Sam already thinks.
10. **Forms ask for the least.** Name, usual amount, how often, next date. Range and tag are optional and folded away. -- Why: Erik's note 3; three amount fields per stream was the most spreadsheet-like thing we shipped.

## The low-lift entry story

11. **Setup in five steps:** balance today, then income, rent, then the bills that come every month, each a stream with the usual amount only; the forecast appears after the first income and nothing else is asked for. -- Why: the differentiator from the pitch feedback is low lift; five streams cover most of Sam's month.
12. **The one habit is the check-in.** The balance field is at the top whenever Sam opens the app; typing today's number and Save is the whole ritual. kriket keeps every check-in and says how it compared with what it expected ("$5.00 under forecast"). -- Why: a forecast drifts unless it is re-anchored; this is the cheapest way to re-anchor it.
13. **The forecast always starts from the latest check-in** and the window rolls forward to today. -- Why: iteration 1 anchored the window at the saved balance date and never moved it, so the forecast was stale by the second day.
14. **Statement upload and bank connections stay out of iteration 2,** but the model is shaped for them: a stream is exactly what a recurring-transaction detector would produce. -- Why: they are the long-term low-lift story and a project of their own (consent, syncing, trust); not a weekend.

## The notes on iteration 1, one by one

Erik, after the tour:

15. **"Feels like just a spreadsheet." Changed.** Rows 5 to 10 are the answer: a sentence first, colour with meaning, a chart you can read, fewer fields. -- Why: the note names the problem; those rows name what changes on screen.
16. **The pitch feedback (low lift, the persona, trust, keep the three concepts). Kept.** Rows 1 to 4 and 11 to 14 carry it; goals, the third concept, is row 32. -- Why: it is the product thesis, not a feature request.
17. **"Does Tags need its own page?" Changed.** Tags leaves the bottom nav; the Income and Expenses pages get a small "Tags" link; the page stays for renaming, recolouring, and deleting; a new tag can also be made from the stream form. -- Why: Sam rarely manages tags, and the four nav slots go to Overview, Coming up, Income, Expenses.
18. **"Only shades of green is limiting." Changed.** Any colour per tag; see row 22. -- Why: the same ask as Theo's note 4.

Erik and Theo, after using the live app (the numbers are the note numbers in the feedback file):

19. **Note 1, the Save that did nothing. Kept, fixed.** The card shows "Saved · $430.00 as of Sep 26. Your forecast starts here." and the chart redraws at once. -- Why: the save did land in iteration 1; only the confirmation was missing.
20. **Note 2, the browser date picker. Kept, fixed.** A styled date field with a calendar popover on the stream form and on the check-in, matching the rest of the form. -- Why: the default control breaks the styling differently on every browser.
21. **Note 3, usual only. Kept.** The stream form asks for the usual amount; minimum and maximum sit behind "Add a range" and equal the usual unless changed. -- Why: most streams are fixed or nearly fixed; the range is for the ones that are not.
22. **Note 4, a colour picker. Kept.** Any colour per tag from a styled picker (swatches, a hue slider, a hex field), never the browser control; greens and oranges come first in the swatches. -- Why: as asked, and row 6 needs green and orange to keep their meaning.
23. **Note 5, the presets. Kept.** Pay cheque, Bill, Groceries, Investment; four instead of eight; people who already have tags keep them. -- Why: as asked; row 39 asks what Investment means.
24. **Note 6, expense-orange. Kept.** One orange, the same everywhere; a slightly darker shade for text on white so it stays readable. -- Why: as asked, with the readability exception Theo allowed.
25. **Note 7, orange below zero. Kept.** The area between the expected line and zero is filled expense-orange wherever the line is below zero, and the zero line is always drawn when the band crosses it. -- Why: as asked; the worst-to-best band stays soft green so the two do not blur.
26. **Note 8, expenses orange in general. Kept.** Expense amounts, dots, cards, and the Bill and Groceries presets are orange; buttons stay green because they are actions, not amounts. -- Why: as asked, with that one exception.
27. **Note 9, Coming up one month at a time. Kept.** A page of its own with a month switcher, a month summary (in, out, ends at), events grouped by day, and the back arrow stopping at the month of the first check-in. -- Why: as asked.
28. **Note 10.1, the balance near the top. Kept.** Row 8. -- Why: as asked.
29. **Note 10.2, keep every balance and flip through them. Kept.** Every check-in is stored; a "Your balances" list with arrows redraws the chart from any past check-in and shows how each one compared with the forecast. -- Why: as asked, and it gives Sam a reason to keep checking in (row 12).
30. **Note 11, a point per occurrence. Kept.** Row 7. -- Why: as asked.
31. **The small gaps from the handoff. Kept, fixed** as part of the rows above: the window anchored at the balance date, the first tag list out of order, preset colours copied into the page, verbatim validation messages, the short chart on phones, the three "800.00" placeholders, the readme's template text, one CI housekeeping item. -- Why: all small, and they would read as carelessness in a demo.

## Also proposed for iteration 2

32. **One goal on the overview** (whiteboard item 4): a name, an amount, a date; the sentence in row 5 gains a second line, "Expected $1,240 by Dec 20, $240 over your $1,000 goal", and the chart draws the target as a line. -- Why: goals is the third concept from the pitch and the only way to answer "by the date of the thing I am saving for"; the largest row here, so cut it first if the day runs short.
33. **The landing page says what changed:** the sentence, the colours, the check-in habit, in three lines, plus the trust line from row 4. -- Why: the landing page still describes iteration 1.

## What stays out of iteration 2

34. **Bank connections and statement upload.** Row 14. -- Why: a project of its own.
35. **Suggestions to meet a goal** (whiteboard item 8). -- Why: needs goals first and a day to get right.
36. **One-time incomes and expenses** (items 6 and 7). -- Why: small, but they come after the rows above; first candidates if time is left.
37. **The phone install** (item 5) **and subscription reminders** (item 9). -- Why: neither changes what Sam sees on day 2.
38. **Dark mode, other currencies, a second account type, notifications.** -- Why: not asked for.

## Open questions

39. **Investment as a preset:** money in (a dividend, a payout) or money out (what Sam puts away)? The note counts it as income; the prototype shows it in blue, neither green nor orange, until we know.
40. **Should the check-in ask for a date at all?** Proposed: it saves as today, and a past date is possible from the balances list. Simpler, and it matches row 12.
41. **When a check-in differs from the forecast, should kriket guess why?** ("Groceries cost $30 more than usual this month.") Proposed: only the difference in iteration 2, no guessing.
42. **Is the goal (row 32) in or out?** Proposed: in, cut first.
43. **Coming up as a list grouped by day, or a calendar grid?** Proposed: the list; a grid spends a phone screen on empty days.
44. **The bottom nav:** Overview, Coming up, Income, Expenses (row 17), or keep Tags and fold Coming up into the overview?
45. **The month of the first check-in:** are the days before it shown muted with a "Today" divider, or not at all? Proposed: shown, muted.
