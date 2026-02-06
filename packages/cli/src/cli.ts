#!/usr/bin/env node

/**
 * OpenBotMan CLI
 * 
 * Command-line interface for interacting with OpenBotMan.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { Orchestrator, type OrchestratorConfig } from '@openbotman/orchestrator';
import { normalizeConfig } from './utils/config.js';
import {
  authStatusCommand,
  authSetupTokenCommand,
  authRemoveCommand,
  authDefaultCommand,
  authListCommand,
} from './commands/auth.js';
import { demoDiscussionCommand } from './commands/demo-discussion.js';
import { discussCommand } from './commands/discuss.js';

// Load environment variables from .env (search in multiple locations)
// CLI runs from packages/cli, but .env is typically in project root
const envPaths = [
  '.env',
  join(process.cwd(), '.env'),
  join(process.cwd(), '..', '..', '.env'),  // From packages/cli to root
  join(process.cwd(), '..', '.env'),
];
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
    break;
  }
}

const VERSION = '2.0.0-alpha.1';

// ASCII Art Logo
const LOGO = chalk.cyan(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██████╗ ██████╗ ███████╗███╗   ██╗                     ║
║  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║                     ║
║  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║                     ║
║  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║                     ║
║  ╚██████╔╝██║     ███████╗██║ ╚████║                     ║
║   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝                     ║
║                                                           ║
║  ██████╗  ██████╗ ████████╗███╗   ███╗ █████╗ ███╗   ██╗ ║
║  ██╔══██╗██╔═══██╗╚══██╔══╝████╗ ████║██╔══██╗████╗  ██║ ║
║  ██████╔╝██║   ██║   ██║   ██╔████╔██║███████║██╔██╗ ██║ ║
║  ██╔══██╗██║   ██║   ██║   ██║╚██╔╝██║██╔══██║██║╚██╗██║ ║
║  ██████╔╝╚██████╔╝   ██║   ██║ ╚═╝ ██║██║  ██║██║ ╚████║ ║
║  ╚═════╝  ╚═════╝    ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ║
║                                                           ║
║  Multi-Agent Orchestration Platform                       ║
║  v${VERSION}                                              ║
╚═══════════════════════════════════════════════════════════╝
`);

// Program
const program = new Command();

program
  .name('openbotman')
  .description('OpenBotMan - Multi-Agent Orchestration Platform')
  .version(VERSION);

/**
 * Load configuration
 */
function loadConfig(configPath: string): OrchestratorConfig {
  if (!existsSync(configPath)) {
    console.error(chalk.red(`Config file not found: ${configPath}`));
    console.log(chalk.yellow('Run: cp config.example.yaml config.yaml'));
    process.exit(1);
  }
  
  const content = readFileSync(configPath, 'utf-8');
  const raw = parseYaml(content) as Record<string, unknown>;
  
  // Use normalizeConfig to properly parse all fields
  return normalizeConfig(raw);
}

/**
 * Interactive chat mode
 */
program
  .command('chat')
  .description('Start interactive chat with orchestrator')
  .option('-c, --config <path>', 'Config file path', 'config.yaml')
  .action(async (options) => {
    console.log(LOGO);
    
    const spinner = ora('Initializing orchestrator...').start();
    
    try {
      const config = loadConfig(options.config);
      const orchestrator = new Orchestrator(config);
      
      spinner.succeed('Orchestrator ready!');
      console.log(chalk.green('\nType your message (or "exit" to quit, "status" for status)\n'));
      
      // Interactive loop
      while (true) {
        const { message } = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: chalk.cyan('You:'),
            prefix: '',
          },
        ]);
        
        const trimmed = message.trim();
        
        if (trimmed.toLowerCase() === 'exit') {
          console.log(chalk.yellow('\nGoodbye! 👋\n'));
          break;
        }
        
        if (trimmed.toLowerCase() === 'status') {
          const status = orchestrator.getStatus();
          console.log(chalk.gray('\n' + JSON.stringify(status, null, 2) + '\n'));
          continue;
        }
        
        if (trimmed.toLowerCase() === 'reset') {
          orchestrator.reset();
          console.log(chalk.yellow('\nConversation reset.\n'));
          continue;
        }
        
        if (!trimmed) continue;
        
        const thinkSpinner = ora('Thinking...').start();
        
        try {
          const response = await orchestrator.chat(trimmed);
          thinkSpinner.stop();
          console.log(chalk.green('\nOpenBotMan:'), response, '\n');
        } catch (error) {
          thinkSpinner.fail('Error');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        }
      }
    } catch (error) {
      spinner.fail('Failed to initialize');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Run a single task
 */
program
  .command('run <task>')
  .description('Run a single task')
  .option('-c, --config <path>', 'Config file path', 'config.yaml')
  .option('-a, --agent <id>', 'Specific agent to use')
  .option('-w, --workflow <id>', 'Run a workflow instead')
  .action(async (task, options) => {
    const spinner = ora('Running task...').start();
    
    try {
      const config = loadConfig(options.config);
      const orchestrator = new Orchestrator(config);
      
      let result: string;
      
      if (options.workflow) {
        const workflowResult = await orchestrator.runWorkflow(options.workflow, { task });
        result = JSON.stringify(workflowResult, null, 2);
      } else {
        result = await orchestrator.chat(task);
      }
      
      spinner.succeed('Done!');
      console.log('\n' + result + '\n');
    } catch (error) {
      spinner.fail('Failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * List agents
 */
program
  .command('agents')
  .description('List configured agents')
  .option('-c, --config <path>', 'Config file path', 'config.yaml')
  .action((options) => {
    try {
      const config = loadConfig(options.config);
      
      console.log(chalk.bold('\n📋 Configured Agents:\n'));
      
      for (const agent of config.agents) {
        const status = agent.enabled ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${status} ${chalk.cyan(agent.id)} (${agent.role})`);
        console.log(`    ${chalk.gray(agent.name)} - ${agent.provider}/${agent.model}`);
      }
      
      console.log();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * List workflows
 */
program
  .command('workflows')
  .description('List configured workflows')
  .option('-c, --config <path>', 'Config file path', 'config.yaml')
  .action((options) => {
    try {
      const config = loadConfig(options.config);
      
      console.log(chalk.bold('\n📋 Configured Workflows:\n'));
      
      for (const workflow of config.workflows) {
        console.log(`  ${chalk.cyan(workflow.id)}: ${workflow.name}`);
        console.log(`    ${chalk.gray(workflow.description)}`);
        console.log(`    Steps: ${workflow.steps.map(s => s.name).join(' → ')}`);
        console.log();
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Start API server
 */
program
  .command('serve')
  .description('Start the API server')
  .option('-c, --config <path>', 'Config file path', 'config.yaml')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .action(async (_options) => {
    console.log(LOGO);
    console.log(chalk.yellow('Starting API server...\n'));
    
    // TODO: Implement API server
    console.log(chalk.gray('API server not yet implemented in v2'));
    console.log(chalk.gray('Use: docker-compose up'));
  });

/**
 * Init configuration
 */
program
  .command('init')
  .description('Initialize configuration')
  .action(async () => {
    console.log(LOGO);
    
    if (existsSync('config.yaml')) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'config.yaml already exists. Overwrite?',
          default: false,
        },
      ]);
      
      if (!overwrite) {
        console.log(chalk.yellow('Aborted.'));
        return;
      }
    }
    
    const { execSync } = await import('child_process');
    execSync('cp config.example.yaml config.yaml');
    
    console.log(chalk.green('✓ Created config.yaml'));
    console.log(chalk.gray('\nEdit config.yaml and set your API keys, then run:'));
    console.log(chalk.cyan('  openbotman chat'));
  });

/**
 * Auth commands
 */
const authCmd = program
  .command('auth')
  .description('Manage authentication');

authCmd
  .command('status')
  .description('Show authentication status')
  .option('-s, --storage-path <path>', 'Auth storage path')
  .action((options) => authStatusCommand(options));

authCmd
  .command('setup-token')
  .description('Import a Claude Code CLI setup-token (for Pro subscription)')
  .option('-t, --token <token>', 'Setup token (will prompt if not provided)')
  .option('-n, --name <name>', 'Profile name', 'default')
  .option('-s, --storage-path <path>', 'Auth storage path')
  .option('-y, --yes', 'Skip prompts')
  .action((options) => authSetupTokenCommand(options));

authCmd
  .command('list')
  .description('List saved auth profiles')
  .option('-s, --storage-path <path>', 'Auth storage path')
  .action((options) => authListCommand(options));

authCmd
  .command('remove [name]')
  .description('Remove an auth profile')
  .option('-s, --storage-path <path>', 'Auth storage path')
  .option('-y, --yes', 'Skip confirmation')
  .action((name, options) => authRemoveCommand({ ...options, name }));

authCmd
  .command('default [name]')
  .description('Set default auth profile')
  .option('-s, --storage-path <path>', 'Auth storage path')
  .action((name, options) => authDefaultCommand({ ...options, name }));

/**
 * Discuss command - Real multi-agent discussions with consensus
 */
program
  .command('discuss [topic]')
  .description('Start a multi-agent discussion with consensus finding')
  .option('-c, --config <path>', 'Config file path', 'config.yaml')
  .option('-p, --prompt-file <path>', 'Read topic/prompt from a text or markdown file')
  .option('-f, --files <files>', 'Comma-separated list of files to include as context')
  .option('-w, --workspace <path>', 'Project workspace root directory')
  .option('-i, --include <patterns>', 'Glob patterns for files to include (comma-separated, e.g., "src/**/*.ts,lib/**/*.js")')
  .option('--max-context <kb>', 'Maximum context size in KB (default: 30)', '30')
  .option('-g, --github', 'Include GitHub context (issues, PRs)')
  .option('-a, --agents <count>', 'Number of agents (1-3)', '3')
  .option('-t, --timeout <seconds>', 'Timeout per agent in seconds', '60')
  .option('-m, --model <model>', 'Model to use for all agents')
  .option('-r, --max-rounds <rounds>', 'Maximum consensus rounds', '10')
  .option('-o, --output <path>', 'Output directory for markdown export')
  .option('--planner <provider>', 'Provider for planner/architect (e.g., gemini, openai:gpt-4)')
  .option('--coder <provider>', 'Provider for coder (e.g., claude-cli)')
  .option('--reviewer <provider>', 'Provider for reviewer (e.g., openai)')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (topic, options) => {
    // Load topic from file if --prompt-file is specified
    let discussionTopic = topic;
    if (options.promptFile) {
      if (!existsSync(options.promptFile)) {
        console.error(chalk.red(`Prompt file not found: ${options.promptFile}`));
        process.exit(1);
      }
      discussionTopic = readFileSync(options.promptFile, 'utf-8').trim();
      console.log(chalk.gray(`Loaded prompt from: ${options.promptFile}`));
    }
    
    if (!discussionTopic) {
      console.error(chalk.red('Please provide a topic or use --prompt-file'));
      process.exit(1);
    }
    
    const files = options.files ? options.files.split(',').map((f: string) => f.trim()) : undefined;
    const include = options.include ? options.include.split(',').map((p: string) => p.trim()) : undefined;
    const agentCount = parseInt(options.agents, 10);
    const timeout = parseInt(options.timeout, 10);
    const maxRounds = parseInt(options.maxRounds, 10);
    const maxContextKb = parseInt(options.maxContext, 10);
    
    // Log workspace info if provided
    if (options.workspace) {
      console.log(chalk.gray(`Using workspace: ${options.workspace}`));
    }
    if (include) {
      console.log(chalk.gray(`Include patterns: ${include.join(', ')}`));
    }
    
    await discussCommand({
      topic: discussionTopic,
      files,
      include,
      workspace: options.workspace,
      maxContextKb: isNaN(maxContextKb) ? 100 : maxContextKb,
      github: options.github || false,
      agents: isNaN(agentCount) ? 3 : Math.max(1, Math.min(3, agentCount)),
      timeout: isNaN(timeout) ? 60 : timeout,
      verbose: options.verbose || false,
      model: options.model,
      maxRounds: isNaN(maxRounds) ? 10 : maxRounds,
      output: options.output,
      planner: options.planner,
      coder: options.coder,
      reviewer: options.reviewer,
    });
  });

/**
 * Demo commands
 */
const demoCmd = program
  .command('demo')
  .description('Run demonstration scripts');

demoCmd
  .command('discussion')
  .description('Run a multi-agent discussion demo')
  .option('-t, --topic <topic>', 'Discussion topic', 'Sollen wir TypeScript oder JavaScript verwenden?')
  .option('-d, --delay <ms>', 'Delay between messages in ms', '1000')
  .option('--no-animation', 'Disable animation delays')
  .action((options) => {
    const delay = parseInt(options.delay, 10);
    demoDiscussionCommand({
      topic: options.topic,
      delay: isNaN(delay) ? 1000 : delay,
      noAnimation: options.noAnimation === true || options.animation === false,
    });
  });

// Parse arguments
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  console.log(LOGO);
  program.outputHelp();
}
