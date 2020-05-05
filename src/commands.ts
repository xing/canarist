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

    debug && debug('done');

    return true;
  } catch (error) {
    console.error('[canarist] command "%s" failed in "%s"!', command, cwd);
    if (error.stderr) {
      console.error(error.stderr.toString('utf-8').trim());
    }

    return false;
  }
}

export function cloneRepositories(
  config: Config,
  cwd: string,
  debug?: Debugger
): void {
  config.repositories.forEach(({ url, branch, directory }) => {
    const { protocol, protocols } = gitUrlParse(url);
    const isLocalFilePath = protocol === 'file' && protocols.length === 0;
    const target = join(config.targetDirectory, directory);

    const command = [
      `git clone ${url} ${target}`,
      `--single-branch`,
      `--no-tags`,
      branch ? `--branch ${branch}` : '',
      isLocalFilePath ? '' : '--depth 1',
    ]
      .join(' ')
      .trim();

    console.log(
      `[canarist] cloning "${url}${
        branch ? '#' + branch : ''
      }" into "${target}"`
    );
    if (!execute(command, cwd, debug)) {
      throw new Error('Failed to clone repositories');
    }
  });
}

export function yarn(config: Config, debug?: Debugger): void {
  const command = `yarn ${config.yarnArguments}`.trim();

  console.log('[canarist] installing dependencies with yarn');
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

      console.log('[canarist] executing command "%s" in "%s"', command, cwd);
      if (!execute(command, cwd, debug)) {
        throw new Error('Failed to run configured commands');
      }
    });
  });
}
