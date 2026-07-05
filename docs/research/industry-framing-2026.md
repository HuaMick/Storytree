# Industry-framing brief — storytree website redesign

Researched 2026-07-05 (web pass) on top of the repo's already-verified evidence base
(`docs/research/vibe-coding-gripes-2026.md`, `docs/research/vibe-coding-coverage-map-2026.md` — survey
figures below are taken from those, not re-derived). Every claim is cited (URL + who + when). DIRECT
QUOTE vs paraphrase is marked. Each topic ends with an honest "mapping to storytree" paragraph.

---

## Executive summary

The industry vocabulary storytree needs already exists, and most of it is attributable to three or
four people. **Karpathy** (June 2025 talk, "Software Is Changing (Again)") named the
**generation–verification loop** — AI generates, humans verify, and the whole game is making that
loop fast, partly via GUIs that let humans "audit the work of these fallible systems." **"Karpathy
loop" is NOT his term** — it's 2026 commentator shorthand with at least three conflicting referents;
the website should say "generation–verification loop" and attribute the concept, not the brand.
**"Vibe coding"** is his (Feb 2, 2025, self-described "throwaway" tweet; Collins Word of the Year,
Nov 2025); Simon Willison supplies the canonical discipline-contrast ("vibe engineering," Oct 2025).
The **verification bottleneck** is now the best-evidenced pain in the field: AWS CTO Werner Vogels
gave it the crispest name — **"verification debt"** (re:Invent keynote, Dec 2025) — and Sonar
quantified the **"verification gap"** (96% don't fully trust AI code; only 48% always verify; Jan
2026). **"Second brain"** (Tiago Forte, 2017–2022) is personal knowledge management by origin, but
2025–26 dev culture has genuinely ported it to repos (CLAUDE.md/AGENTS.md conventions, an "ADR
comeback" for agent context) — usable with a "shared, not personal" caveat. **Agent orchestration**
went mainstream between Anthropic's orchestrator–worker post (June 2025) and MIT Technology Review
listing it as a top-10 AI theme (Apr 2026), with Steve Yegge ("agent fleets," "AI babysitter") and
Willison ("designing agentic loops") as the citable voices. **Map-like code visualization** has real
prior art (CodeCity 2007–08, Gource 2009) — but that lineage visualizes structure/history, not live
verification state, which is the honest novelty claim available to storytree.

The one framing storytree must never use: "we eliminate verification." The grounded claim is a
relocation: machine-checkable verification moves to system-observed, signed proofs; the human's
share (UAT, taste, decisions) shrinks in volume, rises in altitude, and becomes legible on a map.

---

## 1 · The "Karpathy loop" / generation–verification loop

### What Karpathy actually said (June 2025 talk)

Talk: "Software Is Changing (Again)" (a.k.a. "Software in the era of AI" / "Software 3.0"), YC AI
Startup School, San Francisco, June 2025. Video: Y Combinator
(https://www.ycombinator.com/library/MW-andrej-karpathy-software-is-changing-again). Quotes below are
from the third-party transcript at Singju Post
(https://singjupost.com/andrej-karpathy-software-is-changing-again/), cross-consistent with the
latent.space annotated writeup (https://www.latent.space/p/s3). **Verify against the video before
printing any as pull-quotes** (transcription, not official text).

DIRECT QUOTES (per that transcript):

- The loop itself: **"We're now kind of like cooperating with AIs. And usually they are doing the
  generation, and we as humans are doing the verification."** And: **"It is in our interest to make
  this loop go as fast as possible."**
- The leash: **"Some of them have to do with how you keep the AI on the leash."** Elaborated:
  vague prompts fail verification, so **"It makes a lot more sense to spend a bit more time to be
  more concrete in your prompts, which increases the probability of successful verification."**
  (He also reuses the leash image for education: "The AI is kept on the leash with respect to a
  certain syllabus.")
- Why GUIs matter: **"A really big one that I think also may be not fully appreciated always is
  application-specific GUI and the importance of it."** — **"Text is very hard to read, interpret,
  understand… it's much better to just see a diff as, like, red and green change."** And the line
  most relevant to storytree: **"GUI allows a human to audit the work of these fallible systems and
  to go faster."**
- Autonomy slider: **"You are in charge of the autonomy slider"** — Cursor's tab-completion →
  file-edit → whole-repo range as the worked example; he calls these **"partial autonomy apps."**
- LLM character: **"The way I like to think about LLMs is that they're kind of like people spirits.
  They are stochastic simulations of people."**
- Pace: **"this is the decade of agents"** — with **"We need humans in the loop. We need to do this
  carefully. This is software. Let's be serious here."**
- Augmentation stance: **"It's less Iron Man robots and more Iron Man suits that you want to
  build… less like building flashy demos of autonomous agents and more building partial autonomy
  products."**

### Is "Karpathy loop" an established term?

**No — it is commentator/influencer shorthand, not Karpathy's own phrase.** No primary Karpathy
source uses it. In 2026 it circulates with at least three different meanings: (a) an agentic
propose→test→commit workflow (Developers Digest, "Karpathy's Loopy Era Is the Best Way to Understand
Codex," https://www.developersdigest.tech/blog/karpathy-loopy-era-codex-agentic-engineering); (b)
recursive self-improvement (MindStudio, "What Is Recursive Self-Improvement in AI? The Karpathy Loop
Explained," https://www.mindstudio.ai/blog/recursive-self-improvement-karpathy-loop and
https://www.mindstudio.ai/blog/karpathy-joins-anthropic-karpathy-loop-explained, 2026); (c) generic
generator/evaluator agent pairs (various). **The website must not quote "the Karpathy loop" as if he
named it.** Safe usage: "the generation–verification loop Karpathy described in 2025."

### 2026 follow-ups from Karpathy

- **Dwarkesh Patel interview, Oct 2025** (https://www.dwarkesh.com/p/andrej-karpathy): reiterates
  the **autonomy slider**, insists this is "the decade of agents" not the year, "AGI is still a
  decade away"; the episode's ghost line — "We're summoning ghosts, not building animals" — is the
  published framing of the interview (paraphrase-level; check the transcript before quoting).
  Coverage: Fortune, Oct 21, 2025
  (https://fortune.com/2025/10/21/andrej-karpathy-openai-ai-bubble-pop-dwarkesh-patel-interview/).
- **Context engineering, June 25, 2025** (X, status 1937902205765607626,
  https://x.com/karpathy/status/1937902205765607626): DIRECT QUOTE: **"+1 for 'context engineering'
  over 'prompt engineering'… in every industrial-strength LLM app, context engineering is the
  delicate art and science of filling the context window"** (endorsing Tobi Lütke's term).
- **No Priors interview, ~Mar 2026** ("Andrej Karpathy on Code Agents, AutoResearch, and the Loopy
  Era of AI," https://www.youtube.com/watch?v=kwSVtQ7dziU; transcript:
  https://podscripts.co/podcasts/no-priors-artificial-intelligence-technology-startups/andrej-karpathy-on-code-agents-autoresearch-and-the-loopy-era-of-ai):
  his **autoresearch** repo (https://github.com/karpathy/autoresearch) — agents running training
  experiments in a loop; secondary breakdowns (PJFP.com) paraphrase him as spending his day
  "expressing his will to agents" and being "the orchestrator." **"Loopy era" appears in the episode
  title; confirm his own mouth before quoting.**
- **Joined Anthropic, May 19, 2026** — pre-training team (TechCrunch:
  https://techcrunch.com/2026/05/19/openai-co-founder-andrej-karpathy-joins-anthropics-pre-training-team/;
  his own X post, status 2056753169888334312: DIRECT QUOTE **"Personal update: I've joined
  Anthropic. I think the next few years at the frontier of LLMs will be especially formative…"**).
- **June 9, 2026** (via Simon Willison, https://simonwillison.net/2026/Jun/9/andrej-karpathy/):
  DIRECT QUOTE: **"I feel a lot of things changing as working software increasingly comes out on a
  tap. The Jevon's paradox kicks in and I feel my own demand for software growing substantially."**

### Mapping to storytree

Clean: storytree's honest TDD loop **is** a generation–verification loop, and the map **is**
Karpathy's "application-specific GUI" argument taken to fleet scale — a surface built so a human can
"audit the work of these fallible systems and go faster." The phase machine's bounded write-scopes
are a defensible echo of "keep the AI on the leash," and the owner-holds-decisions posture matches
his Iron-Man-suit / partial-autonomy stance. **Overclaims to avoid:** (1) Karpathy's loop keeps the
*human* verifying each generation; storytree *departs* from that by making the machine-checkable
part system-verified and signed, leaving humans only UAT/taste/decisions — present this as
storytree's thesis *extending* his framing, never as what he said. (2) He has never mentioned or
endorsed storytree. (3) Don't use "Karpathy loop" as an established term.

---

## 2 · "Second brain"

### The origin (Tiago Forte)

*Building a Second Brain* (Atria, June 2022; methodology taught since ~2017;
https://www.buildingasecondbrain.com/). Definition (paraphrase of Forte's): a **trusted external
system — outside your head — for capturing, organizing, and retrieving knowledge**, so the
biological brain is freed for thinking rather than remembering. His CODE method: Capture, Organize,
Distill, Express. Framing quote widely used in his materials: your mind is "for having ideas, not
holding them" (a line Forte borrows from David Allen — attribute to Allen if quoted). Sources:
book summary (https://readingraphics.com/book-summary-building-a-second-brain/), Maggie Appleton's
illustrated notes (https://maggieappleton.com/basb), Public Libraries Online interview (2023,
https://publiclibrariesonline.org/2023/07/building-a-second-brain-a-conversation-with-tiago-forte/).
**Scope note: Forte's subject is PERSONAL knowledge management (PKM) — notes, projects, life admin —
not codebases.**

### 2025–26: the term migrates to repos and AI dev-tooling

- **Repo-level agent memory became a convention.** OpenAI-originated **AGENTS.md** — "a README for
  agents" (https://agents.md/) — launched Aug 2025; **20,000+ GitHub repos by Sept 2025** (InfoQ:
  https://www.infoq.com/news/2025/08/agents-md/); donated to the Linux Foundation's **Agentic AI
  Foundation** (Dec 2025, alongside Anthropic's MCP;
  https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation).
  Anthropic's CLAUDE.md plays the same role for Claude Code. (A "60k+ projects by year-end 2025"
  figure circulates via blog posts — secondary, use the InfoQ 20k+ if a number is needed.)
- **"Second brain" applied to coding agents is live grassroots usage, not one canonical author:**
  e.g. "How I Built a Second Brain for Claude Code" (Hugo Sequier, Medium,
  https://medium.com/@sequierh/how-i-built-a-second-brain-for-claude-code-b49b3104b386);
  GitHub projects coleam00/second-brain-starter, huytieu/COG-second-brain (CLAUDE.md + AGENTS.md +
  worker agents), eugeniughelbur/obsidian-second-brain (https://github.com/topics/second-brain).
  Several cite a "Karpathy LLM Wiki pattern" — folklore-grade, don't cite.
- **ADRs as institutional memory — and an agent-driven comeback.** Origin: Michael Nygard,
  "Documenting Architecture Decisions," 2011 (canonical index: https://adr.github.io/; Fowler bliki:
  https://martinfowler.com/bliki/ArchitectureDecisionRecord.html). The standing claim: ADRs turn
  "why we decided" from oral tradition into a written record. 2026 twist, multiple sources: **the
  reader of ADRs is increasingly an agent, not a person** — "The ADR Comeback: Anchoring Agentic
  Engineering Teams" (Rick Pollick, https://rickpollick.com/blog/adr-comeback-anchoring-agentic-engineering-teams);
  Catio's 2026 ADR guide (https://www.catio.tech/blog/architecture-decision-record) notes the strain:
  a static ADR can't tell an agent whether the decision *still holds*. Adjacent research: "Lore:
  Repurposing Git Commit Messages as a Structured Knowledge Protocol for AI Coding Agents"
  (arXiv:2603.15566).

### Mapping to storytree

Clean: storytree's Library + ADR decision log is exactly "externalized, trusted decision memory that
agents pull just-in-time" — and storytree even answers the 2026 critique of static ADRs (statuses,
supersession edges, a queryable live decision log, and a graduation loop that turns session memory
into durable artifacts). The session-amnesia gripe ("every new conversation is his first day," in
the repo's gripes doc) is the pain this addresses. **Overclaims to avoid:** (1) Don't imply Forte
wrote about codebases — say "second-brain-*like*" or "a second brain *for the team and its agents*,"
distinguishing shared team/agent memory from his personal PKM. (2) Don't claim CLAUDE.md/AGENTS.md
"solved" memory — the convention is a bootstrap file; storytree's claim is the *pull-based, versioned
decision graph* behind it, which is genuinely more than the convention offers.

---

## 3 · "Vibe coding"

### The coinage

Andrej Karpathy, X, **Feb 2, 2025** (status 1886192184808149383,
https://x.com/karpathy/status/1886192184808149383). DIRECT QUOTE (opening, verbatim): **"There's a
new kind of coding I call 'vibe coding', where you fully give in to the vibes, embrace exponentials,
and forget that the code even exists. It's possible because the LLMs (e.g. Cursor Composer w Sonnet)
are getting too good."** The same tweet describes talking to Composer via SuperWhisper, "Accept
All"-ing diffs without reading them, pasting error messages with no comment — and scopes it:
fine/amusing **for "throwaway weekend projects"** (quote the scoping with that hedge; the full tweet
text is on the X status). ~4.5M views (CodeRabbit's history:
https://www.coderabbit.ai/blog/a-semantic-history-how-the-term-vibe-coding-went-from-a-tweet-to-prod).
In Feb 2026 Karpathy called it, DIRECT QUOTE, **"a shower of thoughts throwaway tweet that I just
fired off"** (https://x.com/karpathy/status/2019137879310836075).

### The drift, the correction, the mainstreaming

- **Drift:** within weeks the term was being applied to *all* AI-assisted coding. **Simon Willison's
  canonical correction, Mar 19, 2025** ("Not all AI-assisted programming is vibe coding (but vibe
  coding rocks)," https://simonwillison.net/2025/Mar/19/vibe-coding/): DIRECT QUOTE: **"If an LLM
  wrote every line of your code, but you've reviewed, tested, and understood it all, that's not vibe
  coding in my book—that's using an LLM as a typing assistant."** Vibe coding proper = *building
  software without reviewing the code the model writes.*
- **The disciplined pole got its own name:** Willison coined **"vibe engineering"** (Oct 2025,
  https://simonw.substack.com/p/vibe-engineering) — experienced engineers + agents + tests, planning,
  documentation, review.
- **Mainstream:** **Collins Dictionary Word of the Year 2025** (announced Nov 6, 2025 — Collins:
  https://www.collinsdictionary.com/us/woty; blog:
  https://blog.collinsdictionary.com/language-lovers/collins-word-of-the-year-2025-ai-meets-authenticity-as-society-shifts/;
  CNN: https://www.cnn.com/2025/11/06/tech/vibe-coding-collins-word-year-scli-intl). Collins defines
  it broadly (natural language → AI → code) — i.e. the *dictionary* enshrined the drifted meaning,
  not Karpathy's narrow one. Steve Yegge & Gene Kim published a book titled *Vibe Coding* (2025;
  https://changelog.com/friends/96). Backlash/gripe evidence: the repo's own verified base
  (SO 2025: 84% use / ~29% trust / 66% "almost right, but not quite" as #1 frustration).

### Mapping to storytree

Clean: storytree can honestly position against vibe coding's *production* failure mode — "forget
that the code even exists" is precisely what a signed-proof map refuses to let happen — and align
with Willison's vibe-engineering pole (tests, review discipline, verification) while adding its own
mechanism (the *system*, not the agent, observes red→green and signs). **Overclaims to avoid:** (1)
Don't sneer at Karpathy — he scoped vibe coding to throwaway projects himself; the honest target is
the drifted, production-scale usage. (2) If the site uses "vibe engineering," attribute Willison.
(3) Collins WOTY is a fact about the *broad* sense; don't cite Collins as defining Karpathy's
original narrow sense.

---

## 4 · The verification bottleneck

### The crispest attributable framings (ranked for quotability)

1. **Werner Vogels (AWS CTO), re:Invent keynote, Dec 2025 — "verification debt."** DIRECT QUOTE (as
   reported from the keynote): **"You will write less code, 'cause generation is so fast, you will
   review more code because understanding it takes time. And when you write code yourself,
   comprehension comes with the act of creation. When the machine writes it, you'll have to rebuild
   that comprehension during review. That's what's called verification debt."** Coverage:
   IT Pro (https://www.itpro.com/software/development/software-developers-not-checking-ai-generated-code-verification-debt),
   keynote writeups (https://www.implicator.ai/werner-vogels-hands-out-newspapers-at-his-likely-final-re-invent-the-man-who-built-the-cloud-isnt-done-teaching/,
   https://cloudelligent.com/blog/werner-vogels-aws-reinvent-2025/). *Verify the sentence against the
   keynote video before using as a display quote — sourced from coverage, not an official
   transcript.*
2. **Karpathy, June 2025** — the generation–verification loop quotes in §1: humans are the
   verification half, "make this loop go as fast as possible."
3. **Sonar — the "verification gap," Jan 2026** (press release:
   https://www.sonarsource.com/company/press-releases/sonar-data-reveals-critical-verification-gap-in-ai-coding/;
   The Register, Jan 9, 2026: https://www.theregister.com/2026/01/09/devs_ai_code/). Survey of
   1,100+ developers: **96% do not FULLY trust AI-generated code** to be functionally correct; only
   **48% always verify** AI-assisted code before committing; AI accounts for **~42% of committed
   code**, expected 65% by 2027; **38%** say verifying AI code takes *more* effort than reviewing a
   colleague's (27% less). Keep the word "fully" — headlines drop it.
4. **Boris Cherny (creator/head of Claude Code)** — the most-repeated practitioner version: the
   most important thing for results is **giving the agent a way to verify its own work** (browser,
   tests, iteration). Documented in secondary sources: Lenny's Podcast episode + writeups
   (https://www.lennysnewsletter.com/p/head-of-claude-code-what-happens; workflow breakdowns:
   https://karozieminski.substack.com/p/boris-cherny-claude-code-workflow;
   https://howborisusesclaudecode.com/). **Paraphrase-grade — pull the exact sentence from the
   Lenny's episode before direct-quoting.**

### The data (already verified in-repo — cite from there, with its hedges)

From `docs/research/vibe-coding-gripes-2026.md` (adversarially verified 2026-07-03): SO 2025
(n≈49k): 84% use AI tools, ~29% trust accuracy (down from 40%), 3.1% highly trust; **66% = the
"almost right, but not quite" #1 frustration (a prevalence figure, NOT time-spent); 45.2% =
debugging-AI-code-is-more-time-consuming** (never fuse the two). METR RCT: the **~40pp
perception-vs-reality gap** is robust; the **−19% point estimate is contested by METR itself**
(cite as a scoped 2025 result, never "AI slows everyone down"). GitClear (211M lines): clones
8.3%→12.3%, refactoring 25%→<10%. Security: **~45% of AI code introduces an OWASP Top-10 flaw;
security pass-rate flat ~55% for two years while functional correctness climbed ~50%→95%**
(Veracode — scope: vendor SAST on security-sensitive tasks without security prompting, not "45% of
all AI code"). Stanford Digital Economy Lab: agentic coding ≈1000× tokens, up to 30× cost variance.
The new Sonar figures complement (do not contradict) this base.

### Mapping to storytree

Clean: this is storytree's center of gravity, and the honest sentence is **relocation, not
elimination**: machine-checkable verification moves to system-observed, signed proofs (the agent
never grades its own homework; a halted run is never a pass), and the *remaining* human verification
— UAT, taste, decisions — is made cheap and legible on the map. Vogels' "rebuild comprehension
during review" maps directly to what the map + signed verdicts pre-pay. **Overclaims to avoid:** (1)
"storytree eliminates the verification bottleneck / review" — false; the coverage map's own honest
limit says the gate proves red→green against *declared* contracts, not semantic rightness; the
IEEE-style "plausible wrongness" case is caught by human UAT, not the machine. (2) Security: Veracode
data is about a dimension storytree's proof model does NOT yet cover (owner-acknowledged gap) — the
site must not imply "proven" includes "secure." (3) Don't quote "96% don't trust" without "fully."

---

## 5 · Agentic coding / multi-agent orchestration (2026 discourse)

### The arc: autocomplete → agents → fleets

- **Steve Yegge's wave model** — "Revenge of the Junior Developer" (Sourcegraph blog, Mar 2025,
  https://sourcegraph.com/blog/revenge-of-the-junior-developer): six waves — traditional →
  completions (2023) → chat (2024) → **coding agents (2025 H1) → agent clusters (2025 H2) → agent
  fleets (2026)**. Yegge literally retitled himself **"AI babysitter"** and runs 20–30 concurrent
  Claude instances in his orchestrator **Gas Town** (with "Beads" work tracking) — Software
  Engineering Daily, Feb 2026
  (https://softwareengineeringdaily.com/2026/02/12/gas-town-beads-and-the-rise-of-agentic-development-with-steve-yegge/);
  Changelog & Friends #96 ("Adventures in babysitting coding agents,"
  https://changelog.com/friends/96); Aviator, "The Rise of Coding Agent Orchestrators"
  (https://www.aviator.co/blog/the-rise-of-coding-agent-orchestrators/).
- **Simon Willison** — "Designing agentic loops" (Sept–Oct 2025,
  https://simonw.substack.com/p/designing-agentic-loops) and "Agentic Engineering Patterns" (Feb
  2026, https://simonwillison.net/2026/Feb/23/agentic-engineering-patterns/): *agentic engineering* =
  building with agents that can generate AND execute/test code, iterating "independently of
  turn-by-turn guidance from their human supervisor"; the new skill is designing the loop the agent
  runs in.
- **Anthropic (canonical vendor voice)** — "How we built our multi-agent research system" (June 13,
  2025, anthropic.com/engineering; Willison's summary:
  https://simonwillison.net/2025/Jun/14/multi-agent-research-system/): the **orchestrator–worker
  pattern** (lead agent plans, spawns 3–5 parallel subagents, synthesizes); beat single-agent Opus 4
  by 90.2% on their internal eval; cost ≈**15× the tokens** of chat. That cost line corroborates the
  Stanford ~1000× economics above.
- **Karpathy** — Dwarkesh (Oct 2025): the human keeps the autonomy slider; No Priors (Mar 2026):
  paraphrased as "you are the orchestrator," maximizing agent throughput rather than typing.
- **Mainstreaming** — MIT Technology Review, Apr 21, 2026: "Agent orchestration" as one of "10
  Things That Matter in AI Right Now"
  (https://www.technologyreview.com/2026/04/21/1135654/agent-orchestration-ai-artificial-intelligence/);
  Deloitte 2026 predictions on agent orchestration
  (https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-agent-orchestration.html).
- **"Human as manager/tech lead of agents"** — the *idea* is everywhere (Yegge's babysitter, agent
  bosses in enterprise coverage), but the widely-circulated stats ("90% of engineers now orchestrate,"
  "1,445% surge") come from SEO content with no traceable methodology — **do not cite them.** The
  repo's verified Glean figure (~6.4 hrs/week "botsitting") is the citable supervision-burden number.

### Mapping to storytree

Clean: storytree sits squarely in wave 5–6 vocabulary — it IS an agent-orchestration system — and
its differentiator is honestly stateable: where Gas Town-style orchestrators coordinate *throughput*,
storytree's spine is a *proof* orchestrator (deterministic phase machine, signed verdicts) and its
overview surface is a map instead of 15 terminals (the terminal-sprawl gripe is verbatim in the
evidence base). "Human as manager" matches storytree's actual discipline (owner holds the outer
loop, decisions, UAT). **Overclaims to avoid:** (1) Don't imply the industry converged on
proof-carrying orchestration — nobody else's orchestrator signs verdicts; that's the pitch, not the
norm. (2) Don't borrow Yegge's 30-agent scale numbers as if they were storytree benchmarks. (3)
Anthropic's post is about a *research* system — cite it as the orchestrator–worker pattern's
canonical writeup, not as an endorsement of coding fleets.

---

## 6 · Spatial/visual codebase maps (brief prior art)

The "code as a place" idea has a real research-and-hobbyist lineage. **CodeCity** (Richard Wettel &
Michele Lanza, ~2007–08) rendered OO systems as navigable 3D cities — classes as buildings (height =
methods, base = attributes), packages as districts (https://wettel.github.io/download/Wettel08a-icse-tooldemo.pdf;
the "software city" metaphor spawned a whole subfield, incl. VR variants like SecCityVR,
arXiv:2504.18238). **Gource** (Andrew Caudwell, ~2009) animates version-control history as a growing
tree with developers as fireflies — beloved for time-lapses, not for operating anything. Adjacent:
CodeScene's behavioral "hotspot" maps (Adam Tornhill), GitHub's octo repo-visualization experiments.
**The honest distinction for storytree:** that lineage visualizes *static structure* or *past
history* of human work, as an analysis/novelty layer. storytree's map is a *live control-and-signal
surface for agent work* where color is a claim with a proof behind it (green = signed verdict, wisps
= live sessions). Say "echoes CodeCity/Gource" for familiarity, claim novelty only for
*signal-bearing, proof-backed, live* — not for "first to draw code as a place."

---

## Copy-ready framings (each with its grounding + honesty note)

1. **"Agents generate. The system verifies. You decide."** — Grounded in Karpathy's own division of
   labor ("they are doing the generation, and we as humans are doing the verification," June 2025
   talk) with storytree's stated twist: the machine-checkable half of verification moves to the
   system. Honest so long as the twist is presented as storytree's thesis, not Karpathy's.
2. **"Green is a signed proof, not an agent's word."** — Grounded in the verified grades-own-homework
   / reward-hacking gripes (gripes doc §A; Anthropic/Redwood research) and storytree's actual
   mechanism (spine-observed red→green, signed verdict, halt-is-never-a-pass).
3. **"The bottleneck moved from writing code to trusting it."** — Grounded: SO 2025 (84% use, ~29%
   trust), Sonar Jan 2026 (96% don't *fully* trust; 48% always verify), Vogels' verification-debt
   keynote. Safe because it claims the industry's diagnosis, not storytree's cure.
4. **"Verification debt — the comprehension you must rebuild when a machine wrote the code — is the
   cost storytree pre-pays with signed proofs and a legible map."** — Vogels (re:Invent, Dec 2025),
   attributed; the "pre-pays" clause is storytree's claim and scoped to machine-checkable proof +
   legibility, not total understanding.
5. **"Karpathy said the GUI's job is to let a human 'audit the work of these fallible systems and go
   faster.' The map is that GUI, for a whole fleet."** — Direct talk quote (verify against video);
   the fleet extension is ours and reads as such.
6. **"A second brain for the codebase — every decision recorded once, pulled just-in-time by every
   agent."** — Grounded in Forte's term (origin: personal PKM — hence "for the codebase," which
   signals the borrow), the 2025–26 repo-memory wave (AGENTS.md 20k+ repos, InfoQ), and the
   agent-era ADR comeback. Avoids claiming Forte covers code.
7. **"Vibe coding means forgetting the code exists. This is the opposite discipline: nothing turns
   green until the system watched it fail and then watched it pass."** — Karpathy's Feb 2025 tweet
   (drift documented by Willison, Mar 2025; Collins WOTY Nov 2025); mechanism claim matches the
   prove-it-gate exactly.
8. **"Stop babysitting terminals. Watch one forest."** — Grounded in the verified supervision pains
   (terminal sprawl, ~6.4 hrs/week botsitting, Yegge's "AI babysitter") and the map's actual role;
   claims an overview, not autonomy.

---

## Consolidated honesty flags

- **"Karpathy loop" is not Karpathy's term** — community shorthand with conflicting referents; use
  "generation–verification loop," attributed as a description.
- **Talk quotes are from a third-party transcript** (Singju Post) — check against the YC video
  before display use. Same for the Vogels keynote sentence (from press coverage).
- **Karpathy has not endorsed storytree** or system-signed verification; his model keeps the human
  verifying each step. Frame storytree as extending, not implementing, his loop.
- **Boris Cherny's "verify its work"** is paraphrase-grade from secondary writeups — pull the exact
  line from Lenny's Podcast before direct-quoting.
- **Forte = personal PKM**; "second brain for a codebase" is 2025–26 community usage. Attribute the
  term to him, the application to the community.
- **Numbers discipline (from the in-repo verified base):** 66% = frustration prevalence, not time
  spent; 45.2% = debugging time; METR −19% contested (perception gap ~40pp survives); Veracode 45% is
  scoped to security-sensitive SAST tasks; Sonar is "don't FULLY trust." Never use the "90% of
  engineers orchestrate" / "1,445% surge" SEO stats.
- **storytree limits that must survive into copy:** verification is relocated, not eliminated; green
  = proven against *declared* obligations (not semantic rightness, not security — both
  owner-acknowledged gaps); duplication is not detected by roads; human UAT/taste is the deliberate
  backstop, staged as an owner-attested leg.
