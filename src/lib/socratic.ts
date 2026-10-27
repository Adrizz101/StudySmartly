interface SocraticContext {
  subject: string;
  question: string;
}

const SOCRATIC_STARTERS = [
  "Let's think about this step by step. What do you already know about {topic}?",
  "Good question. Before I give you the answer, can you tell me what you think the key concept here is?",
  "Let me guide you: What happens when you apply {topic} to this scenario? What would you expect to occur?",
  "I'll help you reason through this. First, what assumptions are we making in this problem?",
  "Consider the underlying principle. How does {topic} relate to what you've studied so far?",
  "Let's break this down. What are the inputs and what are we trying to find?",
  "Think about this from a different angle: if the opposite were true, what would that imply about {topic}?",
  "What evidence or formulas might apply here? Can you identify which one is relevant?",
];

const FOLLOWUPS = [
  "You're on the right track. Now, how does that connect to the main question?",
  "Interesting. Can you elaborate on why you think that?",
  "What would you need to verify that? Is there a formula or principle that confirms it?",
  "Let's go deeper: what are the implications of that answer?",
  "Good reasoning. Now apply that to the original problem — what do you get?",
  "What if one of your assumptions changed? How would the answer differ?",
];

const ENCOURAGEMENT = [
  "Great progress! You're developing strong analytical skills.",
  "You're thinking like a true scholar. Keep going.",
  "That's a solid line of reasoning. Let's build on it.",
  "Excellent — you're connecting the dots well.",
];

export function generateSocraticResponse(ctx: SocraticContext, turn: number): string {
  const topic = ctx.subject || 'this topic';

  if (turn === 0) {
    const starter = SOCRATIC_STARTERS[Math.floor(Math.random() * SOCRATIC_STARTERS.length)];
    return (starter ?? 'What do you already know about {topic}?').replace('{topic}', topic);
  }

  if (turn < 5) {
    const followup = FOLLOWUPS[Math.floor(Math.random() * FOLLOWUPS.length)];
    return followup ?? 'Can you explain your reasoning?';
  }

  const enc = ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)];
  return `${enc} You've worked through the key ideas. If you'd like, try a related problem to reinforce your understanding.`;
}

export function isApiKeyConfigured(key: string): boolean {
  return key.trim().length > 0;
}

export async function callOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error: ${res.status} — ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? 'No response from AI.';
}
