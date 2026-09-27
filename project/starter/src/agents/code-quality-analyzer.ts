import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
// import { CodeQualityResultJSONSchema } from '../types/analysis-results.js';
import { codeQualityAnalyzerPrompt } from '../prompts/code-quality-analyzer.prompt.js';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes pull request files for security, performance, maintainability, bugs, style, and best-practice issues.',
  model: 'inherit',
  tools: [
    'Skill',
    'mcp__github__pull_request_read',
  ],
  prompt: codeQualityAnalyzerPrompt,
};