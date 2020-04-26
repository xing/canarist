import { execSync } from 'child_process';
import { join } from 'path';
import type { Debugger } from 'debug';
import type { Config } from './config';
import gitUrlParse from 'git-url-parse';

export function execute(
  command: string,
  cwd: string,
  debug?: Debugger
): boolean {
  debug && debug('running command: "%s" in "%s"', command, cwd);

  try {
    execSync(command, {
      stdio: debug ? 'inherit' : 'pipe',
      cwd,
    });

    debug && debug('command: "%s" finished successfully', command);

    return true;
  } catch (error) {
    console.error('[canarist] command "%s" failed!', command);
    if (error.stderr) {
      console.error(error.stderr.toString('utf-8').trim());
    }

    return false;
  }
}

export function cloneRepositories(config: Config, debug?: Debugger): void {
  config.repositories.forEach(({ url, branch, directory }) => {
    const { protocol, protocols } = gitUrlParse(url);
    const isLocalFilePath = protocol === 'file' && protocols.length === 0;

    const command = [
      `git clone ${url} ${join(config.targetDirectory, directory)}`,
      `--single-branch`,
      `--no-tags`,
      `--branch ${branch}`,
      isLocalFilePath ? '' : '--depth 1',
    ]
      .join(' ')
      .trim();

    if (!execute(command, config.targetDirectory, debug)) {
      throw new Error('Failed to clone repositories');
    }
  });
}

export function yarn(config: Config, debug?: Debugger): void {
  const command = `yarn ${config.yarnArguments}`.trim();

  if (!execute(command, config.targetDirectory, debug)) {
    throw new Error('Failed to install dependencies');
  }
}

export function executeCommands(config: Config, debug?: Debugger): void {
  config.repositories.forEach((repo) => {
    repo.commands.forEach((command) => {
      if (!command) {
        debug && debug('skipping empty command for "%s"', repo.url);
        return;
      }

      const cwd = join(config.targetDirectory, repo.directory);

      if (!execute(command, cwd, debug)) {
        throw new Error('Failed to run configured commands');
      }
    });
  });
}
