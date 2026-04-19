import { normalizeWhitespace, tokenizeQuestion } from './interview-question-utils.js';

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

export const normalizeCode = (value) =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trimEnd() : '';

export const normalizeTranscript = (value) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

const normalizeLanguage = (value) => normalizeWhitespace(value).toLowerCase() || 'javascript';

const extractFunctionName = (code) => {
  const matches = [
    code.match(/function\s+([A-Za-z_]\w*)/),
    code.match(/const\s+([A-Za-z_]\w*)\s*=\s*\(/),
    code.match(/let\s+([A-Za-z_]\w*)\s*=\s*\(/),
    code.match(/def\s+([A-Za-z_]\w*)\s*\(/),
    code.match(/(?:public|private|static|\s)*\w+\s+([A-Za-z_]\w*)\s*\(/),
  ];

  return matches.find((match) => match?.[1])?.[1] ?? 'your solution';
};

const describeCodeShape = (code) => {
  if (/\bsplit\b.*\breverse\b.*\bjoin\b/.test(code)) {
    return 'a concise built-in string reversal approach';
  }

  if (/\bhashmap\b|\bmap<|\bnew Map\b|\bMap\b|\bdict\b|\bCounter\b|\bunordered_map\b/.test(code)) {
    return 'a hash-map-based approach';
  }

  if (/\bsort\b/.test(code)) {
    return 'a sort-based approach';
  }

  if (/\bfor\b|\bwhile\b/.test(code)) {
    return 'an iterative approach';
  }

  if (/\brecurs/i.test(code)) {
    return 'a recursive approach';
  }

  return 'the current implementation approach';
};

const detectEdgeCaseSignals = (code, transcript) => {
  const normalized = `${code}\n${transcript}`.toLowerCase();
  const signals = [];

  if (/\bnull\b|\bundefined\b/.test(normalized)) {
    signals.push('null or undefined input');
  }

  if (/\bempty\b|\blength\s*[<=>]=?\s*0\b|!value/.test(normalized)) {
    signals.push('empty input');
  }

  if (/\bduplicate\b|\brepeat/.test(normalized)) {
    signals.push('duplicate values');
  }

  if (/\bnegative\b|\boverflow\b/.test(normalized)) {
    signals.push('numeric edge cases');
  }

  return signals;
};

const inferMissingEdgeCases = (questionText, code, transcript) => {
  const normalizedQuestion = questionText.toLowerCase();
  const covered = new Set(detectEdgeCaseSignals(code, transcript));
  const missing = [];

  if ((/\bstring\b/.test(normalizedQuestion) || /\bcharacter\b/.test(normalizedQuestion)) && !covered.has('empty input')) {
    missing.push('Empty-string handling was not discussed.');
  }

  if ((/\barray\b/.test(normalizedQuestion) || /\binterval/.test(normalizedQuestion)) && !covered.has('duplicate values')) {
    missing.push('Duplicate or overlapping values were not called out.');
  }

  if (!covered.has('null or undefined input')) {
    missing.push('Null or undefined inputs were not addressed.');
  }

  return missing.slice(0, 3);
};

const analyzeCodingContext = ({
  questionText,
  language,
  code,
  transcript,
  assistantMessages = [],
}) => {
  const normalizedCode = normalizeCode(code).trim();
  const normalizedTranscript = normalizeTranscript(transcript);
  const normalizedLanguage = normalizeLanguage(language);
  const functionName = extractFunctionName(normalizedCode);
  const questionTokens = tokenizeQuestion(questionText);
  const lineCount = normalizedCode ? normalizedCode.split('\n').filter(Boolean).length : 0;
  const hasReturn = /\breturn\b/.test(normalizedCode);
  const hasConditional = /\bif\b|\bswitch\b|\belse\b|\?:/.test(normalizedCode);
  const hasLoop = /\bfor\b|\bwhile\b|\bforEach\b/.test(normalizedCode);
  const hasHelper = /=>|function\s+\w+|def\s+\w+|class\s+\w+/.test(normalizedCode);
  const hasComments = /\/\/|\/\*|#/.test(normalizedCode);
  const mentionsComplexity = /\bbig o\b|\bo\(|\btime complexity\b|\bspace complexity\b/i.test(normalizedTranscript);
  const mentionsTradeoffs = /\btrade-?off\b|\bbecause\b|\bso that\b/i.test(normalizedTranscript);
  const mentionsTesting = /\btest\b|\bexample\b|\bedge case\b/i.test(normalizedTranscript);
  const missingEdgeCases = inferMissingEdgeCases(questionText, normalizedCode, normalizedTranscript);
  const recentAssistantNotes = assistantMessages
    .map((message) => normalizeTranscript(message?.text))
    .filter(Boolean)
    .slice(-3);
  const assistantSuggestedEdgeCases = recentAssistantNotes.some((note) =>
    /\bedge case\b|\bnull\b|\bempty\b|\bcomplexity\b/i.test(note),
  );

  let technicalScore = 18;
  let problemSolvingScore = 20;
  let communicationScore = normalizedTranscript ? 38 : 18;

  if (normalizedCode) {
    technicalScore += 20;
    problemSolvingScore += 15;
  }

  if (hasHelper) {
    technicalScore += 10;
  }

  if (hasReturn) {
    technicalScore += 14;
    problemSolvingScore += 10;
  }

  if (hasConditional) {
    technicalScore += 8;
    problemSolvingScore += 10;
  }

  if (hasLoop) {
    technicalScore += 8;
    problemSolvingScore += 8;
  }

  if (lineCount >= 4) {
    communicationScore += 8;
  }

  if (hasComments) {
    communicationScore += 6;
  }

  if (mentionsComplexity) {
    problemSolvingScore += 10;
    communicationScore += 8;
  }

  if (mentionsTradeoffs) {
    communicationScore += 8;
  }

  if (mentionsTesting) {
    problemSolvingScore += 6;
  }

  if (missingEdgeCases.length === 0) {
    problemSolvingScore += 8;
  }

  if (assistantSuggestedEdgeCases && missingEdgeCases.length > 0) {
    communicationScore -= 6;
  }

  if (!normalizedCode) {
    technicalScore = 0;
    problemSolvingScore = Math.min(problemSolvingScore, 20);
  }

  const strengths = [];
  const weaknesses = [];
  const codeQualityNotes = [];

  if (normalizedCode) {
    strengths.push(
      `Your ${functionName} answer in ${normalizedLanguage} shows ${describeCodeShape(normalizedCode)}.`,
    );
  } else {
    weaknesses.push('No executable solution was submitted, so the evaluation is based only on reasoning.');
  }

  if (hasConditional || missingEdgeCases.length === 0) {
    strengths.push('You show some awareness of branching or defensive handling instead of only the happy path.');
  } else {
    weaknesses.push('The implementation still leans heavily on the happy path without enough defensive checks.');
  }

  if (normalizedTranscript) {
    strengths.push('Your spoken reasoning gives useful insight into how you are thinking through the problem.');
  } else {
    weaknesses.push('The submission would be stronger with spoken reasoning about tradeoffs and edge cases.');
  }

  if (mentionsComplexity) {
    codeQualityNotes.push('You explicitly discussed complexity, which helps the interviewer assess depth.');
  } else {
    codeQualityNotes.push('You did not explain time or space complexity, so the interviewer has to infer it.');
  }

  if (hasComments) {
    codeQualityNotes.push('The code includes lightweight commentary, which helps readability in an interview setting.');
  } else if (normalizedCode) {
    codeQualityNotes.push('A few brief comments or clearer variable names would make the solution easier to follow live.');
  }

  if (questionTokens.includes('interval') && !/\bsort\b/.test(normalizedCode)) {
    weaknesses.push('For interval-style problems, explain how you guarantee correct ordering before merging.');
  }

  if (assistantSuggestedEdgeCases && missingEdgeCases.length > 0) {
    weaknesses.push('Some assistant prompts about edge cases were not reflected back in the final reasoning.');
  }

  return {
    normalizedCode,
    normalizedTranscript,
    normalizedLanguage,
    functionName,
    lineCount,
    missingEdgeCases,
    technicalScore: clampScore(technicalScore),
    problemSolvingScore: clampScore(problemSolvingScore),
    communicationScore: clampScore(communicationScore),
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    codeQualityNotes: codeQualityNotes.slice(0, 3),
  };
};

export const buildFallbackCodingEvaluation = ({
  role,
  questionText,
  language,
  code,
  transcript,
  assistantMessages = [],
}) => {
  const analysis = analyzeCodingContext({
    questionText,
    language,
    code,
    transcript,
    assistantMessages,
  });

  const finalFeedbackParts = [
    `For this ${role} coding question, the evaluation is based on static review of ${analysis.functionName} in ${analysis.normalizedLanguage}; the code was not executed in a sandbox.`,
    analysis.normalizedCode
      ? `The solution shows ${describeCodeShape(analysis.normalizedCode)}, but it still needs clearer coverage of ${analysis.missingEdgeCases[0] ? analysis.missingEdgeCases[0].replace(/\.$/, '') : 'edge cases and tradeoffs'}.`
      : 'A stronger submission would include runnable logic in addition to the spoken explanation.',
    analysis.normalizedTranscript
      ? 'Your transcript helped clarify intent and communication quality.'
      : 'Adding spoken reasoning would make the interview signal much stronger.',
  ];

  return {
    technicalScore: analysis.technicalScore,
    problemSolvingScore: analysis.problemSolvingScore,
    communicationScore: analysis.communicationScore,
    strengths: analysis.strengths.length > 0 ? analysis.strengths : ['You engaged with the coding prompt instead of leaving it blank.'],
    weaknesses:
      analysis.weaknesses.length > 0
        ? analysis.weaknesses
        : ['The answer needs more explicit discussion of tradeoffs, edge cases, and completeness.'],
    edgeCasesMissing: analysis.missingEdgeCases,
    codeQualityNotes:
      analysis.codeQualityNotes.length > 0
        ? analysis.codeQualityNotes
        : ['The structure is still too thin to judge readability confidently.'],
    finalFeedback: finalFeedbackParts.join(' '),
  };
};

export const buildFallbackCodingAssistantFeedback = ({
  questionText,
  language,
  code,
  transcript,
  assistantMessages = [],
}) => {
  const analysis = analyzeCodingContext({
    questionText,
    language,
    code,
    transcript,
    assistantMessages,
  });

  const goodSignals = [];
  const missingOrRisky = [];
  const questionableAssumptions = [];

  if (analysis.normalizedCode) {
    goodSignals.push(`You already have ${describeCodeShape(analysis.normalizedCode)} in place.`);
  }

  if (analysis.normalizedTranscript) {
    goodSignals.push('You are narrating your reasoning instead of coding silently, which is interview-friendly.');
  }

  if (analysis.missingEdgeCases.length > 0) {
    missingOrRisky.push(analysis.missingEdgeCases[0]);
  }

  if (!/\breturn\b/.test(analysis.normalizedCode)) {
    missingOrRisky.push('The current draft does not clearly show what value is returned yet.');
  }

  if (!/\bif\b|\bwhile\b|\bfor\b/.test(analysis.normalizedCode) && analysis.normalizedCode) {
    questionableAssumptions.push('If the problem has edge cases, the current draft may only cover the happy path.');
  }

  if (assistantMessages.some((message) => /\bcomplexity\b/i.test(message?.text ?? '')) && !/\bbig o\b|\bo\(/i.test(analysis.normalizedTranscript)) {
    questionableAssumptions.push('You have not closed the loop on complexity after it was raised earlier.');
  }

  const responseText = [
    goodSignals[0] ? `Good signal: ${goodSignals[0]}` : 'Good signal: you are actively working through the problem.',
    missingOrRisky[0] ? `Watch out for this next: ${missingOrRisky[0]}` : 'Watch out for this next: make sure the code shows a complete path to the final answer.',
    questionableAssumptions[0]
      ? `One thing I would challenge: ${questionableAssumptions[0]}`
      : 'One thing I would challenge: explain why your approach is the right fit for this prompt.',
  ].join(' ');

  return {
    responseText,
    goodSignals: goodSignals.slice(0, 2),
    missingOrRisky: missingOrRisky.slice(0, 2),
    questionableAssumptions: questionableAssumptions.slice(0, 2),
    suggestedNextStep:
      analysis.missingEdgeCases[0] ??
      'State the next code change you would make, then explain the edge case or tradeoff it addresses.',
  };
};
