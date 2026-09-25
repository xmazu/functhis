/**
 * Stage-2 Jev Score rerank for MCP search.
 *
 * Batches Score questions and evaluates them with OpenRouter's Decisions API
 * (`typesafe/jev-1.13`) through Vercel AI SDK 7 `experimental_evaluate` and
 * `@openrouter/ai-sdk-provider`'s `evaluationModel`.
 *
 * @see https://openrouter.ai/docs/guides/community/jev-tutorial
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { experimental_evaluate } from 'ai';
import type { Experimental_EvaluationModel } from 'ai';

import type { SearchRerankCard, SearchRerankScorer } from './search-rerank';

/** Pinned Jev release on OpenRouter (see tutorial). */
export const JEV_SEARCH_MODEL = 'typesafe/jev-1.13';

export const jevSearchScoreQuestionBatchSize = 8;

export const jevSearchMinMeanConfidence = 0.45;

const whitespacePattern = /\s+/gu;

const FUNCTHIS_OPENROUTER_APP_URL = 'https://functhis.now';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const questionKey = (index: number): string => `c${String(index)}`;

interface OpenRouterEvaluationMetadata {
  answers?: Record<string, { confidence?: number } | undefined>;
}

export const parseJevScoreAnswer = (
  answer: unknown,
  confidence: unknown
): { confidence: number; score: number } | null => {
  if (!answer || typeof answer !== 'object') {
    return null;
  }
  const typed = answer as { score?: unknown; type?: unknown };
  if (typed.type !== 'score') {
    return null;
  }
  if (typeof typed.score !== 'number' || !Number.isFinite(typed.score)) {
    return null;
  }
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return null;
  }
  return { confidence, score: typed.score };
};

const buildQuestionBatches = (
  cardCount: number,
  batchSize: number
): number[][] => {
  const batches: number[][] = [];
  for (let start = 0; start < cardCount; start += batchSize) {
    const batch: number[] = [];
    const end = Math.min(cardCount, start + batchSize);
    for (let index = start; index < end; index += 1) {
      batch.push(index);
    }
    batches.push(batch);
  }
  return batches;
};

const buildJevQuestions = (indexes: readonly number[]) => {
  const questions: Record<
    string,
    {
      criteria: string[];
      instructions: string;
      type: 'score';
    }
  > = {};
  for (const index of indexes) {
    questions[questionKey(index)] = {
      criteria: [
        'Unrelated or misleading for this query',
        'Tangentially related',
        'Clearly relevant next hop',
        'Best primary match for this query',
      ],
      instructions: `How relevant is state.candidates[${String(index)}] to state.query for the agent's next execute call?`,
      type: 'score',
    };
  }
  return questions;
};

const mean = (values: readonly number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total / values.length;
};

const buildJevState = (query: string, cards: SearchRerankCard[]) => ({
  candidates: cards.map((card, index) => ({
    functionSlug: card.functionSlug,
    handle: card.handle,
    id: card.id,
    index,
    packageSlug: card.packageSlug,
    summary: card.searchText
      .replaceAll(whitespacePattern, ' ')
      .trim()
      .slice(0, 160),
  })),
  query,
});

export type JevEvaluateFn = typeof experimental_evaluate;

export const runJevEvaluateBatch = async (
  evaluate: JevEvaluateFn,
  model: Experimental_EvaluationModel,
  input: {
    cards: SearchRerankCard[];
    indexes: readonly number[];
    query: string;
  }
): Promise<Record<string, { confidence: number; score: number }>> => {
  const state = buildJevState(input.query, input.cards);
  const result = await evaluate({
    model,
    questions: buildJevQuestions(input.indexes),
    state,
  });

  const openrouterMeta = result.providerMetadata?.openrouter as
    | OpenRouterEvaluationMetadata
    | undefined;

  const parsed: Record<string, { confidence: number; score: number }> = {};
  for (const key of Object.keys(result.answers)) {
    const answer = result.answers[key];
    const confidence = openrouterMeta?.answers?.[key]?.confidence;
    const scored = parseJevScoreAnswer(answer, confidence);
    if (scored) {
      parsed[key] = scored;
    }
  }
  return parsed;
};

export const createJevSearchRerankScorer = (
  apiKey: string | undefined,
  deps: {
    createEvaluationModel?: (key: string) => Experimental_EvaluationModel;
    evaluate?: JevEvaluateFn;
  } = {}
): SearchRerankScorer => {
  const evaluate = deps.evaluate ?? experimental_evaluate;
  const createEvaluationModel =
    deps.createEvaluationModel ??
    ((key: string) =>
      createOpenRouter({
        apiKey: key,
        appName: 'functhis-mcp',
        appUrl: FUNCTHIS_OPENROUTER_APP_URL,
      }).evaluationModel(JEV_SEARCH_MODEL));

  const scoreSearchRerank = async function scoreSearchRerank(
    query: string,
    cards: SearchRerankCard[]
  ): Promise<Map<string, number> | null> {
    const trimmedKey = apiKey?.trim();
    if (!trimmedKey || cards.length === 0) {
      return null;
    }

    const model = createEvaluationModel(trimmedKey);

    try {
      const batches = buildQuestionBatches(
        cards.length,
        jevSearchScoreQuestionBatchSize
      );
      const batchAnswers = await Promise.all(
        batches.map((indexes) =>
          runJevEvaluateBatch(evaluate, model, { cards, indexes, query })
        )
      );

      const mergedAnswers: Record<
        string,
        { confidence: number; score: number }
      > = {};
      for (const answers of batchAnswers) {
        for (const [key, value] of Object.entries(answers)) {
          mergedAnswers[key] = value;
        }
      }

      const scores = new Map<string, number>();
      const confidences: number[] = [];
      for (let index = 0; index < cards.length; index += 1) {
        const answer = mergedAnswers[questionKey(index)];
        if (!answer) {
          return null;
        }
        const card = cards[index];
        if (!card) {
          return null;
        }
        scores.set(card.id, answer.score);
        confidences.push(answer.confidence);
      }

      if (mean(confidences) < jevSearchMinMeanConfidence) {
        return null;
      }

      return scores;
    } catch (error) {
      console.warn(
        JSON.stringify({
          error: getErrorMessage(error),
          message: 'OpenRouter Jev search rerank failed; using lexical order',
        })
      );
      return null;
    }
  };

  return scoreSearchRerank;
};
