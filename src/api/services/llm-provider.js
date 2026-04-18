import { config } from '../config.js';
import logger from '../logger.js';

const mistralUrl = 'https://api.mistral.ai/v1/chat/completions';

const extractTextFromMistral = (payload) => {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        return part?.text ?? '';
      })
      .join('\n')
      .trim();
  }

  return '';
};

const parseStructuredJson = (text) => {
  if (!text) {
    return null;
  }

  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_error) {
    return null;
  }
};

const mapPublicMessage = (statusCode, providerMessage) => {
  if (statusCode === 401 || statusCode === 403) {
    return 'Mistral request rejected: API key invalid or unauthorized. Set a valid MISTRAL_API_KEY in .env.';
  }

  if (statusCode === 429) {
    return `Mistral request rejected: rate limit/quota exceeded. ${providerMessage}`;
  }

  if (statusCode >= 500) {
    return `Mistral provider unavailable: ${providerMessage}`;
  }

  return `Mistral request rejected: ${providerMessage}`;
};

const requestMistral = async (prompt) => {
  const payload = {
    model: config.mistralModel,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  logger.info(
    {
      checkpoint: 'mistral.request.prepared',
      endpoint: mistralUrl,
      model: config.mistralModel,
      hasApiKey: Boolean(config.mistralApiKey),
      payloadShape: {
        messagesCount: payload.messages.length,
      },
    },
    'Mistral request prepared',
  );

  const response = await fetch(mistralUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.mistralApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const rawErrorBody = await response.text();
    let parsedError = null;

    try {
      parsedError = JSON.parse(rawErrorBody);
    } catch (_error) {
      parsedError = null;
    }

    const providerMessage =
      parsedError?.error?.message ??
      parsedError?.message ??
      rawErrorBody ??
      `Mistral request failed: ${response.status}`;

    logger.error(
      {
        checkpoint: 'mistral.response.error',
        status: response.status,
        statusText: response.statusText,
        body: rawErrorBody,
      },
      'Mistral non-200 response',
    );

    const error = new Error(`Mistral request failed: ${response.status}: ${providerMessage}`);
    error.statusCode = response.status;
    error.publicMessage = mapPublicMessage(response.status, providerMessage);
    throw error;
  }

  return response.json();
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

const contextSummary = (context) => {
  if (!context) {
    return 'No external context provided.';
  }

  const resultSnippets = Array.isArray(context?.results)
    ? context.results
        .map((item) => item?.content ?? item?.snippet ?? item?.title ?? '')
        .filter(Boolean)
        .slice(0, 3)
    : [];

  if (resultSnippets.length > 0) {
    return resultSnippets.join('\n');
  }

  return JSON.stringify(context).slice(0, 2000);
};

export const generateQuestion = async ({ role, sessionId, context, attempt }) => {
  const prompt = [
    'Generate exactly one technical interview question.',
    'Return strict JSON only: {"questionText":"..."}',
    `Role: ${role}`,
    `Session: ${sessionId}`,
    `Attempt: ${attempt}`,
    `External context:\n${contextSummary(context)}`,
  ].join('\n');

  const payload = await requestMistral(prompt);
  const text = extractTextFromMistral(payload);
  const structured = parseStructuredJson(text);

  if (structured && typeof structured === 'object') {
    return structured;
  }

  return {
    questionText: text || `Tell me about a meaningful ${role} project you owned end-to-end.`,
  };
};

export const evaluateAnswer = async ({ sessionId, transcript, attempt }) => {
  const prompt = [
    'Evaluate a candidate response for a technical interview.',
    'Return strict JSON only: {"technicalScore":0-100,"communicationScore":0-100,"feedback":"..."}',
    `Session: ${sessionId}`,
    `Attempt: ${attempt}`,
    `Transcript:\n${transcript}`,
  ].join('\n');

  const payload = await requestMistral(prompt);
  const text = extractTextFromMistral(payload);
  const structured = parseStructuredJson(text);

  if (structured && typeof structured === 'object') {
    return structured;
  }

  return {
    technicalScore: clampScore(transcript.length / 2),
    communicationScore: 75,
    feedback: text || 'Clear answer with room for deeper technical detail.',
  };
};

export const generateSummary = async ({ sessionId, role, responses, attempt }) => {
  const prompt = [
    'Generate a final interview summary.',
    'Return strict JSON only: {"overallScore":0-100,"strengths":["..."],"improvements":["..."]}',
    `Session: ${sessionId}`,
    `Role: ${role}`,
    `Attempt: ${attempt}`,
    `Response metadata: ${JSON.stringify(responses ?? {})}`,
  ].join('\n');

  const payload = await requestMistral(prompt);
  const text = extractTextFromMistral(payload);
  const structured = parseStructuredJson(text);

  if (structured && typeof structured === 'object') {
    return structured;
  }

  return {
    overallScore: 78,
    strengths: [text || `Role alignment for ${role}`],
    improvements: ['Provide more quantifiable outcomes'],
  };
};

