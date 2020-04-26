import { execSync } from 'child_process';
import type { Debugger } from 'debug';
import gitUrlParse from 'git-url-parse';
import { Config } from './config';
import { join } from 'path';

export function cloneRepositories(config: Config, debug?: Debugger): void {
  config.repositories.forEach(({ url, branch, directory }) => {
    const { protocol, protocols } = gitUrlParse(url);
    const command =
      `git clone ${url} ${join(config.targetDirectory, directory)} ` +
      (protocol === 'file' && protocols.length === 0 ? '' : '--depth 1 ') +
      `--single-branch --no-tags --branch ${branch}`;

    debug && debug(`command: %s`, command);

    try {
      execSync(command, {
        stdio: debug ? 'inherit' : 'pipe',
      });
    } catch (error) {
      console.error('[canarist] command "%s" failed!', command);
      console.error('[canarist]', error.stderr.toString('utf-8').trim());
    }
  });
}
