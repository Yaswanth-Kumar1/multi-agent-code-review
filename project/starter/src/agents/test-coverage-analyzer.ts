import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

// import { TestCoverageResultJSONSchema } from '../types/analysis-results.js';
import { testCoverageAnalyzerPrompt } from '../prompts/test-coverage-analyzer.prompt.js';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Analyzes pull request changes for test coverage, missing tests, untested paths, branches, functions, and edge cases.',
  model: 'inherit',
  tools: [
    'Skill',
    'mcp__github__pull_request_read',
  ],
  prompt: testCoverageAnalyzerPrompt,
};