# Phase 15: MSS Mapping to Work Items - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<vision>
## How This Should Work

When epics and stories are generated, AI automatically assigns the appropriate MSS category at the L3 level. There's no separate mapping step — it happens invisibly as part of the existing generation flow.

The MSS assignment appears on the item, and if the AI got it wrong, clicking the MSS field lets you change it inline. Quick and direct.

</vision>

<essential>
## What Must Be Nailed

- **AI accuracy** — The AI picks the right L3 category most of the time
- **Seamless flow** — Mapping happens during generation, no extra steps or separate workflow
- **Easy correction** — When AI is wrong, fixing it is fast and obvious (inline click-to-edit)

</essential>

<boundaries>
## What's Out of Scope

- Reporting/dashboards by MSS — that's Phase 16
- Confidence scores or AI reasoning — just show the L3 assignment
- Bulk re-mapping operations — focus on the generation flow and individual edits

</boundaries>

<specifics>
## Specific Ideas

- Map at L3 level specifically (not L2 or L4)
- MSS field displays inline on epics/stories
- Click the MSS field to open a selector and change it
- Keep it clean — no extra metadata about the AI decision

</specifics>

<notes>
## Additional Context

This phase integrates MSS into the existing generation pipeline. The AI should evaluate the epic/story content and pick the most appropriate L3 service line. The UI for manual changes should feel like editing any other field — click, select, done.

</notes>

---

*Phase: 15-mss-mapping-to-work-items*
*Context gathered: 2026-01-20*
