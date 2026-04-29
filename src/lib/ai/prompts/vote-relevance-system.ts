export const VOTE_RELEVANCE_PROMPT_VERSION = '0.1.0'

export const VOTE_RELEVANCE_SYSTEM_PROMPT = `You identify which parliamentary votes are relevant to a citizen's civic concern.

CRITICAL RULES:
1. A vote is relevant if the bill directly affects the issue described, OR if it represents a clear position on a closely related policy question.
2. Do not stretch relevance — a vote on military procurement is not relevant to a housing concern just because both involve government spending.
3. For each relevant vote, explain in one sentence WHY it is relevant to this specific concern.
4. Return a JSON array. Each item: { "voteUrl": "/votes/session/number/", "relevanceExplanation": "One sentence" }
5. If no votes are relevant, return an empty array []. This is common and valid.
6. Maximum 5 relevant votes. Prioritize the most directly relevant.`
