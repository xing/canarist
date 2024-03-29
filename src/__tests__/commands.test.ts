import { execSync } from 'child_process';
import { execute, executeCommands, cloneRepositories, yarn } from '../commands';
import type { Debugger } from 'debug';
import { partialConfig, partialRepositoryConfig } from './_helpers';

jest.mock('child_process');

function execSyncError(): void {
  const error = new Error('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (error as any).stderr = Buffer.from('');
  throw error;
}

function consoleErrorSpy(): jest.SpyInstance {
  return jest.spyOn(console, 'error').mockImplementation(() => {
    /* noop */
  });
}

describe('command execution', () => {
  beforeEach(() => {
    (execSync as jest.Mock).mockReset();
  });

  describe('commands', () => {
    it('should execute succeeding commands', () => {
      const result = execute('true', '/dev/null');

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('true', {
        stdio: 'pipe',
        cwd: '/dev/null',
        env: expect.any(Object),
      });
    });

    it('should execute failing commands', () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('');
      });
      const spy = consoleErrorSpy();

      const result = execute('false', '/dev/null');

      expect(result).toBe(false);
      expect(execSync).toHaveBeenCalledWith('false', {
        stdio: 'pipe',
        cwd: '/dev/null',
        env: expect.any(Object),
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenNthCalledWith(
        1,
        '[canarist] command "%s" failed in "%s"!',
        'false',
        '/dev/null'
      );

      spy.mockRestore();
    });

    it('should log stderr of failing command to stderr', () => {
      (execSync as jest.Mock).mockImplementationOnce(execSyncError);
      const spy = consoleErrorSpy();

      const result = execute('false', '/dev/null');

      expect(result).toBe(false);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(
        1,
        '[canarist] command "%s" failed in "%s"!',
        'false',
        '/dev/null'
      );
      expect(spy).toHaveBeenNthCalledWith(2, '');

      spy.mockRestore();
    });

    it('should output debug messages when debugging is enabled', () => {
      const debug = jest.fn();

      const result = execute(
        'true',
        '/dev/null',
        process.env,
        debug as unknown as Debugger
      );

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('true', {
        stdio: 'inherit',
        cwd: '/dev/null',
        env: expect.any(Object),
      });

      expect(debug).toHaveBeenCalledTimes(2);

      expect(debug).toHaveBeenNthCalledWith(
        1,
        'running command: "%s" in "%s"',
        'true',
        '/dev/null'
      );

      expect(debug).toHaveBeenNthCalledWith(2, 'done');
    });
  });

  describe('clone repositories', () => {
    it('should clone single repository', () => {
      cloneRepositories(
        partialConfig({
          repositories: [
            partialRepositoryConfig({
              url: 'https://github.com/xing/canarist.git',
              directory: 'canarist',
            }),
          ],
        }),
        '/cwd'
      );

      expect(execSync).toHaveBeenCalledWith(
        [
          'git clone https://github.com/xing/canarist.git /some/directory/canarist',
          '--single-branch',
          '--no-tags',
          '--quiet',
          '--branch master',
          '--depth 1',
        ].join(' '),
        { stdio: 'pipe', cwd: '/cwd', env: expect.any(Object) }
      );
    });

    it('should clone multiple repositories', () => {
      cloneRepositories(
        partialConfig({
          repositories: [
            partialRepositoryConfig({
              url: 'https://github.com/xing/canarist.git',
              directory: 'canarist',
            }),
            partialRepositoryConfig({
              url: '.',
              directory: 'canarist',
            }),
          ],
        }),
        '/cwd'
      );

      expect(execSync).toHaveBeenNthCalledWith(
        1,
        [
          'git clone https://github.com/xing/canarist.git /some/directory/canarist',
          '--single-branch',
          '--no-tags',
          '--quiet',
          '--branch master',
          '--depth 1',
        ].join(' '),
        { stdio: 'pipe', cwd: '/cwd', env: expect.any(Object) }
      );

      expect(execSync).toHaveBeenNthCalledWith(
        2,
        [
          'git clone . /some/directory/canarist',
          '--single-branch',
          '--no-tags',
          '--quiet',
          '--branch master',
        ].join(' '),
        { stdio: 'pipe', cwd: '/cwd', env: expect.any(Object) }
      );
    });

    it('should not add `--branch` argument when branch is empty', () => {
      cloneRepositories(
        partialConfig({
          repositories: [
            partialRepositoryConfig({
              url: '.',
              directory: 'canarist',
              branch: '',
            }),
          ],
        }),
        '/cwd'
      );

      expect(execSync).toHaveBeenCalledWith(
        [
          'git clone . /some/directory/canarist',
          '--single-branch',
          '--no-tags',
          '--quiet',
        ].join(' '),
        { stdio: 'pipe', cwd: '/cwd', env: expect.any(Object) }
      );
    });

    it('should throw an error if cloning failed', () => {
      (execSync as jest.Mock).mockImplementationOnce(execSyncError);
      const spy = consoleErrorSpy();

      expect(() =>
        cloneRepositories(
          partialConfig({
            repositories: [
              partialRepositoryConfig({
                url: 'https://github.com/xing/canarist.git',
              }),
            ],
          }),
          '/cwd'
        )
      ).toThrow(/Failed to clone repositories/);

      spy.mockRestore();
    });
  });

  describe('yarn', () => {
    it('should install dependencies using yarn', () => {
      yarn(partialConfig());

      expect(execSync).toHaveBeenCalledWith('yarn', {
        stdio: 'pipe',
        cwd: '/some/directory',
        env: expect.any(Object),
      });
    });

    it('should pass extra arguments to yarn', () => {
      yarn(partialConfig({ yarnArguments: '--production=false' }));

      expect(execSync).toHaveBeenCalledWith('yarn --production=false', {
        stdio: 'pipe',
        cwd: '/some/directory',
        env: expect.any(Object),
      });
    });

    it('should throw an error if yarn fails', () => {
      (execSync as jest.Mock).mockImplementationOnce(execSyncError);
      const spy = consoleErrorSpy();

      expect(() => yarn(partialConfig())).toThrow(
        /Failed to install dependencies/
      );

      spy.mockRestore();
    });
  });

  describe('executeCommands', () => {
    beforeEach(() => {
      (execSync as jest.Mock).mockReset();
    });

    it('should execute commands', () => {
      executeCommands(
        partialConfig({
          repositories: [
            partialRepositoryConfig({
              url: 'https://github.com/xing/canarist.git',
              directory: 'canarist',
            }),
          ],
        })
      );

      expect(execSync).toHaveBeenCalledWith('yarn test', {
        stdio: 'pipe',
        cwd: '/some/directory/canarist',
        env: expect.any(Object),
      });
    });

    it('should log debug message when skipping empty commands', () => {
      const debug = jest.fn();

      executeCommands(
        partialConfig({
          repositories: [
            partialRepositoryConfig({
              url: 'https://github.com/xing/canarist.git',
              commands: [''],
            }),
          ],
        }),
        debug as unknown as Debugger
      );

      expect(execSync).not.toHaveBeenCalled();
      expect(debug).toHaveBeenCalledWith(
        'skipping empty command for "%s"',
        'https://github.com/xing/canarist.git'
      );
    });

    it('should throw an error if command fails', () => {
      (execSync as jest.Mock).mockImplementationOnce(execSyncError);
      const spy = consoleErrorSpy();

      expect(() =>
        executeCommands(
          partialConfig({
            repositories: [
              partialRepositoryConfig({
                url: 'https://github.com/xing/canarist.git',
                directory: 'canarist',
              }),
            ],
          })
        )
      ).toThrow(/Failed to run configured commands/);

      spy.mockRestore();
    });
  });
});
