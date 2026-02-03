/**
 * ASCII Logo and Branding
 */

import chalk from 'chalk';

const VERSION = '2.0.0-alpha.1';

/**
 * Full ASCII Art Logo
 */
export const LOGO = chalk.cyan(`
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

/**
 * Compact logo for small screens
 */
export const LOGO_COMPACT = chalk.cyan(`
┌─────────────────────────────────┐
│   ${chalk.bold('OpenBotMan')} v${VERSION}        │
│   Multi-Agent Orchestration     │
└─────────────────────────────────┘
`);

/**
 * Print welcome banner
 */
export function printBanner(compact = false): void {
  console.log(compact ? LOGO_COMPACT : LOGO);
}

/**
 * Print section header
 */
export function printHeader(title: string): void {
  const line = '═'.repeat(title.length + 4);
  console.log(chalk.cyan(`╔${line}╗`));
  console.log(chalk.cyan(`║  ${chalk.bold(title)}  ║`));
  console.log(chalk.cyan(`╚${line}╝`));
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Print error message
 */
export function printError(message: string): void {
  console.log(chalk.red(`✗ ${message}`));
}

/**
 * Print warning message
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}
