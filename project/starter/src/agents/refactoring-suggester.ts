import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

// import { RefactoringSuggestionJSONSchema } from '../types/analysis-results.js';
import { refactoringSuggesterPrompt } from '../prompts/refactoring-suggester.prompt.js';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Analyzes pull request code for refactoring opportunities, modernization, simplification, design improvements, and redundant logic.',
  model: 'inherit',
  tools: [
    'Skill',
    'mcp__github__pull_request_read',
  ],
  prompt: refactoringSuggesterPrompt,
};