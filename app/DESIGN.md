# Kept: design system

## Brief, restated

- **Subject:** milestone escrow. A client locks payment. The freelancer delivers piece by piece, and a public rule (not a platform employee) decides when money moves.
- **Audience:** Kasia, a freelance developer, and the small companies that hire her. They are technical, but they are not crypto people.
- **Primary job of the interface:** at any moment, tell each person **where the money is, what happens next, when, and whether it is their move**. Then let them make that move in one click.

## The idea: a ledger sheet with a rubber stamp

The vernacular of this subject is the paper trail of a payment:

- the ledger page where every amount is written down;
- the timeline of a contract;
- the stamp that marks a line as **paid**.

Users are developers, so a deal's milestones run down a vertical track, like a commit history. Each milestone is a node on the track.

**The one memorable thing** is the stamp. A milestone the rule has settled gets an ink stamp ("Paid by rule", "Refunded", "Split 50/50"), slightly rotated, landing once when it happens. Everything else stays quiet and disciplined, so the stamp means something.

## Tokens

### Colour

| Name | Hex | Role |
|---|---|---|
| `ground` | `#E6EDE5` | Page background: a pale ledger green (accounting paper), not cream and not white. |
| `sheet` | `#F8FAF6` | The working surface: a deal's ledger, the wizard, a list. |
| `rule` | `#C5D3C6` | Ruling lines between ledger rows, and borders. |
| `ink` | `#1C2A39` | Blue-black fountain-pen ink: all text and primary outlines. |
| `ink-soft` | `#566573` | Secondary text. |
| `stamp` | `#5631C4` | Violet stamp ink: the single accent. Primary actions, the stamp, focus rings. |
| `clock` | `#A86412` | Amber: a timer that is running out, and "your move" urgency. |
| `void` | `#B23A30` | Errors and destructive confirmations only. Never decoration. |

Status is conveyed by words and shape first; colour only supports it.

### Type

- **Family:** Schibsted Grotesk (variable), everywhere. It is a newspaper-born grotesk with sturdy figures, and it is not Inter.
- **Numbers:** always `font-variant-numeric: tabular-nums`. Amounts are set large, with the currency smaller and lighter. Money is the headline of this product.
- **Scale** (1.250 ratio, base 16px): 12.8 / 16 / 20 / 25 / 31.25 / 39 / 61 (display).
  - Display amounts use weight 650 with tracking −0.02em.
  - Body text uses weight 400 with line-height 1.55.
- **Case:** sentence case everywhere. No all-caps labels and no tracked-out eyebrows. The stamp is the one exception, because it is a physical object.
- **Line length:** under 70ch for prose.

### Shape and depth

- **Radius has hierarchy:** sheets 10px; controls 6px; tags 3px; the stamp 2px; track nodes are circles.
- **No drop shadows.** Depth comes from the sheet sitting on the green ground, plus 1px rule lines.
- **Ruling lines** appear only where content really is a ledger (amount rows, the deal's people and terms), never as page decoration.

### Motion

- **One orchestrated moment:** the stamp lands (scale 1.35 → 1, rotate, ink blur clears, about 380 ms) when a milestone becomes settled while you watch.
- **Countdowns:** the review clock drains along the track segment.
- **Otherwise,** motion only answers actions: dialogs open, rows expand.
- **Reduced motion:** `prefers-reduced-motion` turns all of it off.

## Layout

### Header

```
Kept   [devnet note]         My deals   New deal   How it works        [ You: Client ▾ ]
```

Identity matters more than navigation in this product: who you are decides what you can do. The "You:" control (wallet, or a demo role in demo mode) is always visible and named in words.

### Deal page (the core)

```
┌──── sheet ──────────────────────────────────────────────────────────┐
│ 10.00 tUSDC locked for "Deal 8BZp…"          You are the client     │
│ [ money bar: paid to freelancer ▓▓ | refunded ░ | still locked ▒▒ ] │
│                                                                     │
│ ┌ Your move ──────────────────────────────────────────────────────┐ │
│ │ Milestone 2 was delivered. Approve and pay, or object.          │ │
│ │ If you do nothing, the freelancer is paid in 00:41.             │ │
│ │ [Approve and pay 5.00]   [Raise an objection]                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ●  Milestone 1   5.00 tUSDC                     ╔═ PAID BY RULE ═╗  │
│ │  Locked ─ Delivered ─ Reviewed ─ Paid         ╚════════════════╝  │
│ │                                                                   │
│ ◉  Milestone 2   5.00 tUSDC   in review, 00:41 left                 │
│ │  Locked ─ Delivered ─ [Review ▓▓▓░░] ─ Paid                       │
│ ○  Milestone 3   …                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ People (ledger rows)           │  Rules of this deal (ledger rows)  │
└─────────────────────────────────────────────────────────────────────┘
```

- **Left-aligned** throughout. Amounts are right-aligned only inside ledger rows, so the figures line up.
- **"Your move"** is computed for the current viewer across all milestones. It is the first thing under the total, and it is honest when there is nothing to do: "Nothing for you right now. The next thing happens in 00:41: …".
- **One track, not a stack of cards.** Milestones are rows on a vertical line inside one sheet. The node's fill shows its state: empty (pending), half (in progress), solid (decided), stamped (settled).

### Deals list

This is a ledger table, not a card grid. Rows are grouped by **"Needs you"**, **"Waiting on someone else"** and **"Finished"**. The role tabs ("I am paying / working / an arbiter") stay as a filter. Each row shows the counterparty, the amount, a phase sentence and the nearest clock.

### Wizard

The steps really are a sequence, so a numbered stepper is justified here. The right side shows a live "the agreement so far" sheet: the deal being written, in plain sentences, as you type.

## Principles

1. **Say what happens next, and when.** Every state sentence ends with the next event and its clock.
2. **Money is the headline.** Amounts are the biggest type on any screen.
3. **One accent, earned.** Violet appears only on the action you can take and on the stamp.
4. **No jargon above the fold.** No PDA, no lamports, no raw addresses outside "Details".
5. **Quality floor:** responsive to 360px, visible focus rings (2px stamp violet, offset), WCAG AA contrast, reduced motion respected.

## Review against the brief: what was changed

The first pass was "a fintech dashboard". It had a dark navy header, a gradient hero with a big number, a green "Paid" pill and rounded white cards with soft shadows. That is the generic SaaS kit, and it would fit any payments app. Changes:

- **Cards → one ledger sheet with a milestone track.** The content really is a sequence over time, so the timeline is the structure, not decoration.
- **Green "Paid" pill → violet ink stamp.** It is the subject's own artifact, and it is used only for final outcomes.
- **Cream + serif → pale ledger green + one grotesk.** Accounting paper is on-subject, and it avoids the warm-cream default.
- **Monospace for addresses → dropped.** Addresses are shortened and set in the grotesk with tabular figures; the full value lives in Details.
- **Arrows on buttons and middle-dot meta strings → dropped.** Buttons say exactly what happens ("Approve and pay 5.00 tUSDC").
