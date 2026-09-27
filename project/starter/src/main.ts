import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { formatError } from './utils/error-handler.js';
import { logger } from './utils/logger.js';

dotenv.config();

function printUsage(): void {
  console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
  console.error('Example: npm run dev -- octocat Hello-World 1');
}

function validateArguments(
  owner: string | undefined,
  repo: string | undefined,
  prStr: string | undefined
): number {
  if (!owner || !repo || !prStr) {
    printUsage();
    throw new Error('Missing required arguments.');
  }

  const prNumber = Number(prStr);

  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    printUsage();
    throw new Error('Pull request number must be a positive integer.');
  }

  return prNumber;
}

function validateAuthentication(): void {
  const hasAnthropicAuth = Boolean(process.env.ANTHROPIC_API_KEY);

  const hasAwsAuth =
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  if (!hasAnthropicAuth && !hasAwsAuth) {
    throw new Error(
      'Authentication is not configured. Set ANTHROPIC_API_KEY or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY.'
    );
  }

  if (hasAnthropicAuth) {
    console.log('🔐 Using Anthropic API authentication');
    return;
  }

  if (!process.env.AWS_REGION) {
    throw new Error(
      'AWS authentication is configured, but AWS_REGION is missing.'
    );
  }

  console.log('🔐 Using AWS Bedrock authentication');
}

function validateModel(): string {
  const model = process.env.ANTHROPIC_MODEL;

  if (!model) {
    throw new Error(
      'ANTHROPIC_MODEL is required. Example: claude-sonnet-4-5-20250929'
    );
  }

  return model;
}

async function saveReports(
  owner: string,
  repo: string,
  prNumber: number,
  report: Parameters<ReportGenerator['generateMarkdownReport']>[0]
): Promise<void> {
  const reportsDirectory = path.resolve(process.cwd(), 'reports');

  await mkdir(reportsDirectory, { recursive: true });

  const baseName = `${owner}-${repo}-pr-${prNumber}`;
  const reportGenerator = new ReportGenerator();

  const markdown = reportGenerator.generateMarkdownReport(report);
  const html = reportGenerator.generateHTMLReport(report);
  const json = reportGenerator.generateJSONReport(report);

  await Promise.all([
    writeFile(
      path.join(reportsDirectory, `${baseName}.md`),
      markdown,
      'utf8'
    ),
    writeFile(
      path.join(reportsDirectory, `${baseName}.html`),
      html,
      'utf8'
    ),
    writeFile(
      path.join(reportsDirectory, `${baseName}.json`),
      json,
      'utf8'
    ),
  ]);

  console.log(`📄 Reports written to: ${reportsDirectory}`);
  console.log(`   ${baseName}.json`);
  console.log(`   ${baseName}.md`);
  console.log(`   ${baseName}.html`);
}

async function main(): Promise<void> {
  const [owner, repo, prStr] = process.argv.slice(2);

  try {
    const prNumber = validateArguments(owner, repo, prStr);

    validateAuthentication();

    const model = validateModel();

    console.log(`🤖 Model: ${model}`);
    console.log(`🔍 Reviewing ${owner}/${repo} PR #${prNumber}`);

    const orchestrator = new CodeReviewOrchestrator();

    const report = await orchestrator.reviewPullRequest(
      owner!,
      repo!,
      prNumber
    );

    await saveReports(
      owner!,
      repo!,
      prNumber,
      report
    );

    console.log('✅ Pull request review completed successfully.');
  } catch (error) {
    const message = formatError(error);

    logger.error(message);
    console.error(`❌ ${message}`);

    process.exitCode = 1;
  }
}

void main();