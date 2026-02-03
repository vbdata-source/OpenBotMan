/**
 * Chat Command
 * 
 * Interactive chat with the orchestrator.
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import type { Orchestrator } from '@openbotman/orchestrator';

export interface ChatOptions {
  orchestrator: Orchestrator;
  onExit?: () => void;
}

/**
 * Format assistant response with nice styling
 */
export function formatResponse(response: string): string {
  // Highlight code blocks
  const formatted = response.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_, lang, code) => {
      const header = lang ? chalk.dim(`[${lang}]`) : '';
      return `\n${header}\n${chalk.cyan(code.trim())}\n`;
    }
  );
  
  // Highlight inline code
  return formatted.replace(
    /`([^`]+)`/g,
    (_, code) => chalk.yellow(code)
  );
}

/**
 * Format status information
 */
export function formatStatus(status: Record<string, unknown>): string {
  const lines: string[] = [
    chalk.bold.cyan('\n📊 Orchestrator Status\n'),
    chalk.gray('─'.repeat(40)),
  ];
  
  // Uptime
  const uptime = status['uptime'] as number;
  const hours = Math.floor(uptime / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const secs = uptime % 60;
  lines.push(`${chalk.bold('Uptime:')} ${hours}h ${mins}m ${secs}s`);
  
  // Tokens
  lines.push(`${chalk.bold('Tokens used:')} ${status['tokens']}`);
  
  // Tasks
  const tasks = status['tasks'] as Record<string, number>;
  lines.push(`${chalk.bold('Tasks:')} ${tasks.total} total | ${tasks.active} active | ${tasks.pending} pending`);
  
  // Discussions
  lines.push(`${chalk.bold('Active discussions:')} ${status['discussions']}`);
  
  // Agents
  const agents = status['agents'] as Array<Record<string, unknown>>;
  lines.push('');
  lines.push(chalk.bold('Agents:'));
  for (const agent of agents) {
    const statusIcon = agent.status === 'idle' ? chalk.green('●') : 
                       agent.status === 'busy' ? chalk.yellow('●') : chalk.red('●');
    lines.push(`  ${statusIcon} ${chalk.cyan(agent.id as string)} (${agent.role}) - ${agent.tasks} tasks`);
  }
  
  lines.push(chalk.gray('─'.repeat(40)));
  
  return lines.join('\n');
}

/**
 * Show help for chat commands
 */
export function showChatHelp(): void {
  console.log(chalk.bold.cyan('\n📖 Chat Commands\n'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  ${chalk.yellow('exit')}    - Exit the chat`);
  console.log(`  ${chalk.yellow('status')}  - Show orchestrator status`);
  console.log(`  ${chalk.yellow('reset')}   - Reset conversation history`);
  console.log(`  ${chalk.yellow('agents')}  - List available agents`);
  console.log(`  ${chalk.yellow('help')}    - Show this help`);
  console.log(`  ${chalk.yellow('clear')}   - Clear the screen`);
  console.log(chalk.gray('─'.repeat(40)));
  console.log('');
}

/**
 * Run interactive chat
 */
export async function runChat(options: ChatOptions): Promise<void> {
  const { orchestrator, onExit } = options;
  
  console.log(chalk.green('\n✓ Orchestrator ready!'));
  console.log(chalk.gray('Type "help" for commands, "exit" to quit\n'));
  
  // Interactive loop
  while (true) {
    try {
      const { message } = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: chalk.cyan('You:'),
          prefix: '',
        },
      ]);
      
      const trimmed = message.trim();
      
      // Handle special commands
      if (!trimmed) continue;
      
      const command = trimmed.toLowerCase();
      
      if (command === 'exit' || command === 'quit') {
        console.log(chalk.yellow('\n👋 Goodbye!\n'));
        onExit?.();
        break;
      }
      
      if (command === 'status') {
        const status = orchestrator.getStatus();
        console.log(formatStatus(status));
        continue;
      }
      
      if (command === 'reset') {
        orchestrator.reset();
        console.log(chalk.yellow('\n🔄 Conversation reset.\n'));
        continue;
      }
      
      if (command === 'help') {
        showChatHelp();
        continue;
      }
      
      if (command === 'clear') {
        console.clear();
        continue;
      }
      
      if (command === 'agents') {
        const status = orchestrator.getStatus();
        const agents = status['agents'] as Array<Record<string, unknown>>;
        console.log(chalk.bold.cyan('\n🤖 Available Agents\n'));
        for (const agent of agents) {
          const statusIcon = agent.status === 'idle' ? chalk.green('●') : chalk.yellow('●');
          console.log(`  ${statusIcon} ${chalk.cyan(agent.id as string)} - ${agent.role}`);
        }
        console.log('');
        continue;
      }
      
      // Regular message - send to orchestrator
      const spinner = ora({
        text: chalk.gray('Thinking...'),
        spinner: 'dots',
      }).start();
      
      try {
        const response = await orchestrator.chat(trimmed);
        spinner.stop();
        
        console.log('');
        console.log(chalk.bold.green('OpenBotMan:'));
        console.log(formatResponse(response));
        console.log('');
        
      } catch (error) {
        spinner.fail(chalk.red('Error'));
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\n❌ ${errorMsg}\n`));
      }
      
    } catch (error) {
      // Handle Ctrl+C gracefully
      if ((error as Error).message?.includes('User force closed')) {
        console.log(chalk.yellow('\n👋 Goodbye!\n'));
        onExit?.();
        break;
      }
      throw error;
    }
  }
}
