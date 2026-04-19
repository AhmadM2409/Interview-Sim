export const supportedCodingLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp'];
export const interviewQuestionCategories = [
  'background',
  'behavioral',
  'technical',
  'situational',
  'coding',
];

const interviewerLeadInPatterns = [
  /\b(can you|could you|would you)\b/g,
  /\bplease\b/g,
  /\btell me about\b/g,
  /\bwalk me through\b/g,
  /\bdescribe\b/g,
  /\bexplain\b/g,
  /\bshare\b/g,
  /\bwhat\b/g,
  /\bhow\b/g,
];
const questionStopWords = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'did',
  'do',
  'for',
  'from',
  'have',
  'in',
  'into',
  'is',
  'it',
  'me',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'with',
  'you',
  'your',
]);
const synonymMap = new Map([
  ['recently', 'recent'],
  ['latest', 'recent'],
  ['walk', 'tell'],
  ['through', ''],
  ['led', 'lead'],
  ['leading', 'lead'],
  ['owned', 'own'],
  ['ownership', 'own'],
  ['challenging', 'challenge'],
  ['scalable', 'scale'],
  ['scaling', 'scale'],
  ['situation', 'scenario'],
  ['situational', 'scenario'],
  ['background', 'experience'],
  ['resume', 'experience'],
  ['coding', 'code'],
  ['programming', 'code'],
  ['implemented', 'implement'],
  ['implementation', 'implement'],
]);
const codingPatterns = [
  /\bwrite\b/,
  /\bimplement\b/,
  /\bcode\b/,
  /\bfunction\b/,
  /\balgorithm\b/,
  /\bsolve\b/,
  /\bdebug\b/,
  /\barray\b/,
  /\blinked list\b/,
  /\bbinary tree\b/,
  /\bclass\b/,
  /\bmethod\b/,
  /\bcomplexity\b/,
];
const behavioralPatterns = [/\bconflict\b/, /\bteammate\b/, /\bfeedback\b/, /\bmistake\b/, /\bfailure\b/, /\bleadership\b/];
const backgroundPatterns = [/\bexperience\b/, /\bresume\b/, /\bbackground\b/, /\bcareer\b/, /\bproject\b/];
const situationalPatterns = [/\bwhat would you do\b/, /\bscenario\b/, /\bif\b/, /\btrade-?off\b/, /\bapproach\b/];

export const normalizeWhitespace = (value) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

const normalizeToken = (token) => {
  const lower = token.toLowerCase();
  const synonym = synonymMap.get(lower) ?? lower;

  return synonym
    .replace(/[^a-z0-9+#]/g, '')
    .replace(/(?:ing|ed|ly|es|s)$/i, '')
    .trim();
};

export const normalizeQuestionText = (value) => {
  let normalized = normalizeWhitespace(value).toLowerCase();

  interviewerLeadInPatterns.forEach((pattern) => {
    normalized = normalized.replace(pattern, ' ');
  });

  return normalized
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const tokenizeQuestion = (value) =>
  normalizeQuestionText(value)
    .split(' ')
    .map(normalizeToken)
    .filter((token) => token && !questionStopWords.has(token));

const calculateOverlap = (firstTokens, secondTokens) => {
  if (firstTokens.length === 0 || secondTokens.length === 0) {
    return 0;
  }

  const first = new Set(firstTokens);
  const second = new Set(secondTokens);
  let intersection = 0;

  first.forEach((token) => {
    if (second.has(token)) {
      intersection += 1;
    }
  });

  const union = new Set([...first, ...second]).size;

  return union === 0 ? 0 : intersection / union;
};

export const inferQuestionType = (questionText, explicitType, explicitCategory) => {
  if (explicitType === 'coding' || explicitCategory === 'coding') {
    return 'coding';
  }

  const normalizedQuestion = normalizeQuestionText(questionText);
  return codingPatterns.some((pattern) => pattern.test(normalizedQuestion)) ? 'coding' : 'verbal';
};

export const inferQuestionCategory = (questionText, explicitCategory, explicitType) => {
  if (explicitCategory && interviewQuestionCategories.includes(explicitCategory)) {
    return explicitCategory;
  }

  const normalizedQuestion = normalizeQuestionText(questionText);

  if (inferQuestionType(questionText, explicitType, explicitCategory) === 'coding') {
    return 'coding';
  }

  if (behavioralPatterns.some((pattern) => pattern.test(normalizedQuestion))) {
    return 'behavioral';
  }

  if (situationalPatterns.some((pattern) => pattern.test(normalizedQuestion))) {
    return 'situational';
  }

  if (backgroundPatterns.some((pattern) => pattern.test(normalizedQuestion))) {
    return 'background';
  }

  return 'technical';
};

export const normalizeQuestionRecord = (question) => {
  const questionText = normalizeWhitespace(question?.questionText ?? question?.question_text);
  const category = inferQuestionCategory(
    questionText,
    question?.category ?? question?.question_category,
    question?.type ?? question?.question_type,
  );
  const type = inferQuestionType(questionText, question?.type ?? question?.question_type, category);
  const language = type === 'coding' ? normalizeWhitespace(question?.language) || 'javascript' : null;

  return {
    ...question,
    questionText,
    type,
    category,
    language,
  };
};

export const isSemanticallyDuplicateQuestion = (candidateText, previousQuestions) => {
  const normalizedCandidate = normalizeQuestionText(candidateText);
  const candidateTokens = tokenizeQuestion(candidateText);

  return previousQuestions.some((question) => {
    const existingText = question?.questionText ?? question?.question_text ?? '';
    const normalizedExisting = normalizeQuestionText(existingText);

    if (!normalizedExisting) {
      return false;
    }

    if (normalizedExisting === normalizedCandidate) {
      return true;
    }

    if (
      normalizedExisting &&
      normalizedCandidate &&
      (normalizedExisting.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedExisting))
    ) {
      return true;
    }

    const overlap = calculateOverlap(candidateTokens, tokenizeQuestion(existingText));
    return overlap >= 0.58;
  });
};

export const planNextQuestionCategory = (questionHistory) => {
  const normalizedHistory = questionHistory.map(normalizeQuestionRecord);
  const counts = Object.fromEntries(interviewQuestionCategories.map((category) => [category, 0]));

  normalizedHistory.forEach((question) => {
    counts[question.category] = (counts[question.category] ?? 0) + 1;
  });

  const missingCategory = ['behavioral', 'technical', 'situational', 'coding'].find(
    (category) => counts[category] === 0,
  );

  if (missingCategory) {
    return missingCategory;
  }

  const totalQuestions = normalizedHistory.length;
  const lastCategory = normalizedHistory.at(-1)?.category ?? 'background';
  const maxCodingQuestions = Math.max(1, Math.floor((totalQuestions + 1) / 4));
  const rankedCategories = interviewQuestionCategories
    .filter((category) => category !== 'background')
    .filter((category) => category !== 'coding' || counts.coding < maxCodingQuestions)
    .sort((left, right) => {
      const leftScore = counts[left] + (left === lastCategory ? 0.35 : 0);
      const rightScore = counts[right] + (right === lastCategory ? 0.35 : 0);
      return leftScore - rightScore;
    });

  return rankedCategories[0] ?? 'technical';
};

const deterministicQuestionTemplates = {
  background: [
    'Walk me through the parts of your background that best prepared you for this {role} role.',
    'Which recent project on your resume most closely matches this {role} opportunity, and why?',
  ],
  behavioral: [
    'Tell me about a time you received tough feedback on a technical project and how you responded.',
    'Describe a time you had to align teammates around a difficult engineering decision.',
  ],
  technical: [
    'Explain a recent technical decision you made and the tradeoffs you considered.',
    'Pick a system or feature you built recently and explain the architecture choices behind it.',
  ],
  situational: [
    'Imagine a production issue appears right before launch. How would you investigate and communicate your plan?',
    'How would you approach a feature request that conflicts with performance or reliability constraints?',
  ],
  coding: [
    'Implement a function, in the programming language of your choice, that returns the first non-repeating character in a string.',
    'Write a function, in the programming language of your choice, that groups an array of strings into anagrams.',
    'Implement a function, in the programming language of your choice, that merges overlapping intervals.',
  ],
};

export const buildDeterministicQuestionForCategory = ({ role, category, previousQuestions }) => {
  const templates = deterministicQuestionTemplates[category] ?? deterministicQuestionTemplates.technical;

  for (const template of templates) {
    const questionText = template.replaceAll('{role}', role);

    if (!isSemanticallyDuplicateQuestion(questionText, previousQuestions)) {
      return normalizeQuestionRecord({
        questionText,
        category,
        type: category === 'coding' ? 'coding' : 'verbal',
        language: category === 'coding' ? 'javascript' : null,
      });
    }
  }

  const fallbackText = `Shifting to a different angle: ${templates[0].replaceAll('{role}', role)}`;
  return normalizeQuestionRecord({
    questionText: fallbackText,
    category,
    type: category === 'coding' ? 'coding' : 'verbal',
    language: category === 'coding' ? 'javascript' : null,
  });
};
