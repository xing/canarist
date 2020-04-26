import { execSync } from 'child_process';
import { execute, executeCommands, cloneRepositories, yarn } from '../commands';
import type { Debugger } from 'debug';
import { Config } from '../config';

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
      });
    });

    it('should execute failing commands', () => {
      (execSync as jest.Mock).mockImplementationOnce(execSyncError);
      const spy = consoleErrorSpy();

      const result = execute('false', '/dev/null');

      expect(result).toBe(false);
      expect(execSync).toHaveBeenCalledWith('false', {
        stdio: 'pipe',
        cwd: '/dev/null',
      });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(
        1,
        '[canarist] command "%s" failed!',
        'false'
      );
      expect(spy).toHaveBeenNthCalledWith(2, '');

      spy.mockRestore();
    });

    it('should output debug messages when debugging is enabled', () => {
      const debug = jest.fn();

      const result = execute(
        'true',
        '/dev/null',
        (debug as unknown) as Debugger
      );

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('true', {
        stdio: 'inherit',
        cwd: '/dev/null',
      });

      expect(debug).toHaveBeenCalledTimes(2);

      expect(debug).toHaveBeenNthCalledWith(
        1,
        'running command: "%s" in "%s"',
        'true',
        '/dev/null'
      );

      expect(debug).toHaveBeenNthCalledWith(
        2,
        'command: "%s" finished successfully',
        'true'
      );
    });
  });

  describe('clone repositories', () => {
    it('should clone single repository', () => {
      cloneRepositories({
        repositories: [
          {
            url: 'https://github.com/xing/canarist.git',
            branch: 'master',
            directory: 'canarist',
          },
        ],
        targetDirectory: '/dev/null',
      } as Config);

      expect(execSync).toHaveBeenCalledWith(
        [
          'git clone https://github.com/xing/canarist.git /dev/null/canarist',
          '--single-branch',
          '--no-tags',
          '--branch master',
          '--depth 1',
        ].join(' '),
        { stdio: 'pipe', cwd: '/dev/null' }
      );
    });

    it('should clone multiple repositories', () => {
      cloneRepositories({
        repositories: [
          {
            url: 'https://github.com/xing/canarist.git',
            branch: 'master',
            directory: 'canarist',
          },
          {
            url: '.',
            branch: 'master',
            directory: 'canarist',
          },
        ],
        targetDirectory: '/dev/null',
      } as Config);

      expect(execSync).toHaveBeenNthCalledWith(
        1,
        [
          'git clone https://github.com/xing/canarist.git /dev/null/canarist',
          '--single-branch',
          '--no-tags',
          '--branch master',
          '--depth 1',
        ].join(' '),
        { stdio: 'pipe', cwd: '/dev/null' }
      );

      expect(execSync).toHaveBeenNthCalledWith(
        2,
        [
          'git clone . /dev/null/canarist',
          '--single-branch',
          '--no-tags',
          '--branch master',
        ].join(' '),
        { stdio: 'pipe', cwd: '/dev/null' }
      );
    });

    it('should throw an error if cloning failed', () => {
      (execSync as jest.Mock).mockImplementationOnce(execSyncError);
      const spy = consoleErrorSpy();

      expect(() =>
        cloneRepositories({
          repositories: [
            {
              url: 'https://github.com/xing/canarist.git',
              branch: 'master',
              directory: 'canarist',
            },
          ],
          targetDirectory: '/dev/null',
        } as Config)
      ).toThrow(/Failed to clone repositories/);

      spy.mockRestore();
    });
  });

  describe('yarn', () => {
    it('should install dependencies using yarn', () => {
      yarn({
        repositories: [],
        rootManifest: {},
        targetDirectory: '/some/directory',
        yarnArguments: '',
      });

      expect(execSync).toHaveBeenCalledWith('yarn', {
        stdio: 'pipe',
        cwd: '/some/directory',
      });
    });

    it('should pass extra arguments to yarn', () => {
      yarn({
        repositories: [],
        rootManifest: {},
        targetDirectory: '/some/directory',
        yarnArguments: '--production=false',
      });

      expect(execSync).toHaveBeenCalledWith('yarn --production=false', {
        stdio: 'pipe',
        cwd: '/some/directory',
      });
    });

    it('should throw an error if yarn fails', () => {
      (execSync as jest.Mock).mockImplementationOnce(execSyncError);
      const spy = consoleErrorSpy();

      expect(() =>
        yarn({
          repositories: [],
          rootManifest: {},
          targetDirectory: '/some/directory',
          yarnArguments: '',
        })
      ).toThrow(/Failed to install dependencies/);

      spy.mockRestore();
    });
  });

  describe('executeCommands', () => {
    beforeEach(() => {
      (execSync as jest.Mock).mockReset();
    });

    it('should execute commands', () => {
      executeCommands({
        repositories: [
          {
            url: 'https://github.com/xing/canarist.git',
            branch: 'master',
            directory: 'canarist',
            commands: ['yarn test'],
          },
        ],
        targetDirectory: '/some/directory',
        rootManifest: {},
        yarnArguments: '',
      });

      expect(execSync).toHaveBeenCalledWith('yarn test', {
        stdio: 'pipe',
        cwd: '/some/directory/canarist',
      });
    });

    it('should log debug message when skipping empty commands', () => {
      const debug = jest.fn();

      executeCommands(
        {
          repositories: [
            {
              url: 'https://github.com/xing/canarist.git',
              branch: 'master',
              directory: 'canarist',
              commands: [''],
            },
          ],
          targetDirectory: '/some/directory',
          rootManifest: {},
          yarnArguments: '',
        },
        (debug as unknown) as Debugger
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
        executeCommands({
          repositories: [
            {
              url: 'https://github.com/xing/canarist.git',
              branch: 'master',
              directory: 'canarist',
              commands: ['yarn test'],
            },
          ],
          targetDirectory: '/some/directory',
          rootManifest: {},
          yarnArguments: '',
        })
      ).toThrow(/Failed to run configured commands/);

      spy.mockRestore();
    });
  });
});
