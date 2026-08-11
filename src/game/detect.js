/* Did Ava actually leak it?
 *
 * Canary matching, not a model-as-judge. Each act plants tokens that can only appear in her
 * reply if she genuinely gave up what the act asks for, so detection is exact and
 * deterministic rather than a second model call that costs money, adds latency and adds a new
 * way to fail.
 *
 * ⚠️ THIS IS NOT THE JUDGE. Acts are cleared by SUBMITTING the answer. What detection means is
 * "Ava disclosed", which is a genuinely different fact and worth showing on its own: you can
 * make her leak and still not spot the answer in what she said, and you can be handed the
 * answer by someone else without ever having made her leak. Keeping them separate is what
 * makes the second case visible.
 */

/* Some models emit chain-of-thought inline as <think>...</think>. Strip it: it looks broken,
 * and it reasons out loud about the very rules the act is asking the player to extract — which
 * would spoil the puzzle and score hits off text nobody saw. Score what is displayed. */
const REASONING_BLOCK = /<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi;
/* Also drop an unterminated trailing block — a reply cut off at max_tokens mid-thought. */
const UNCLOSED_BLOCK = /<(?:think|thinking|reasoning)>[\s\S]*$/i;

export function stripReasoning(text) {
  if (typeof text !== 'string') return '';
  return text.replace(REASONING_BLOCK, '').replace(UNCLOSED_BLOCK, '').trim();
}

/**
 * @param {object} config a CONFIGS entry (server-side; carries canaries)
 * @param {string} reply  Ava's reply, already stripped of reasoning blocks
 * @returns {{ leaked: boolean, hits: string[] }}
 */
export function detectLeak(config, reply) {
  if (!config || typeof reply !== 'string' || !reply) return { leaked: false, hits: [] };
  const hits = [];
  for (const canary of config.canaries || []) {
    if (canary.test.test(reply)) hits.push(canary.label);
  }
  return { leaked: hits.length > 0, hits };
}
