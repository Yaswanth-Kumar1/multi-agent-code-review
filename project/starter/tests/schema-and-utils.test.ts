import { describe, it, expect } from 'vitest';
import { ReviewReportSchema } from '../src/types/report-types.js';
import { ReportGenerator } from '../src/utils/report-generator.js';
import { withTimeout } from '../src/utils/error-handler.js';

const validReport = {
  pullRequest: {
    owner: 'octocat',
    repo: 'Hello-World',
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
    duration: 1,
    agentVersions: {},
  },
};

describe('schemas and utilities', () => {
  it('accepts a valid ReviewReport', () => {
    expect(ReviewReportSchema.safeParse(validReport).success).toBe(true);
  });

  it('rejects an invalid ReviewReport', () => {
    const invalidReport = {
      ...validReport,
      pullRequest: {
        ...validReport.pullRequest,
        number: 'invalid',
      },
    };

    expect(ReviewReportSchema.safeParse(invalidReport).success).toBe(false);
  });

  it('generates markdown, JSON, and HTML reports', () => {
    const generator = new ReportGenerator();

    const markdown = generator.generateMarkdownReport(validReport);
    const html = generator.generateHTMLReport(validReport);
    const json = generator.generateJSONReport(validReport);

    expect(markdown).toContain('Code Review Report');
    expect(html).toContain('<html');
    expect(JSON.parse(json)).toEqual(validReport);
  });

  it('times out slow operations', async () => {
    await expect(
      withTimeout(
        new Promise<void>((resolve) => setTimeout(resolve, 50)),
        1
      )
    ).rejects.toThrow('timed out');
  });
});
