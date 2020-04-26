import { execSync } from 'child_process';
import { executeCommands } from '../execute-commands';

jest.mock('child_process');

describe('executeCommands', () => {
  beforeEach(() => {
    (execSync as jest.Mock).mockReset();
  });

  it('execute commands', () => {
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
});
