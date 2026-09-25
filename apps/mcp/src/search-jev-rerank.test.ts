import { describe, expect, test } from 'bun:test';

import {
  createJevSearchRerankScorer,
  jevSearchMinMeanConfidence,
  JEV_SEARCH_MODEL,
  parseJevScoreAnswer,
  runJevEvaluateBatch,
} from './search-jev-rerank';
import type { SearchRerankCard } from './search-rerank';

describe('parseJevScoreAnswer', () => {
  test('reads AI SDK score answers with OpenRouter confidence', () => {
    expect(
      parseJevScoreAnswer(
        {
          score: 2.1,
          type: 'score',
        },
        0.99
      )
    ).toEqual({ confidence: 0.99, score: 2.1 });
  });

  test('rejects non-score answers', () => {
    expect(
      parseJevScoreAnswer({ probability: 0.9, type: 'boolean' }, 0.9)
    ).toBeNull();
  });

  test('requires finite confidence', () => {
    expect(parseJevScoreAnswer({ score: 1, type: 'score' })).toBeNull();
  });
});

const sampleCards: SearchRerankCard[] = [
  {
    functionSlug: 'a',
    handle: 'alice',
    id: '@alice/tools/a',
    packageSlug: 'tools',
    searchText: 'export pdf a',
  },
  {
    functionSlug: 'b',
    handle: 'alice',
    id: '@alice/tools/b',
    packageSlug: 'tools',
    searchText: 'export pdf b',
  },
];

describe('createJevSearchRerankScorer', () => {
  test('returns null without an api key', async () => {
    const scorer = createJevSearchRerankScorer();
    expect(await scorer('export pdf', sampleCards)).toBeNull();
  });

  test('maps mocked Jev evaluate responses to function scores', async () => {
    const scorer = createJevSearchRerankScorer('test-key', {
      createEvaluationModel: () => ({
        modelId: JEV_SEARCH_MODEL,
        provider: 'openrouter',
        specificationVersion: 'v4',
        supportedQuestionTypes: ['score'],
      }),
      evaluate: () =>
        Promise.resolve({
          answers: {
            c0: { score: 1.2, type: 'score' as const },
            c1: { score: 2.8, type: 'score' as const },
          },
          providerMetadata: {
            openrouter: {
              answers: {
                c0: { confidence: 0.9 },
                c1: { confidence: 0.92 },
              },
            },
          },
          response: { modelId: JEV_SEARCH_MODEL },
          usage: {},
          warnings: [],
        }),
    });

    const scores = await scorer('export pdf', sampleCards);
    expect(scores?.get('@alice/tools/b')).toBe(2.8);
    expect(scores?.get('@alice/tools/a')).toBe(1.2);
  });

  test('returns null when mean confidence is below the gate', async () => {
    const scorer = createJevSearchRerankScorer('test-key', {
      createEvaluationModel: () => ({
        modelId: JEV_SEARCH_MODEL,
        provider: 'openrouter',
        specificationVersion: 'v4',
        supportedQuestionTypes: ['score'],
      }),
      evaluate: () =>
        Promise.resolve({
          answers: {
            c0: { score: 2, type: 'score' as const },
            c1: { score: 2, type: 'score' as const },
          },
          providerMetadata: {
            openrouter: {
              answers: {
                c0: { confidence: jevSearchMinMeanConfidence - 0.1 },
                c1: { confidence: jevSearchMinMeanConfidence - 0.1 },
              },
            },
          },
          response: { modelId: JEV_SEARCH_MODEL },
          usage: {},
          warnings: [],
        }),
    });

    expect(await scorer('export pdf', sampleCards)).toBeNull();
  });
});

describe('runJevEvaluateBatch', () => {
  test('calls experimental_evaluate with Jev model and score questions', async () => {
    const cards: SearchRerankCard[] = [
      {
        functionSlug: 'export-pdf',
        handle: 'alice',
        id: '@alice/tools/export-pdf',
        packageSlug: 'tools',
        searchText: 'Export PDF',
      },
    ];

    let capturedModelId: string | undefined;
    const model = {
      modelId: JEV_SEARCH_MODEL,
      provider: 'openrouter',
      specificationVersion: 'v4' as const,
      supportedQuestionTypes: ['score'] as const,
    };

    const evaluate = (request: {
      model: { modelId?: string };
      questions: unknown;
    }) => {
      capturedModelId = request.model.modelId;
      expect(request.questions).toHaveProperty('c0');
      return Promise.resolve({
        answers: {
          c0: { score: 2.5, type: 'score' as const },
        },
        providerMetadata: {
          openrouter: {
            answers: {
              c0: { confidence: 0.9 },
            },
          },
        },
        response: { modelId: JEV_SEARCH_MODEL },
        usage: {},
        warnings: [],
      });
    };

    const answers = await runJevEvaluateBatch(evaluate, model, {
      cards,
      indexes: [0],
      query: 'export pdf',
    });

    expect(capturedModelId).toBe(JEV_SEARCH_MODEL);
    expect(answers.c0?.score).toBe(2.5);
  });
});
