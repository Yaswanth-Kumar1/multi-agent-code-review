
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Claude Agent SDK before importing the orchestrator.
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock retry/timeout so tests don't actually wait.
vi.mock('../src/utils/error-handler.js', () => {
  class ReviewError extends Error {
    code: string;
    details?: unknown;

    constructor(message: string, code: string, details?: unknown) {
      super(message);
      this.name = 'ReviewError';
      this.code = code;
      this.details = details;
    }
  }

  return {
    ReviewError,
    ErrorCodes: {
      VALIDATION: 'VALIDATION',
      AGENT_ERROR: 'AGENT_ERROR',
    },
    withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
    withTimeout: vi.fn(async (promise: Promise<unknown>) => promise),
  };
});

import { query } from '@anthropic-ai/claude-agent-sdk';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';

const mockedQuery = vi.mocked(query);

const validReport = {
  pullRequest: {
    owner: 'test-owner',
    repo: 'test-repo',
    number: 1,
  },
  fileReviews: [],
  summary: {
    totalFiles: 0,
    overallScore: 100,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0,
  },
  recommendations: [],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 0,
    agentVersions: {
      'code-quality-analyzer': 'test',
      'test-coverage-analyzer': 'test',
      'refactoring-suggester': 'test',
    },
  },
};

function mockSuccessfulQuery(output: unknown = validReport) {
  mockedQuery.mockReturnValue(
    (async function* () {
      yield {
        type: 'result',
        structured_output: output,
      };
    })() as ReturnType<typeof query>
  );
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();

      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });

    it('should accept custom rate limit configuration', () => {
      const orchestrator = new CodeReviewOrchestrator({
        maxRetries: 5,
        retryDelayMs: 50,
        timeoutMs: 5000,
      });

      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });
  });

  describe('reviewPullRequest', () => {
    it('should fetch PR files from GitHub MCP', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest(
        'test-owner',
        'test-repo',
        1
      );

      expect(mockedQuery).toHaveBeenCalledTimes(1);

      const call = mockedQuery.mock.calls[0][0];

      expect(call.prompt).toContain(
        'Repository owner: test-owner'
      );

      expect(call.prompt).toContain(
        'Repository name: test-repo'
      );

      expect(call.prompt).toContain(
        'Pull request number: 1'
      );

      expect(call.prompt).toContain(
        'Fetch the pull request data from GitHub'
      );
    });

    it('should spawn all 3 subagents in parallel', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest(
        'test-owner',
        'test-repo',
        1
      );

      const call = mockedQuery.mock.calls[0][0];

      expect(call.options).toBeDefined();
      expect(call.options?.agents).toBeDefined();

      const agents = call.options?.agents as Record<string, unknown>;

      expect(agents).toHaveProperty('code-quality-analyzer');
      expect(agents).toHaveProperty('test-coverage-analyzer');
      expect(agents).toHaveProperty('refactoring-suggester');

      expect(Object.keys(agents)).toHaveLength(3);
    });

    it('should aggregate results into ReviewReport', async () => {
      const report = {
        ...validReport,
        fileReviews: [
          {
            file: 'src/example.ts',
            codeQuality: {
              file: 'src/example.ts',
              issues: [],
              overallScore: 95,
              summary: 'Good code quality',
            },
            testCoverage: {
              file: 'src/example.ts',
              hasTests: true,
              testFiles: ['src/example.test.ts'],
              untestedPaths: [],
              coverageEstimate: 100,
              summary: 'Fully covered',
            },
            refactorings: {
              file: 'src/example.ts',
              suggestions: [],
              summary: 'No refactoring required',
            },
          },
        ],
        summary: {
          totalFiles: 1,
          overallScore: 95,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0,
        },
      };

      mockSuccessfulQuery(report);

      const orchestrator = new CodeReviewOrchestrator();

      const result = await orchestrator.reviewPullRequest(
        'test-owner',
        'test-repo',
        1
      );

      expect(result.pullRequest).toEqual({
        owner: 'test-owner',
        repo: 'test-repo',
        number: 1,
      });

      expect(result.fileReviews).toHaveLength(1);
      expect(result.fileReviews[0].file).toBe('src/example.ts');

      expect(result.summary.totalFiles).toBe(1);
      expect(result.summary.overallScore).toBe(95);
    });

    it('should validate output with Zod schema', async () => {
      mockSuccessfulQuery(validReport);

      const orchestrator = new CodeReviewOrchestrator();

      const result = await orchestrator.reviewPullRequest(
        'test-owner',
        'test-repo',
        1
      );

      expect(result).toBeDefined();
      expect(result.pullRequest.owner).toBe('test-owner');
      expect(result.pullRequest.repo).toBe('test-repo');
      expect(result.pullRequest.number).toBe(1);
    });

    it('should reject invalid pull request information', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('', 'test-repo', 1)
      ).rejects.toThrow('Invalid pull request information.');

      await expect(
        orchestrator.reviewPullRequest(
          'test-owner',
          '',
          1
        )
      ).rejects.toThrow('Invalid pull request information.');

      await expect(
        orchestrator.reviewPullRequest(
          'test-owner',
          'test-repo',
          0
        )
      ).rejects.toThrow('Invalid pull request information.');

      await expect(
        orchestrator.reviewPullRequest(
          'test-owner',
          'test-repo',
          -1
        )
      ).rejects.toThrow('Invalid pull request information.');

      await expect(
        orchestrator.reviewPullRequest(
          'test-owner',
          'test-repo',
          1.5
        )
      ).rejects.toThrow('Invalid pull request information.');
    });

    it('should reject when Claude returns invalid output', async () => {
      mockSuccessfulQuery({
        invalid: 'output',
      });

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'test-owner',
          'test-repo',
          1
        )
      ).rejects.toThrow('Claude returned an invalid ReviewReport.');
    });

    it('should reject when Claude returns no structured output', async () => {
      mockedQuery.mockReturnValue(
        (async function* () {
          yield {
            type: 'result',
          };
        })() as ReturnType<typeof query>
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'test-owner',
          'test-repo',
          1
        )
      ).rejects.toThrow(
        'Claude did not return structured review output.'
      );
    });
  });

  describe('Integration', () => {
    // Requires valid API keys and GitHub access.
    // Run manually when desired.
    it.skip('should review a real small PR', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      const result = await orchestrator.reviewPullRequest(
        'modelcontextprotocol',
        'ext-apps',
        705
      );

      expect(result.pullRequest).toEqual({
        owner: 'modelcontextprotocol',
        repo: 'ext-apps',
        number: 705,
      });

      expect(result.fileReviews).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });
});

