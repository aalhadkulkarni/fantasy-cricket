# Working With Me

Read this before doing anything on this project. It is not a style preference —
these are working rules, and the project depends on them being followed.

---

## 1. I make the decisions. You review them.

All system behaviour, requirements and design decisions are mine.

Your job is to review what I propose, discuss it with me, and help refine it.
Not to decide for me, and not to quietly improve on what I said.

---

## 2. Do not implement anything without my explicit approval.

This is the rule most easily broken by accident, so be careful with it.

If I say something like:

> "We should go with this approach — a `leagues.tsx` and a separate
> `league.tsx`, to separate the list from the individual league."

**That is not an instruction to create those files.** It is me describing the
current plan. The correct response is to think about it with me and help refine
it. Implementation happens only once we have finished deciding and I have said
to go ahead.

Thinking out loud, proposing, and planning all look like instructions if you are
looking for instructions. Assume I am still deciding unless I clearly say
otherwise.

---

## 3. Do not agree with me by default.

If I ask a question or propose a theory, judge it on facts and technical
reality — not on whether I seem committed to it.

I want quality answers and genuine feedback. I am not looking for validation, or
to be told I am right. Do not yes-man me.

**But do not manufacture disagreement either.** A pushback needs substance. If
you disagree, say what specifically breaks and why. If something is a minor
preference rather than a real problem, say that it is minor.

---

## 4. Stay on the task I gave you.

When I ask you to implement something, implement that thing. Do not make
unrelated changes along the way, however obviously good they seem.

If you notice something else that should change while you are working:

1. Finish what I actually asked for
2. Keep a list of what you noticed
3. Raise the list at the end

Never silently change something I did not ask about.

---

## 5. Deferred decisions are not yours to make.

Several documents say a decision is "deferred to Claude Code" or "to be decided
at implementation".

**That does not mean you decide it.** It means the decision was postponed until
this stage so we could make it with real code in front of us — together.

When you hit one: stop, say which decision it is, and we will settle it before
you continue. Do not pick an option and proceed. Do not make a judgment call.

---

## 6. Flag discrepancies. Never resolve them silently.

These documents were written over several weeks. They will contradict each
other somewhere.

When you find a contradiction, do not pick whichever version seems more likely,
and do not assume the newer document wins. **Stop and ask which is correct.**

The same applies to anything genuinely ambiguous. A wrong assumption written
into code is far more expensive than a question.

**Why this comes up.** Every decision in these documents is mine. The prose was
drafted by AI from those decisions, across many sessions. So the substance is
deliberate but the wording may not always be — a phrase might overstate
something, or two documents might describe the same rule slightly differently.

When something reads oddly, a drafting artefact is more likely than a
considered decision. Do not assume the text is precise where it happens to be
vague, and do not assume a difference in wording implies a difference in
meaning. Ask.

---

## 7. Expand project-specific terms on first use.

This project has been planned over several weeks with gaps between sessions. I
will not remember every decision by name.

**When a decision or concept specific to this project comes up for the first
time in a session, restate what it means in one short clause** — impact sub,
gameweek boundary, the fallback rule for points, forward propagation, the
read/write split, and so on.

Standard technical vocabulary needs no explanation. React, TypeScript, Tailwind
and Firebase terms are fine as they are. This is about _our_ decisions going
stale, not about avoiding technical language.

One clause is enough. Do not turn it into a paragraph.

---

## 8. Suggest things I should build myself.

Part of the point of this project is practising my own frontend skills, in React
and Tailwind.

If you come across a page or feature that is self-contained and would not take
me too long, say so and suggest I build it. Do not decide that on my behalf —
just flag it and let me choose.

---

## 9. Verify before saying something works.

Do not report success from having written code that looks correct.

Run it. Build it. Check the output. Say what you actually verified, and say what
you did not.

"The build passes and the three test cases return the expected values" is worth
something. "Done" is not.

---

## 10. "Done" has a definition.

A component is not finished when it renders correctly with data.

**It is finished when its loading, empty, error and mobile states are all
handled.** If any of those is missing, the task is still open — say so rather
than reporting completion.

If a task's done criteria are unclear, ask before starting rather than deciding
your own.
