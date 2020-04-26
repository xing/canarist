import { execSync } from 'child_process';
import { join } from 'path';
import type { Debugger } from 'debug';
import type { Config } from './config';

export function executeCommands(config: Config, debug?: Debugger): void {
  config.repositories.forEach((repo) => {
    repo.commands.forEach((command) => {
      if (!command) {
        return;
      }

      debug && debug(`command: %s`, command);

      try {
        execSync(command, {
          stdio: debug ? 'inherit' : 'pipe',
          cwd: join(config.targetDirectory, repo.directory),
        });
      } catch (error) {
        console.error('[canarist] command "%s" failed!', command);
        console.error('[canarist]', error.stderr.toString('utf-8').trim());

        throw error;
      }
    });
  });
}
