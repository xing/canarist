import { execSync } from 'child_process';

// eslint-disable-next-line node/no-missing-require
const pathToBin = require.resolve('canarist/dist/bin.js');

function canarist(
  ...args: string[]
): {
  exitCode: number;
  stdout: string | null;
  stderr: string | null;
} {
  try {
    const stdout = execSync(`node ${pathToBin} ${args.join(' ')}`, {
      stdio: 'pipe',
    });

    return {
      exitCode: 0,
      stdout: stdout ? stdout.toString() : null,
      stderr: null,
    };
  } catch (error) {
    return {
      exitCode: error.status,
      stdout: error.stdout ? error.stdout.toString() : null,
      stderr: error.stderr ? error.stderr.toString() : null,
    };
  }
}

const repository = 'https://github.com/xing/canarist.git';

describe('integration tests', () => {
  it('should execute build and test command in monorepo-a and monorepo-b', (): void => {
    const { exitCode, stdout } = canarist(
      `-r [${repository} -d folder-a -b monorepo-a -c "yarn build"]`,
      `-r [${repository} -d folder-b -b monorepo-b]`
    );

    expect(exitCode).toBe(0);

    expect(stdout).toContain('[canarist] executing command "yarn build"');
    expect(stdout).toContain('[canarist] executing command "yarn test"');
    expect(stdout).toContain('[canarist] finished successfully!');
  });

  it('should fail when a command fails', (): void => {
    const { exitCode, stdout, stderr } = canarist(
      `-r [${repository} -d folder-a -b monorepo-a -c "yarn build"]`,
      `-r [${repository} -d folder-b -b monorepo-b -c "yarn run not-available"]`
    );

    expect(exitCode).toBe(1);

    expect(stdout).toContain(
      '[canarist] executing command "yarn run not-available"'
    );
    expect(stderr).toContain(
      '[canarist] command "yarn run not-available" failed'
    );
    // this is the stderr output from yarn because "not-available" is not found
    expect(stderr).toContain('error Command "not-available" not found');
    expect(stderr).toContain(
      '[canarist] exited with error "Failed to run configured commands"'
    );
  });
});
