import { cloneRepositories } from '../clone';
import { execSync } from 'child_process';
import { Config } from '../config';

jest.mock('child_process');

describe('clone repositories', () => {
  beforeEach(() => {
    (execSync as jest.Mock).mockReset();
  });

  it('should clone remote repository with depth 1', () => {
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
        '--depth 1',
        '--single-branch',
        '--no-tags',
        '--branch master',
      ].join(' '),
      { stdio: 'pipe' }
    );
  });

  it('should clone local repository without setting depth', () => {
    cloneRepositories({
      repositories: [
        {
          url: '.',
          branch: 'master',
          directory: 'canarist',
        },
      ],
      targetDirectory: '/dev/null',
    } as Config);

    expect(execSync).toHaveBeenCalledWith(
      [
        'git clone . /dev/null/canarist',
        '--single-branch',
        '--no-tags',
        '--branch master',
      ].join(' '),
      { stdio: 'pipe' }
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
        '--depth 1',
        '--single-branch',
        '--no-tags',
        '--branch master',
      ].join(' '),
      { stdio: 'pipe' }
    );

    expect(execSync).toHaveBeenNthCalledWith(
      2,
      [
        'git clone . /dev/null/canarist',
        '--single-branch',
        '--no-tags',
        '--branch master',
      ].join(' '),
      { stdio: 'pipe' }
    );
  });

  it('should log debug messages when debugger is passed into function', () => {
    const debug = jest.fn();

    cloneRepositories(
      {
        repositories: [
          {
            url: '.',
            branch: 'master',
            directory: 'canarist',
          },
        ],
        targetDirectory: '/dev/null',
      } as Config,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      debug as any
    );

    const command = [
      'git clone . /dev/null/canarist',
      '--single-branch',
      '--no-tags',
      '--branch master',
    ].join(' ');

    expect(execSync).toHaveBeenCalledWith(command, { stdio: 'inherit' });

    expect(debug).toHaveBeenCalledWith('command: %s', command);
  });

  it('should log errors', () => {
    (execSync as jest.Mock).mockImplementation(() => {
      const error = new Error('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).stderr = Buffer.from(
        "fatal: destination path '/dev/null' already exists and is not an empty directory."
      );
      throw error;
    });

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });

    cloneRepositories({
      repositories: [
        {
          url: '.',
          branch: 'master',
          directory: 'canarist',
        },
      ],
      targetDirectory: '/dev/null',
    } as Config);

    expect(spy).toHaveBeenNthCalledWith(
      1,
      '[canarist] command "%s" failed!',
      'git clone . /dev/null/canarist --single-branch --no-tags --branch master'
    );

    expect(spy).toHaveBeenNthCalledWith(
      2,
      '[canarist]',
      "fatal: destination path '/dev/null' already exists and is not an empty directory."
    );

    expect(execSync).toHaveBeenCalledWith(
      [
        'git clone . /dev/null/canarist',
        '--single-branch',
        '--no-tags',
        '--branch master',
      ].join(' '),
      { stdio: 'pipe' }
    );

    spy.mockRestore();
    (execSync as jest.Mock).mockRestore();
  });
});
