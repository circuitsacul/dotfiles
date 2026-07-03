# parallel loop
This loop runs both agents at the same time, exchanging responses until convergence.

Arguments:
 - max-iterations: The maximum number of times to execute this loop.

=== BEGIN LOOP ===

1. You should have responses from both agents (if not, wait for both to finish first.) Provide
   each agent's last response to the other. Ask them to take a position, with detailed reasoning:

   a) Codex's is best, as-is or with stylistic/insignificant/nit issues;
   b) Claude's is best, as-is or with stylistic/insignificant/nit issues;
   c) Codex's is best, but with modifications (provide modified artifact);
   d) Claude's is best, but with modifications (provide modified artifact);
   e) Middle ground between the two (provide new artifact)

   Notes:
   - Positions apply to the _last taken position_ from the other agent, _not_ the agent's
     original artifact. For example, if, after receiving Claude's plan, Codex takes position d),
     then if there is a next iteration, Claude taking position a) means saying that Codex's
     modifications to Claude's prior plan yields the best option.
   - The closer to convergence the agents get, the more likely for a/b/c/d to actually mean the
     same thing.

2. Wait for the agents to respond.
   - If both took the same position of a) or b), break the loop with the corresponding artifact.
   - If both chose a different position _other than e_, but actually end up with identical
     artifacts, break with the artifact.
   - If this is the {max-iterations}th iteration (each swap is one iteration, counting from 1),
     break the loop and return both artifacts, along with a summary of the disagreements, to the
     user.
   - Otherwise, fall through to the next step.

3. Continue to step 1.

=== END LOOP ===
