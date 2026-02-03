/**
 * Auth Commands
 * 
 * Commands for managing authentication.
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { 
  ClaudeAuthProvider, 
  validateSetupToken,
} from '@openbotman/orchestrator';

/**
 * Show authentication status
 */
export async function authStatusCommand(options: { storagePath?: string }): Promise<void> {
  const provider = new ClaudeAuthProvider({ storagePath: options.storagePath });
  const status = provider.getStatus();
  
  console.log(chalk.bold('\n🔐 Authentication Status\n'));
  
  if (status.authenticated) {
    console.log(chalk.green('✓ Authenticated'));
    console.log(`  Method: ${formatMethod(status.method!)}`);
    if (status.profile) {
      console.log(`  Profile: ${chalk.cyan(status.profile)}`);
    }
    if (status.tokenPreview) {
      console.log(`  Token: ${chalk.gray(status.tokenPreview)}`);
    }
    if (status.expiresAt) {
      const expires = new Date(status.expiresAt);
      const isExpired = expires.getTime() < Date.now();
      const expiresStr = expires.toLocaleString();
      console.log(`  Expires: ${isExpired ? chalk.red(expiresStr + ' (EXPIRED)') : chalk.gray(expiresStr)}`);
    }
  } else {
    console.log(chalk.red('✗ Not authenticated'));
    console.log(chalk.gray('\n  To authenticate, either:'));
    console.log(chalk.gray('  1. Set ANTHROPIC_API_KEY environment variable'));
    console.log(chalk.gray('  2. Run: openbotman auth setup-token'));
  }
  
  // List profiles
  const profiles = provider.listProfiles();
  if (profiles.length > 0) {
    console.log(chalk.bold('\n📋 Saved Profiles:\n'));
    for (const profile of profiles) {
      const defaultBadge = profile.isDefault ? chalk.yellow(' (default)') : '';
      const typeBadge = chalk.gray(` [${profile.type}]`);
      console.log(`  ${profile.isDefault ? chalk.cyan('→') : ' '} ${profile.name}${defaultBadge}${typeBadge}`);
      console.log(`    ${chalk.gray(profile.tokenPreview)}`);
    }
  }
  
  console.log();
}

/**
 * Import a setup-token
 */
export async function authSetupTokenCommand(options: { 
  storagePath?: string;
  token?: string;
  name?: string;
  yes?: boolean;
}): Promise<void> {
  console.log(chalk.bold('\n🔐 Import Claude Code Setup-Token\n'));
  
  // Show instructions
  if (!options.yes) {
    console.log(chalk.gray('Setup-tokens allow you to use your Claude Pro subscription.'));
    console.log(chalk.gray('To get a setup-token:\n'));
    console.log(chalk.cyan('  1. Install Claude Code CLI: npm install -g @anthropic-ai/claude-code'));
    console.log(chalk.cyan('  2. Run: claude setup-token'));
    console.log(chalk.cyan('  3. Copy the generated token'));
    console.log();
  }
  
  // Get token
  let token = options.token;
  if (!token) {
    const response = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Paste your setup-token:',
        mask: '*',
        validate: (input: string) => {
          const result = validateSetupToken(input);
          return result.valid ? true : result.error!;
        },
      },
    ]);
    token = response.token;
  }
  
  // Validate
  const validation = validateSetupToken(token!);
  if (!validation.valid) {
    console.error(chalk.red(`\n✗ Invalid token: ${validation.error}\n`));
    process.exit(1);
  }
  
  // Get profile name
  let profileName = options.name;
  if (!profileName && !options.yes) {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Profile name (optional):',
        default: 'default',
      },
    ]);
    profileName = response.name || 'default';
  }
  profileName = profileName || 'default';
  
  // Import
  const spinner = ora('Importing setup-token...').start();
  
  try {
    const provider = new ClaudeAuthProvider({ storagePath: options.storagePath });
    provider.importSetupToken(token!, profileName);
    
    spinner.succeed('Setup-token imported successfully!');
    
    const status = provider.getStatus();
    console.log(chalk.green(`\n✓ ${status.message}`));
    console.log(chalk.gray(`  Token: ${status.tokenPreview}`));
    console.log();
  } catch (error) {
    spinner.fail('Failed to import setup-token');
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}\n`));
    process.exit(1);
  }
}

/**
 * Remove a profile
 */
export async function authRemoveCommand(options: {
  storagePath?: string;
  name?: string;
  yes?: boolean;
}): Promise<void> {
  const provider = new ClaudeAuthProvider({ storagePath: options.storagePath });
  const profiles = provider.listProfiles();
  
  if (profiles.length === 0) {
    console.log(chalk.yellow('\nNo profiles to remove.\n'));
    return;
  }
  
  // Get profile to remove
  let profileName = options.name;
  if (!profileName) {
    const response = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'Select profile to remove:',
        choices: profiles.map(p => ({
          name: `${p.name} ${p.isDefault ? '(default)' : ''} - ${p.tokenPreview}`,
          value: p.name,
        })),
      },
    ]);
    profileName = response.profile;
  }
  
  // Confirm
  if (!options.yes) {
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Remove profile "${profileName}"?`,
        default: false,
      },
    ]);
    
    if (!confirm.confirmed) {
      console.log(chalk.yellow('\nAborted.\n'));
      return;
    }
  }
  
  // Remove
  const removed = provider.removeProfile(profileName!);
  
  if (removed) {
    console.log(chalk.green(`\n✓ Profile "${profileName}" removed.\n`));
  } else {
    console.log(chalk.red(`\n✗ Profile "${profileName}" not found.\n`));
  }
}

/**
 * Set default profile
 */
export async function authDefaultCommand(options: {
  storagePath?: string;
  name?: string;
}): Promise<void> {
  const provider = new ClaudeAuthProvider({ storagePath: options.storagePath });
  const profiles = provider.listProfiles();
  
  if (profiles.length === 0) {
    console.log(chalk.yellow('\nNo profiles available.\n'));
    return;
  }
  
  // Get profile
  let profileName = options.name;
  if (!profileName) {
    const response = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'Select default profile:',
        choices: profiles.map(p => ({
          name: `${p.name} ${p.isDefault ? '(current default)' : ''} - ${p.tokenPreview}`,
          value: p.name,
        })),
      },
    ]);
    profileName = response.profile;
  }
  
  try {
    provider.setDefaultProfile(profileName!);
    console.log(chalk.green(`\n✓ Default profile set to "${profileName}".\n`));
  } catch (error) {
    console.log(chalk.red(`\n✗ ${error instanceof Error ? error.message : error}\n`));
  }
}

/**
 * List all profiles
 */
export async function authListCommand(options: { storagePath?: string }): Promise<void> {
  const provider = new ClaudeAuthProvider({ storagePath: options.storagePath });
  const profiles = provider.listProfiles();
  
  console.log(chalk.bold('\n📋 Auth Profiles\n'));
  
  if (profiles.length === 0) {
    console.log(chalk.gray('  No profiles configured.'));
    console.log(chalk.gray('\n  Run: openbotman auth setup-token'));
  } else {
    for (const profile of profiles) {
      const defaultBadge = profile.isDefault ? chalk.yellow(' ★') : '';
      const typeBadge = formatMethod(profile.type);
      
      console.log(`  ${profile.isDefault ? chalk.cyan('→') : ' '} ${chalk.bold(profile.name)}${defaultBadge}`);
      console.log(`    Type: ${typeBadge}`);
      console.log(`    Token: ${chalk.gray(profile.tokenPreview)}`);
      if (profile.expiresAt) {
        const expires = new Date(profile.expiresAt);
        const isExpired = expires.getTime() < Date.now();
        console.log(`    Expires: ${isExpired ? chalk.red(expires.toLocaleString()) : chalk.gray(expires.toLocaleString())}`);
      }
      console.log();
    }
  }
  
  console.log();
}

/**
 * Format auth method for display
 */
function formatMethod(method: string): string {
  switch (method) {
    case 'setup_token':
      return chalk.magenta('Setup Token (Pro)');
    case 'api_key':
      return chalk.blue('API Key');
    case 'oauth':
      return chalk.green('OAuth');
    default:
      return chalk.gray(method);
  }
}
