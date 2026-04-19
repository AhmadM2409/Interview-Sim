import { config } from '../config.js';
import logger from '../logger.js';
import {
  inferQuestionCategory,
  inferQuestionType,
  normalizeQuestionRecord,
  normalizeWhitespace,
  supportedCodingLanguages,
} from './interview-question-utils.js';

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

const normalizeGeneratedQuestion = (value) => {
  const normalized = normalizeQuestionRecord(value);

  return {
    questionText: normalized.questionText,
    type: normalized.type,
    category: normalized.category,
    language: normalized.type === 'coding' ? normalized.language || 'javascript' : null,
  };
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

const joinSummaryLines = (parts) => parts.filter(Boolean).join(' ').trim();

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

const buildSummaryInputPreview = (responses) => {
  if (!responses) {
    return 'No response data provided.';
  }

  const responseLines = Array.isArray(responses.responses)
    ? responses.responses
        .slice(0, 8)
        .map((response) =>
          JSON.stringify({
            order: response.order,
            questionText: response.questionText,
            questionType: response.questionType,
            questionCategory: response.questionCategory,
            answerText: response.answerText,
            answerType: response.answerType,
            answerLanguage: response.answerLanguage,
            transcript: response.transcript,
            assistantMessages: response.assistantMessages,
            technicalScore: response.technicalScore,
            communicationScore: response.communicationScore,
            feedback: response.feedback,
          }),
        )
        .join('\n')
    : '[]';

  return [
    `Response count: ${responses.responseCount ?? 0}`,
    `Technical average: ${responses.technicalAverage ?? 'null'}`,
    `Communication average: ${responses.communicationAverage ?? 'null'}`,
    `Responses:\n${responseLines}`,
  ].join('\n');
};

const buildAskedQuestionPreview = (questions) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return 'No prior questions.';
  }

  return questions
    .slice(-6)
    .map((question) =>
      JSON.stringify({
        questionText: question.questionText,
        category: question.category,
        type: question.type,
      }),
    )
    .join('\n');
};

const buildAssistantMessagePreview = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'No prior assistant messages.';
  }

  return messages
    .slice(-6)
    .map((message) =>
      JSON.stringify({
        role: message.role,
        text: message.text,
      }),
    )
    .join('\n');
};

const detectToneIssues = (responses) => {
  const flaggedTerms = ['offensive', 'irrelevant', 'idiot', 'stupid', 'hate', 'dumb', 'whatever'];

  return Array.isArray(responses?.responses)
    ? responses.responses.some((response) => {
        const answer = response.answerText?.toLowerCase?.() ?? '';
        return flaggedTerms.some((term) => answer.includes(term));
      })
    : false;
};

const hasQuantifiedImpact = (responses) =>
  Array.isArray(responses?.responses)
    ? responses.responses.some((response) => /\b\d+[%x]?\b/.test(response.answerText ?? ''))
    : false;

export const buildFallbackSummary = (role, responses, providerText) => {
  const responseCount = Number(responses?.responseCount ?? 0);
  const technicalAverage =
    typeof responses?.technicalAverage === 'number' ? responses.technicalAverage : null;
  const communicationAverage =
    typeof responses?.communicationAverage === 'number' ? responses.communicationAverage : null;
  const quantifiedImpact = hasQuantifiedImpact(responses);
  const toneIssueDetected = detectToneIssues(responses);
  const scoredResponses = Array.isArray(responses?.responses) ? responses.responses : [];
  const lowConfidenceResponses = scoredResponses.filter(
    (response) =>
      typeof response.technicalScore === 'number' &&
      typeof response.communicationScore === 'number' &&
      (response.technicalScore + response.communicationScore) / 2 < 50,
  ).length;
  const strongResponses = scoredResponses.filter(
    (response) =>
      typeof response.technicalScore === 'number' &&
      typeof response.communicationScore === 'number' &&
      (response.technicalScore + response.communicationScore) / 2 >= 75,
  ).length;

  if (responseCount === 0) {
    return {
      overallScore: 45,
      technicalScore: null,
      communicationScore: null,
      feedbackSummary: `The ${role} interview was completed before enough answer data was captured for a tailored final readout.`,
      strengths: ['Started the interview flow and reached the wrap-up stage.'],
      improvements: ['Complete more questions so the final summary can reflect your technical depth and communication style.'],
    };
  }

  const fallbackOverallScore = clampScore(
    ((technicalAverage ?? 50) + (communicationAverage ?? 50)) / 2,
  );
  const strengths = [];
  const improvements = [];

  if ((technicalAverage ?? 0) >= 80) {
    strengths.push('Explained technical decisions with strong depth and confidence.');
  } else if ((technicalAverage ?? 0) >= 60) {
    strengths.push('Showed workable technical understanding across the interview.');
  }

  if ((communicationAverage ?? 0) >= 80) {
    strengths.push('Communicated clearly with a structured, interviewer-friendly narrative.');
  } else if (quantifiedImpact) {
    strengths.push('Used concrete outcomes and measurable impact in at least one answer.');
  }

  if (strongResponses > 0 && strengths.length < 2) {
    strengths.push(`Delivered ${strongResponses} answer${strongResponses === 1 ? '' : 's'} with strong relevance to the ${role} role.`);
  }

  if ((technicalAverage ?? 100) < 60) {
    improvements.push('Add more technical reasoning, tradeoffs, and implementation detail in your answers.');
  }

  if ((communicationAverage ?? 100) < 60) {
    improvements.push('Make answers more direct and structured so the core point lands faster.');
  }

  if (toneIssueDetected) {
    improvements.push('Keep responses professional and relevant to the interview prompt.');
  }

  if (lowConfidenceResponses > 0) {
    improvements.push('When you are unsure, explain your approach instead of stopping at a short "I do not know."');
  }

  if (!quantifiedImpact) {
    improvements.push('Include measurable outcomes, ownership, and scope whenever possible.');
  }

  const feedbackSummary =
    providerText ||
    joinSummaryLines([
      `This ${role} interview ended with an overall score of ${fallbackOverallScore}.`,
      strongResponses > 0 ? `You had ${strongResponses} clearly stronger response${strongResponses === 1 ? '' : 's'}.` : '',
      lowConfidenceResponses > 0 ? `There were ${lowConfidenceResponses} weaker answer${lowConfidenceResponses === 1 ? '' : 's'} that lowered the final impression.` : '',
      toneIssueDetected ? 'At least one response came across as irrelevant or unprofessional.' : '',
    ]);

  return {
    overallScore: fallbackOverallScore,
    technicalScore: technicalAverage,
    communicationScore: communicationAverage,
    feedbackSummary,
    strengths: strengths.slice(0, 3).length > 0 ? strengths.slice(0, 3) : [`Connected prior experience back to the ${role} role in at least one answer.`],
    improvements: improvements.slice(0, 3).length > 0 ? improvements.slice(0, 3) : ['Keep adding concrete technical examples and clearer structure to each answer.'],
  };
};

export const generateQuestion = async ({
  role,
  sessionId,
  context,
  attempt,
  targetCategory,
  askedQuestions = [],
}) => {
  const normalizedTargetCategory = inferQuestionCategory('', targetCategory, targetCategory === 'coding' ? 'coding' : null);
  const prompt = [
    'Generate exactly one technical interview question.',
    'Return strict JSON only: {"questionText":"...","type":"verbal|coding","category":"background|behavioral|technical|situational|coding","language":"javascript|typescript|python|java|cpp|null"}',
    'Avoid repeating the same semantic question that has already been asked.',
    normalizedTargetCategory === 'coding'
      ? `The question must be a coding interview prompt and should explicitly allow the candidate to answer in the programming language of their choice from: ${supportedCodingLanguages.join(', ')}.`
      : `The question must fit the ${normalizedTargetCategory} category and should not become a coding prompt.`,
    `Role: ${role}`,
    `Session: ${sessionId}`,
    `Attempt: ${attempt}`,
    `External context:\n${contextSummary(context)}`,
    `Target category: ${normalizedTargetCategory}`,
    `Already asked questions:\n${buildAskedQuestionPreview(askedQuestions)}`,
  ].join('\n');

  const payload = await requestMistral(prompt);
  const text = extractTextFromMistral(payload);
  const structured = parseStructuredJson(text);

  if (structured && typeof structured === 'object') {
    return normalizeGeneratedQuestion(structured);
  }

  return normalizeGeneratedQuestion({
    questionText: text || `Tell me about a meaningful ${role} project you owned end-to-end.`,
    category: normalizedTargetCategory,
  });
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

export const evaluateCodingAnswer = async ({
  sessionId,
  role,
  questionText,
  questionType,
  questionCategory,
  language,
  code,
  transcript,
  assistantMessages = [],
  attempt,
}) => {
  const prompt = [
    'Evaluate a candidate coding-interview answer.',
    'Ground the response in the actual submitted code and reasoning. Do not invent code execution results.',
    'Return strict JSON only: {"technicalScore":0-100,"problemSolvingScore":0-100,"communicationScore":0-100,"strengths":["..."],"weaknesses":["..."],"edgeCasesMissing":["..."],"codeQualityNotes":["..."],"finalFeedback":"..."}',
    `Session: ${sessionId}`,
    `Role: ${role}`,
    `Attempt: ${attempt}`,
    `Question type: ${questionType}`,
    `Question category: ${questionCategory}`,
    `Selected language: ${language}`,
    `Question:\n${questionText}`,
    `Code:\n${code || '[no code submitted]'}`,
    `Transcript:\n${transcript || '[no transcript provided]'}`,
    `Prior assistant interaction:\n${buildAssistantMessagePreview(assistantMessages)}`,
  ].join('\n');

  const payload = await requestMistral(prompt);
  const text = extractTextFromMistral(payload);
  const structured = parseStructuredJson(text);

  if (structured && typeof structured === 'object') {
    return structured;
  }

  return {
    technicalScore: clampScore((code?.length ?? 0) / 4),
    problemSolvingScore: clampScore((transcript?.length ?? 0) / 3),
    communicationScore: clampScore((transcript?.length ?? 0) / 2),
    strengths: ['The candidate submitted code for review.'],
    weaknesses: ['The provider did not return structured coding feedback.'],
    edgeCasesMissing: ['Edge-case coverage needs manual review.'],
    codeQualityNotes: ['Static review only; no code execution was performed.'],
    finalFeedback: text || 'Static review completed, but the provider did not return structured coding feedback.',
  };
};

export const generateCodingAssistantFeedback = async ({
  sessionId,
  role,
  questionText,
  questionCategory,
  language,
  code,
  transcript,
  assistantMessages = [],
  attempt,
}) => {
  const prompt = [
    'You are acting as a live coding interviewer.',
    'Review the candidate’s current code and spoken reasoning, then respond with short grounded interview-style feedback.',
    'Do not fully solve the problem. Do not give generic encouragement.',
    'Return strict JSON only: {"responseText":"...","goodSignals":["..."],"missingOrRisky":["..."],"questionableAssumptions":["..."],"suggestedNextStep":"..."}',
    `Session: ${sessionId}`,
    `Role: ${role}`,
    `Attempt: ${attempt}`,
    `Question category: ${questionCategory}`,
    `Selected language: ${language}`,
    `Question:\n${questionText}`,
    `Current code:\n${code || '[no code yet]'}`,
    `Recent spoken reasoning:\n${transcript || '[no transcript yet]'}`,
    `Prior assistant interaction:\n${buildAssistantMessagePreview(assistantMessages)}`,
  ].join('\n');

  const payload = await requestMistral(prompt);
  const text = extractTextFromMistral(payload);
  const structured = parseStructuredJson(text);

  if (structured && typeof structured === 'object') {
    return structured;
  }

  return {
    responseText: text || 'Keep grounding your explanation in the current code and call out the next edge case you plan to handle.',
    goodSignals: [],
    missingOrRisky: [],
    questionableAssumptions: [],
    suggestedNextStep: 'State the next concrete code change you would make and why.',
  };
};

export const generateSummary = async ({ sessionId, role, responses, attempt }) => {
  const prompt = [
    'Generate a final interview summary.',
    'Return strict JSON only: {"overallScore":0-100,"technicalScore":0-100|null,"communicationScore":0-100|null,"feedbackSummary":"..."|null,"strengths":["..."],"improvements":["..."]}',
    `Session: ${sessionId}`,
    `Role: ${role}`,
    `Attempt: ${attempt}`,
    `Interview data:\n${buildSummaryInputPreview(responses)}`,
  ].join('\n');

  const payload = await requestMistral(prompt);
  const text = extractTextFromMistral(payload);
  const structured = parseStructuredJson(text);

  if (structured && typeof structured === 'object') {
    return structured;
  }

  return buildFallbackSummary(role, responses, text);
};
