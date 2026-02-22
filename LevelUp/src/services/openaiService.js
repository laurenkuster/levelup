import AsyncStorage from '@react-native-async-storage/async-storage';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const STUDY_MAX_TOKENS = 520;
const QUIZ_MAX_TOKENS = 700;
const REQUEST_TIMEOUT_MS = 12000;
const CACHE_PREFIX = 'studyPack:';
const FRIENDLY_RETRY_ERROR = 'We are having trouble reaching the AI service. Please try again in a moment.';

const isString = (value) => typeof value === 'string';
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const getApiKey = () => {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY');
  }
  return apiKey;
};

const buildCacheKey = (topic, difficulty) => {
  const safeTopic = topic.trim().toLowerCase();
  return `${CACHE_PREFIX}${safeTopic}:${difficulty}`;
};

const callOpenAI = async ({ messages, maxTokens, timeoutMs = REQUEST_TIMEOUT_MS }) => {
  const apiKey = getApiKey();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages,
      }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('OPENAI_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }
  return content;
};

const parseJson = (raw) => {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON response');
  }
  return parsed;
};

const validateStudyPack = (pack) => {
  if (!isString(pack.topic) || !isNumber(pack.difficulty)) {
    throw new Error('Study pack missing topic or difficulty');
  }
  if (pack.difficulty < 1 || pack.difficulty > 5) {
    throw new Error('Study pack difficulty out of range');
  }
  if (!isNumber(pack.estimated_minutes)) {
    throw new Error('Study pack estimated_minutes invalid');
  }
  if (!Array.isArray(pack.summary) || pack.summary.length < 5 || pack.summary.length > 6) {
    throw new Error('Study pack summary length invalid');
  }
  if (!Array.isArray(pack.key_terms) || pack.key_terms.length > 8) {
    throw new Error('Study pack key_terms invalid');
  }
  if (!Array.isArray(pack.resources) || pack.resources.length !== 3) {
    throw new Error('Study pack resources invalid');
  }
  pack.resources.forEach((resource) => {
    if (!isString(resource.title) || !isString(resource.url) || !isString(resource.type)) {
      throw new Error('Study pack resource invalid');
    }
    if (!['article', 'video', 'docs'].includes(resource.type)) {
      throw new Error('Study pack resource type invalid');
    }
    if (!isNumber(resource.minutes)) {
      throw new Error('Study pack resource minutes invalid');
    }
    if (!resource.url.startsWith('http')) {
      throw new Error('Study pack resource url invalid');
    }
  });
  if (!Array.isArray(pack.quiz_focus)) {
    throw new Error('Study pack quiz_focus invalid');
  }
};

const normalizeStudyPack = (pack) => {
  const normalized = { ...pack };
  if (isString(normalized.quiz_focus)) {
    normalized.quiz_focus = normalized.quiz_focus
      .split(/[;,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(normalized.quiz_focus) || normalized.quiz_focus.length === 0) {
    normalized.quiz_focus = Array.isArray(normalized.summary)
      ? normalized.summary.slice(0, 3)
      : [];
  }
  normalized.quiz_focus = normalized.quiz_focus.filter((item) => isString(item));
  if (Array.isArray(normalized.resources)) {
    normalized.resources = normalized.resources.slice(0, 3).map((resource) => {
      const safeResource = { ...resource };
      if (isString(safeResource.url)) {
        let url = safeResource.url.trim();
        if (url && !url.startsWith('http')) {
          url = `https://${url}`;
        }
        safeResource.url = url.replace(/\s/g, '%20');
      }
      return safeResource;
    });
  }
  if (Array.isArray(normalized.summary)) {
    normalized.summary = normalized.summary.slice(0, 6);
  }
  if (Array.isArray(normalized.key_terms)) {
    normalized.key_terms = normalized.key_terms.slice(0, 8);
  }
  return normalized;
};

const validateQuiz = (quiz, difficulty) => {
  if (!isString(quiz.topic) || !isNumber(quiz.difficulty)) {
    throw new Error('Quiz missing topic or difficulty');
  }
  if (!isNumber(quiz.time_limit_sec)) {
    throw new Error('Quiz time_limit_sec invalid');
  }
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error('Quiz questions invalid');
  }
  const expectedCount = difficulty <= 2 ? 5 : difficulty === 3 ? 7 : 10;
  if (quiz.questions.length !== expectedCount) {
    throw new Error('Quiz question count invalid');
  }
  if (quiz.time_limit_sec !== quiz.questions.length * 40) {
    throw new Error('Quiz time limit invalid');
  }
  quiz.questions.forEach((question) => {
    if (!isNumber(question.id) || !isString(question.question)) {
      throw new Error('Quiz question invalid');
    }
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error('Quiz options invalid');
    }
    if (!isNumber(question.correct_index) || question.correct_index < 0 || question.correct_index > 3) {
      throw new Error('Quiz correct_index invalid');
    }
    if (!isString(question.difficulty_tag) || !['easy', 'medium', 'hard'].includes(question.difficulty_tag)) {
      throw new Error('Quiz difficulty_tag invalid');
    }
    if (!isString(question.rationale)) {
      throw new Error('Quiz rationale invalid');
    }
    const sentenceCount = question.rationale
      .split(/[.!?]/)
      .map((item) => item.trim())
      .filter(Boolean).length;
    if (sentenceCount > 1) {
      throw new Error('Quiz rationale invalid');
    }
  });
};

const buildStudyPrompt = ({ topic, difficulty, link, strict }) => {
  const linkLine = link ? `Reference link: ${link}` : 'Reference link: none';
  const rules = [
    'summary: 5-6 items',
    'key_terms: max 8',
    'resources: exactly 3 items, type is article|video|docs',
    'use real, working https URLs from well-known sources (wikipedia.org, react.dev, reactnative.dev, developer.mozilla.org, docs.python.org, developer.android.com)',
    'for video resources use youtube.com search result URLs with query = topic + information or topic + study material',
    'no markdown',
    'no extra keys',
  ];

  return [
    {
      role: 'system',
      content: strict
        ? 'You are a learning content generator. Output ONLY valid JSON matching the schema. No extra text.'
        : 'You are a learning content generator. You MUST output valid JSON matching the schema. Do not include any text outside JSON.',
    },
    {
      role: 'user',
      content: [
        `Topic: ${topic}`,
        `Difficulty: ${difficulty}`,
        linkLine,
        'Schema:',
        '{"topic":"string","difficulty":1-5,"estimated_minutes":number,"summary":[string],"key_terms":[string],"resources":[{"title":"string","url":"string","type":"article|video|docs","minutes":number}],"quiz_focus":[string]}',
        `Rules: ${rules.join('; ')}`,
        'Return JSON only.',
      ].join('\n'),
    },
  ];
};

const buildQuizPrompt = ({ topic, difficulty, studyPack, strict }) => {
  const questionCount = difficulty <= 2 ? 5 : difficulty === 3 ? 7 : 10;

  return [
    {
      role: 'system',
      content: strict
        ? 'You are a quiz generator. Output ONLY valid JSON matching the schema. No extra text.'
        : 'You are a quiz generator. You MUST output valid JSON matching the schema. Do not include any text outside JSON.',
    },
    {
      role: 'user',
      content: [
        `Topic: ${topic}`,
        `Difficulty: ${difficulty}`,
        `Questions: ${questionCount}`,
        'Study pack hints:',
        JSON.stringify({ summary: studyPack.summary, key_terms: studyPack.key_terms, quiz_focus: studyPack.quiz_focus }),
        'Schema:',
        '{"topic":"string","difficulty":1-5,"time_limit_sec":number,"questions":[{"id":number,"question":"string","options":[string,string,string,string],"correct_index":number,"difficulty_tag":"easy|medium|hard","rationale":"string"}]}',
        'Rules: time_limit_sec = questions.length * 40; rationale max 1 sentence; no markdown; no extra keys.',
        'Return JSON only.',
      ].join('\n'),
    },
  ];
};

const requestJsonWithRetry = async ({ buildMessages, maxTokens, validator, validatorArgs }) => {
  const attempt = async (strict) => {
    const raw = await callOpenAI({ messages: buildMessages(strict), maxTokens });
    const parsed = parseJson(raw);
    validator(parsed, ...validatorArgs);
    return parsed;
  };

  try {
    return await attempt(false);
  } catch (error) {
    try {
      return await attempt(true);
    } catch (finalError) {
      throw new Error(FRIENDLY_RETRY_ERROR);
    }
  }
};

const requestStudyPackWithRetry = async ({ topic, difficulty, link }) => {
  const attempt = async (strict) => {
    const raw = await callOpenAI({
      messages: buildStudyPrompt({ topic, difficulty, link, strict }),
      maxTokens: STUDY_MAX_TOKENS,
    });
    const parsed = parseJson(raw);
    const normalized = normalizeStudyPack(parsed);
    validateStudyPack(normalized);
    return normalized;
  };

  try {
    return await attempt(false);
  } catch (error) {
    try {
      return await attempt(true);
    } catch (finalError) {
      throw new Error(FRIENDLY_RETRY_ERROR);
    }
  }
};

export const generateStudyPack = async ({ topic, difficulty, link }) => {
  const cacheKey = buildCacheKey(topic, difficulty);
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const pack = await requestStudyPackWithRetry({ topic, difficulty, link });
  await AsyncStorage.setItem(cacheKey, JSON.stringify(pack));
  return pack;
};

export const generateQuiz = async ({ topic, difficulty, studyPack }) => {
  const quiz = await requestJsonWithRetry({
    buildMessages: (strict) => buildQuizPrompt({ topic, difficulty, studyPack, strict }),
    maxTokens: QUIZ_MAX_TOKENS,
    validator: validateQuiz,
    validatorArgs: [difficulty],
  });

  return quiz;
};
