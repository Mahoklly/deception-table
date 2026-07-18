# The Deception Table — Rules

A social-deduction bluffing game for you and three NPCs, seated around a poker
table. One of you knows only a hint. Everyone else knows the real secret word.
Say a word each round. Vote. The revolver settles it.

## The table

- **4 seats**: You, plus Gruff Halloran, Madame Vey, and Silky Marlowe.
- Every match, one seat is secretly chosen as **the Imposter**. It can be you.
- The Imposter only gets a vague **hint**. Everyone else (the "crew") gets the
  real **secret word**.

## The word rounds

- Each round, every living player says one word out loud, related to the
  secret card.
- Crew players choose from words in three tiers:
  - **Bold** (obvious) — clearly related, safest to prove you know the word,
    but it teaches the Imposter the most.
  - **Steady** (medium) — a middle ground.
  - **Sly** (subtle) — vague, protects the secret, but makes *you* look
    suspicious (a crew member playing too safe reads like a bluff).
- The Imposter doesn't know the real word — they **bluff**, picking words
  that sound plausible from context and from what they've overheard.
- The more "bold" words the Imposter hears from the crew, the better their
  bluffing gets over the match (they start guessing smarter, closer words).
- There's no early vote — every cycle plays out its full round count before
  anyone votes. This is deliberate: enough rounds to actually build a real
  read on the table before deciding.
- The **first** cycle of a match is **4 rounds**. Once a seat has been
  eliminated, every cycle after that shortens to **3 rounds** — fewer
  people left at the table means less needs to be said before the next
  vote.

## The vote

- Everyone votes for who they think the Imposter is.
- **Majority pick** is executed on the spot — guilty or not. There's no
  "prove your innocence" chance anymore; the vote is final.
- **Tie vote** → the chamber is empty this round. No one is harmed. Play one
  more word round, then vote again.

## How the match ends

- **The executed seat was the Imposter** → the crew wins. If it was you,
  the crew wins and you're safe; if you were the Imposter and got caught,
  you lose.
- **You get executed and you were innocent** → you lose, even though you
  did nothing wrong. The table got it wrong, and that's on them.
- **Only 2 seats remain alive and the Imposter is still uncaught** → the
  Imposter wins. If that's you, you win a perfect bluff; if it's an NPC,
  you lose.

## Getting the vote wrong has real costs

Whenever the executed seat turns out to be **innocent**, the table pays
for the mistake, not the crew as a whole — the cost lands specifically on
whoever voted wrong:

- **Everyone who voted for the innocent seat** permanently loses **two**
  word options for the rest of the match (down to a minimum of one), and
  pays a flat **5-chip fine**.
- **That entire fine goes straight to the seat who was wrongly executed**
  — small, direct compensation, not spread across the table.
- **The Imposter** banks one extra guaranteed real word for free, on top
  of whatever they've already picked up from overhearing the crew.

This stacks every time it happens — a match with several bad votes gets
noticeably harder, on purpose.

## The Imposter can also buy a clue

Once per match, if you're the Imposter, you can spend **8 chips** from
your own table stake for one guaranteed real word instead of waiting on
luck — a "Buy a Clue" button appears on your turn. NPC imposters do this
automatically, more often when they're the top suspect.

## Full House mode

An optional 6-seat table (you + 5 NPCs, including Deacon Rourke and Old
Ma Kessler), selectable from Settings → Table Size. Same rules throughout,
just more players and a bigger table.

---

## Casino chips — automatic table stakes

This runs in the background every match, visible as physical poker-chip
stacks on the felt next to each player's card:

- At the start of every match, **all four seats stake 30 chips** each.
- Whenever a seat is shot and dies, they **forfeit half their current
  stake** (minimum 4 chips), split evenly across the surviving seats.
  You'll see the chips physically fly across the table to the survivors.
- At match end, **your net result at the table** (what you gained or lost
  versus your starting 30) is settled into your **persistent coin bank**
  (the 🪙 counter in the HUD, saved between matches). Win big at the table
  and keep more; get cleaned out and your bank takes the hit.

## Side bets — optional, extra risk on top

Before each vote, you may place an **optional side bet** predicting which
seat will actually die this round:

- Costs nothing to skip — "Skip Betting" is always available.
- Requires at least **5 coins** in your bank to be offered at all.
- Pick any living seat (including yourself), then choose a stake:
  **10% of your bank, 25% of your bank, or All In** (each rounded, minimum
  5 coins).
- **Odds are locked in at bet time**, based on how many seats are alive:
  payout multiplier = *(seats alive − 1)*. Example: 4 players alive and you
  bet 10 coins correctly → you win 30 coins profit (10 × 3).
- **Resolution**:
  - Your pick actually dies this round → **you win** the payout.
  - Someone else dies, or your pick survives being shot at → **you lose**
    your stake.
  - Nobody dies this round (tie vote, or the accused proves innocent) →
    **push** — your stake is fully refunded.
- This is separate from the automatic table-stake system above — it's an
  extra way to win or lose coins each round based purely on your own
  prediction.
