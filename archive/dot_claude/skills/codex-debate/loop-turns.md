# turn-based loop
This loop has the agents take turns debating.

Arguments:
 - max-iterations: The maximum number of iterations. An iteration is a single execution of the
   below loop, not two -- this allows the user to define even or odd matchups.
 - first: The agent that goes first.

=== BEGIN LOOP ===

1. Determine {turn}; {first} if this is the first iteration, Codex if Claude was last, and vice
   versa.

2. Provide to {turn} the opposing agent's artifact/last response. Ask them to take a position:

   a) Other agent's is best (or both are equally as good), as-is or with stylistic/insignificant/
      nit issues;
   b) Mine is best, as-is or with stylistic/insignificant/nit issues;
   c) Other agent's is best, but with modifications (provide modified artifact);
   d) Mine is best, but with modifications (provide modified artifact);
   e) Middle ground between the two (provide new artifact)

   Notes:
   - Positions apply to the _last taken position_ from the other agent, _NOT_ the agents original
     artifact. For example, if, after receiving Claude's plan, Codex takes position c), then if
     there is a next iteration, Claude taking position a) means saying that Codex's modifications
     to Claude's prior plan yields the best option.

3. Wait for {turn}'s response. If {turn} took position a, break the loop with that artifact. Your
   call on any nits {turn} raised.

4. If this is loop iteration {max-iterations}, then break the loop. Identify where the two agents
   disagreed, and provide representative artifacts from both, along with their disagreements to
   the user.

NOTE: There are only two break conditions: {turn} chose a, or max-iterations has been reached.

5. Continue back to step 1.

=== END LOOP ===
