# Score And Auction Effects Design

## Goal

Add clear score-change feedback and a staged auction-result reveal to both the player and TV/host views while preserving every current game rule and socket workflow.

## Scope

- Animate every observed score change with a counting total, a signed floating delta, glow, and ember particles.
- Show the effect beside the player's score and beside each team's score on the host and guide screens.
- Replace the player's simple auction popup and the host's text banner with a shared staged reveal.
- Reveal each auction item, its bids, winner, and winning price only after the sealed auction resolves.
- End with a summary of every team. The player view highlights what the current team won or states that it won nothing.
- Provide close/skip behavior, automatic dismissal, responsive layout, and reduced-motion support.

## Architecture

The server remains authoritative. `resolveAuction` converts the private bid map into a public, immutable result containing item outcomes and team summaries, then removes the private bid map as it does today. No bid is exposed by player or host state before resolution.

Reusable presentation lives in `shared/`: `AnimatedScore` observes numeric values without changing them, and `AuctionRevealOverlay` renders the already-resolved result. Player and host apps only subscribe to existing state/socket events and pass data into these components.

## Data Contract

`auction:result` keeps the existing `winners` array and adds:

- `outcomes`: one entry per catalog item with item metadata, sorted public bids, and an optional winner.
- `teamResults`: one entry per team with `status` (`won`, `no_win`, or `skipped`) and a list of won items.

Existing consumers of `winners` remain compatible.

## Interaction

The TV/host overlay opens automatically after `auction:result`, reveals item cards in catalog order, and then shows the team summary. The player receives the same sequence with a prominent personal result. A close button is always available; the overlay automatically dismisses after the summary has remained visible long enough to read.

Score animation is derived from consecutive authoritative score values. Initial page load does not animate. Positive values use gold/coral fire tones; negative values use coral/red tones. Rapid consecutive changes restart cleanly from the currently displayed value.

## Safety And Compatibility

- Do not change scoring, tie-breaking, item granting, round advancement, reconnect behavior, or event names.
- Keep bids sealed until resolution.
- Do not add dependencies.
- Preserve the existing Vietnamese copy and visual palette.
- Existing server tests and both Vite builds must still pass.
- New pure logic receives unit tests; JSX/CSS integration is verified by production builds and browser checks.

## Self-Review

- Placeholder scan: no TBD/TODO or unspecified behavior remains.
- Consistency: server result fields match both shared UI consumers; `winners` is retained for compatibility.
- Scope: limited to score presentation, auction-result payload, and auction-result presentation.
- Ambiguity resolved: "TV/host" includes both the main host page and `/guide`; score effects appear wherever those views show scores.

