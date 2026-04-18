import { env } from '../../../shared/lib/env';
import { withRetry } from '../../../shared/lib/resilience/retry';

interface TavilyResult {
  title: string;
  content: string;
}
interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

const FALLBACK_CONTEXT = (role: string) =>
  `You are interviewing a candidate for a ${role} position. Focus on their technical skills, problem-solving ability, communication clarity, and relevant experience.`;

export async function fetchJobContext(
  jobRole: string,
): Promise<{ context: string; isDegraded: boolean }> {
  if (!env.tavilyApiKey) {
    return { context: FALLBACK_CONTEXT(jobRole), isDegraded: true };
  }

  try {
    const response = await withRetry(
      async () => {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.tavilyApiKey}`,
          },
          body: JSON.stringify({
            query: `${jobRole} technical interview questions skills 2024`,
            search_depth: 'basic',
            max_results: 5,
            include_answer: true,
          }),
        });

        if (!res.ok) throw new Error(`Tavily ${res.status}`);
        return res.json() as Promise<TavilyResponse>;
      },
      { maxAttempts: 2, baseDelayMs: 500 },
    );

    const parts: string[] = [];
    if (response.answer) parts.push(response.answer);
    for (const r of response.results.slice(0, 3)) {
      parts.push(`${r.title}: ${r.content}`);
    }

    return { context: parts.join('\n\n').slice(0, 3000), isDegraded: false };
  } catch {
    return { context: FALLBACK_CONTEXT(jobRole), isDegraded: true };
  }
}
