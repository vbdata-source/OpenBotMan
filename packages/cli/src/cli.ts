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
import { Orchestrator, type OrchestratorConfig } from '@openbotman/orchestrator';

// Load environment variables
loadEnv();

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
  return parseYaml(content) as OrchestratorConfig;
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
  .action(async (options) => {
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

// Parse arguments
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  console.log(LOGO);
  program.outputHelp();
}
