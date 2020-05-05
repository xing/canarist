import { mkdtempSync } from 'fs';
import { normalizeConfig } from '../config';

jest.mock('fs');

describe('normalize config', () => {
  beforeEach(() => {
    (mkdtempSync as jest.Mock).mockImplementation(() => '/tmp/canarist-XXXXXX');
  });

  afterEach(() => {
    (mkdtempSync as jest.Mock).mockReset();
  });

  describe('CLI usage', () => {
    it('should throw an error if no arguments are passed', () => {
      // $ canarist
      expect(() => {
        normalizeConfig({ _: [] }, null);
      }).toThrow(/No repositories are passed through arguments/);
    });

    it('should normalize arguments for single repository', () => {
      // $ canarist -r a-repo
      const config = normalizeConfig(
        {
          _: [],
          repository: 'a-repo',
        },
        null
      );

      expect(config.repositories).toEqual([
        {
          url: 'a-repo',
          branch: 'master',
          directory: 'a-repo',
          commands: ['yarn test'],
        },
      ]);
    });

    it('should normalize arguments for multiple repositories', () => {
      // $ canarist -r a-repo -r b-repo
      const config = normalizeConfig(
        {
          _: [],
          repository: ['a-repo', 'b-repo'],
        },
        null
      );

      expect(config.repositories).toEqual([
        {
          url: 'a-repo',
          branch: 'master',
          directory: 'a-repo',
          commands: ['yarn test'],
        },
        {
          url: 'b-repo',
          branch: 'master',
          directory: 'b-repo',
          commands: ['yarn test'],
        },
      ]);
    });

    it('should allow to specify the branch name', () => {
      // $ canarist -r [a-repo -b some-branch]
      const config = normalizeConfig(
        {
          _: [],
          repository: [
            {
              _: ['a-repo'],
              branch: 'some-branch',
            },
          ],
        },
        null
      );

      expect(config.repositories[0].branch).toBe('some-branch');
    });

    it('should allow to specify the directory name', () => {
      // $ canarist -r [a-repo -d some-directory]
      const config = normalizeConfig(
        {
          _: [],
          repository: [
            {
              _: ['a-repo'],
              directory: 'some-directory',
            },
          ],
        },
        null
      );

      expect(config.repositories[0].directory).toBe('some-directory');
    });

    it('should allow to specify an empty command', () => {
      // $ canarist -r [a-repo -c]
      const config = normalizeConfig(
        {
          _: [],
          repository: [
            {
              _: ['a-repo'],
              command: '',
            },
          ],
        },
        null
      );

      expect(config.repositories[0].commands).toEqual(['']);
    });

    it('should allow to specify multiple commands', () => {
      // $ canarist -r [a-repo -c "yarn lint" -c "yarn test"]
      const config = normalizeConfig(
        {
          _: [],
          repository: [
            {
              _: ['a-repo'],
              command: ['yarn lint', 'yarn test'],
            },
          ],
        },
        null
      );

      expect(config.repositories[0].commands).toEqual([
        'yarn lint',
        'yarn test',
      ]);
    });

    it('should detect directory name from repository url', () => {
      // $ canarist -r https://github.com/xing/canarist.git
      const config = normalizeConfig(
        {
          _: [],
          repository: ['https://github.com/xing/canarist.git'],
        },
        null
      );

      expect(config.repositories[0].directory).toBe('canarist');
    });

    it('should detect directory name from basename', () => {
      // $ canarist -r .
      const config = normalizeConfig(
        {
          _: [],
          repository: ['.'],
        },
        null
      );

      expect(config.repositories[0].directory).toBe('canarist');
    });

    it('should leave branch name blank when cloning from a local path', () => {
      // $ canarist -r .
      const config = normalizeConfig(
        {
          _: [],
          repository: ['.'],
        },
        null
      );

      expect(config.repositories[0].branch).toBe('');
    });

    it('should accept target directory', () => {
      // $ canarist -r . /some/dir
      const config = normalizeConfig(
        { _: ['/some/dir'], repository: '.' },
        null
      );

      expect(config.targetDirectory).toBe('/some/dir');
    });

    it('should default target directory to /tmp/canarist', () => {
      // $ canarist -r .
      const config = normalizeConfig({ _: [], repository: '.' }, null);

      expect(config.targetDirectory).toBe('/tmp/canarist-XXXXXX');
    });

    it('should accept root manifest additions', () => {
      // $ canarist -r . --root-manifest "{"devDependencies":{"jest":"^25"}}"
      const config = normalizeConfig(
        {
          _: [],
          repository: '.',
          'root-manifest': '{"devDependencies":{"jest":"^25"}}',
        },
        null
      );

      expect(config.rootManifest).toEqual({ devDependencies: { jest: '^25' } });
    });

    it('should default root manifest additions to an empty object', () => {
      // $ canarist -r .
      const config = normalizeConfig(
        {
          _: [],
          repository: '.',
        },
        null
      );

      expect(config.rootManifest).toEqual({});
    });

    it('should not fail on invalid root manifest additions', () => {
      // $ canarist -r . --root-manifest "{"devDependencies":{"jest":"^25"}}"
      const config = normalizeConfig(
        {
          _: [],
          repository: '.',
          'root-manifest': '{"devDepen',
        },
        null
      );

      expect(config.rootManifest).toEqual({});
    });

    it('should accept additional yarn arguments', () => {
      // $ canarist -r . --yarn-arguments "--production=false"
      const config = normalizeConfig(
        {
          _: [],
          repository: '.',
          'yarn-arguments': '--production=false',
        },
        null
      );

      expect(config.yarnArguments).toBe('--production=false');
    });

    it('should default additional yarn arguments to an empty string', () => {
      // $ canarist -r .
      const config = normalizeConfig(
        {
          _: [],
          repository: '.',
        },
        null
      );

      expect(config.yarnArguments).toBe('');
    });
  });

  describe('config usage', () => {
    it('should throw an error if no repositories are configured', () => {
      // $ canarist
      expect(() => {
        normalizeConfig(
          { _: [] },
          {
            filepath: '',
            config: {
              repositories: [],
            },
          }
        );
      }).toThrow(/No repositories are configured/);
    });

    it('should return config if no projects are configured', () => {
      // $ canarist
      const config = normalizeConfig(
        { _: [] },
        {
          filepath: '',
          config: {
            repositories: [
              {
                url: 'a-repo',
                branch: 'some-branch',
                directory: 'some-directory',
                commands: ['yarn lint', 'yarn test'],
              },
            ],
            targetDirectory: '/some/directory',
            rootManifest: { devDependencies: { jest: '^25' } },
            yarnArguments: '--production=false',
          },
        }
      );

      expect(config).toEqual({
        repositories: [
          {
            url: 'a-repo',
            branch: 'some-branch',
            directory: 'some-directory',
            commands: ['yarn lint', 'yarn test'],
          },
        ],
        rootManifest: { devDependencies: { jest: '^25' } },
        targetDirectory: '/some/directory',
        yarnArguments: '--production=false',
      });
    });

    it('should leave branch blank when cloning from a local path', () => {
      // $ canarist
      const config = normalizeConfig(
        { _: [] },
        {
          filepath: '',
          config: {
            repositories: [
              {
                url: '.',
              },
            ],
          },
        }
      );

      expect(config).toEqual({
        repositories: [
          {
            url: '.',
            branch: '',
            directory: 'canarist',
            commands: ['yarn test'],
          },
        ],
        rootManifest: {},
        targetDirectory: '/tmp/canarist-XXXXXX',
        yarnArguments: '',
      });
    });

    it('should throw an error if no project is selected', () => {
      // $ canarist
      expect(() => {
        normalizeConfig(
          { _: [] },
          {
            filepath: '',
            config: {
              projects: [],
            },
          }
        );
      }).toThrow(/No project is selected/);
    });

    it('should throw an error if selected project does not exist', () => {
      // $ canarist -p a-project
      expect(() => {
        normalizeConfig(
          { _: [], project: 'a-project' },
          {
            filepath: '',
            config: {
              projects: [
                {
                  name: 'not-a-project',
                  repositories: [],
                },
              ],
            },
          }
        );
      }).toThrow(/Project "a-project" does not exist/);
    });

    it('should throw an error if no project config exists', () => {
      // $ canarist -p a-project
      expect(() => {
        normalizeConfig(
          { _: [], project: 'a-project' },
          {
            filepath: '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            config: {} as any,
          }
        );
      }).toThrow(/Project config for "a-project" does not exist/);
    });

    it('should return config of selected project with defaults', () => {
      // $ canarist -p a-project
      const config = normalizeConfig(
        { _: [], project: 'a-project' },
        {
          filepath: '',
          config: {
            projects: [
              {
                name: 'a-project',
                repositories: [{ url: 'a-repo' }],
              },
            ],
          },
        }
      );

      expect(config).toEqual({
        repositories: [
          {
            url: 'a-repo',
            branch: 'master',
            directory: 'a-repo',
            commands: ['yarn test'],
          },
        ],
        rootManifest: {},
        targetDirectory: '/tmp/canarist-XXXXXX',
        yarnArguments: '',
      });
    });

    it('should return config of selected project', () => {
      // $ canarist -p a-project
      const config = normalizeConfig(
        { _: [], project: 'a-project' },
        {
          filepath: '',
          config: {
            projects: [
              {
                name: 'a-project',
                repositories: [
                  {
                    url: 'a-repo',
                    branch: 'some-branch',
                    directory: 'some-directory',
                    commands: ['yarn lint', 'yarn test'],
                  },
                ],
                targetDirectory: '/some/directory',
                rootManifest: { devDependencies: { jest: '^25' } },
                yarnArguments: '--production=false',
              },
            ],
          },
        }
      );

      expect(config).toEqual({
        repositories: [
          {
            url: 'a-repo',
            branch: 'some-branch',
            directory: 'some-directory',
            commands: ['yarn lint', 'yarn test'],
          },
        ],
        rootManifest: { devDependencies: { jest: '^25' } },
        targetDirectory: '/some/directory',
        yarnArguments: '--production=false',
      });
    });
  });

  it('should give precedence to CLI config', () => {
    // $ canarist -r b-repo
    const config = normalizeConfig(
      { _: [], repository: 'b-repo' },
      {
        filepath: '',
        config: {
          projects: [
            {
              name: 'a-project',
              repositories: [
                {
                  url: 'a-repo',
                  branch: 'some-branch',
                  directory: 'some-directory',
                  commands: ['yarn lint', 'yarn test'],
                },
              ],
              targetDirectory: '/some/directory',
              rootManifest: { devDependencies: { jest: '^25' } },
              yarnArguments: '--production=false',
            },
          ],
        },
      }
    );

    expect(config).toEqual({
      repositories: [
        {
          url: 'b-repo',
          branch: 'master',
          directory: 'b-repo',
          commands: ['yarn test'],
        },
      ],
      rootManifest: {},
      targetDirectory: '/tmp/canarist-XXXXXX',
      yarnArguments: '',
    });
  });
});
