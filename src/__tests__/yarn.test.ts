import { execSync } from 'child_process';
import { yarn } from '../yarn';

jest.mock('child_process');

describe('yarn', () => {
  beforeEach(() => {
    (execSync as jest.Mock).mockReset();
  });

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

  it('should log debug messages when debugger is passed', () => {
    const debug = jest.fn();

    yarn(
      {
        repositories: [],
        rootManifest: {},
        targetDirectory: '/some/directory',
        yarnArguments: '',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      debug as any
    );

    expect(debug).toHaveBeenCalledWith('command: %s', 'yarn');

    expect(execSync).toHaveBeenCalledWith('yarn', {
      stdio: 'inherit',
      cwd: '/some/directory',
    });
  });

  it('should log errors', () => {
    (execSync as jest.Mock).mockImplementation(() => {
      const error = new Error('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).stderr = Buffer.from('Installation failed');
      throw error;
    });

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {
      /* suppress console output */
    });

    yarn({
      repositories: [],
      rootManifest: {},
      targetDirectory: '/some/directory',
      yarnArguments: '',
    });

    expect(spy).toHaveBeenNthCalledWith(
      1,
      '[canarist] command "%s" failed!',
      'yarn'
    );

    expect(spy).toHaveBeenNthCalledWith(2, '[canarist]', 'Installation failed');

    spy.mockRestore();
    (execSync as jest.Mock).mockRestore();
  });
});
