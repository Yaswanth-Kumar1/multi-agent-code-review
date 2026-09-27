import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ReviewReport } from './types/report-types.js';
import { ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types.js';
import { mcpServersConfig } from './config/mcp.config.js';
import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester,
} from './agents/index.js';
import { orchestratorPrompt } from './prompts/orchestrator.prompt.js';
import { withRetry, withTimeout, ReviewError, ErrorCodes } from './utils/error-handler.js';

export interface OrchestratorOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export class CodeReviewOrchestrator {
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;

  constructor(options: OrchestratorOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 600000;
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startTime = Date.now();

    if (!owner || !repo || !Number.isInteger(prNumber) || prNumber <= 0) {
      throw new ReviewError(
        'Invalid pull request information.',
        ErrorCodes.VALIDATION,
        { owner, repo, prNumber }
      );
    }

    const prompt = `${orchestratorPrompt}

Review this pull request:

Repository owner: ${owner}
Repository name: ${repo}
Pull request number: ${prNumber}

Fetch the pull request data from GitHub before performing the analysis.
Invoke all three specialized agents and aggregate their findings.
`;

    try {
      const result = await withTimeout(
        withRetry(
          async () => this.executeReview(prompt),
          this.maxRetries,
          this.retryDelayMs
        ),
        this.timeoutMs
      );

      const parsed = ReviewReportSchema.safeParse(result);

      if (!parsed.success) {
        throw new ReviewError(
          'Claude returned an invalid ReviewReport.',
          ErrorCodes.VALIDATION,
          {
            validationErrors: parsed.error.issues,
          }
        );
      }

      const report = parsed.data;

      return {
        ...report,
        pullRequest: {
          owner,
          repo,
          number: prNumber,
        },
        metadata: {
          ...report.metadata,
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      if (error instanceof ReviewError) {
        throw error;
      }

      throw new ReviewError(
        'Pull request review failed.',
        ErrorCodes.AGENT_ERROR,
        {
          cause: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  private async executeReview(prompt: string): Promise<unknown> {
    const agents = {
      'code-quality-analyzer': codeQualityAnalyzer,
      'test-coverage-analyzer': testCoverageAnalyzer,
      'refactoring-suggester': refactoringSuggester,
    };

    const allowedTools = [
      'Task',
      'mcp__github__pull_request_read',
    ];

    const response = query({
      prompt,
      options: {
        mcpServers: mcpServersConfig,
        agents,
        allowedTools,
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema,
        },
      },
    });

    let structuredOutput: unknown;

    for await (const message of response) {
      if (
        message.type === 'result' &&
        'structured_output' in message
      ) {
        structuredOutput = message.structured_output;
      }
    }

    if (structuredOutput === undefined) {
      throw new ReviewError(
        'Claude did not return structured review output.',
        ErrorCodes.AGENT_ERROR
      );
    }

    return structuredOutput;
  }
}