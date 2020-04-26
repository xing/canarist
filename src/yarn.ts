import { execSync } from 'child_process';
import type { Debugger } from 'debug';
import type { Config } from './config';

export function yarn(config: Config, debug?: Debugger): void {
  const command = `yarn ${config.yarnArguments}`.trim();

  debug && debug(`command: %s`, command);

  try {
    execSync(command, {
      stdio: debug ? 'inherit' : 'pipe',
      cwd: config.targetDirectory,
    });
  } catch (error) {
    console.error('[canarist] command "%s" failed!', command);
    console.error('[canarist]', error.stderr.toString('utf-8').trim());
  }
}
