import { readFileSync } from 'fs';
import glob from 'fast-glob';
import {
  collectWorkspaces,
  createRootManifest,
  WorkspacesConfig,
  alignWorkspaceVersions,
} from '../workspaces';
import { Config } from '../config';

jest.mock('fs');
jest.mock('fast-glob');

const canaristManifest = {
  name: 'canarist',
  version: '1.0.0',
  resolutions: {
    jest: '^24.0.0',
  },
};

const hopsManifest = {
  name: 'hops',
  version: '1.0.0',
  workspaces: ['demo', 'packages/*'],
};

const hopsDemoManifest = {
  name: 'hops-demo',
  version: '1.0.0',
  dependencies: {
    canarist: '0.0.1',
  },
};

const hopsPackage1Manifest = {
  name: 'package-1',
  version: '1.0.0',
};

const hopsPackage2Manifest = {
  name: 'package-2',
  version: '1.0.0',
  dependencies: {
    'left-pad': '0.0.1',
  },
  devDependencies: {
    canarist: '^0.0.1',
    'package-1': '1.0.0',
  },
};

function readFileSyncMock(path: string): string {
  switch (path) {
    case '/some/directory/canarist/package.json':
      return JSON.stringify(canaristManifest);
    case '/some/directory/hops/package.json':
      return JSON.stringify(hopsManifest);
    case '/some/directory/hops/demo/package.json':
      return JSON.stringify(hopsDemoManifest);
    case '/some/directory/hops/packages/package-1/package.json':
      return JSON.stringify(hopsPackage1Manifest);
    case '/some/directory/hops/packages/package-2/package.json':
      return JSON.stringify(hopsPackage2Manifest);
  }
  return '';
}

function globSyncMock(pattern: string): string[] {
  switch (pattern) {
    case 'hops/demo/package.json':
      return ['/some/directory/hops/demo/package.json'];
    case 'hops/packages/*/package.json':
      return [
        '/some/directory/hops/packages/package-1/package.json',
        '/some/directory/hops/packages/package-2/package.json',
      ];
  }
  return [];
}

function partialConfig({
  repositories = [],
  targetDirectory = '/some/directory',
  yarnArguments = '',
  rootManifest = {},
}: Partial<Config> = {}): Config {
  return {
    repositories,
    targetDirectory,
    yarnArguments,
    rootManifest,
  };
}

describe('collectWorkspaces', () => {
  beforeEach(() => {
    (readFileSync as jest.Mock).mockImplementation(readFileSyncMock);
    (glob.sync as jest.Mock).mockImplementation(globSyncMock);
  });

  afterEach(() => {
    (readFileSync as jest.Mock).mockReset();
    (glob.sync as jest.Mock).mockReset();
  });

  it('should add parsed manifest to repository', () => {
    const config = collectWorkspaces(
      partialConfig({
        repositories: [
          {
            url: 'https://github.com/xing/canarist.git',
            branch: 'master',
            directory: 'canarist',
            commands: [],
          },
          {
            url: 'https://github.com/xing/hops.git',
            branch: 'master',
            directory: 'hops',
            commands: [],
          },
        ],
      })
    );

    expect(config.repositories.map((r) => r.manifest)).toEqual([
      canaristManifest,
      hopsManifest,
    ]);
  });

  it('should parse manifests of packages', () => {
    const config = collectWorkspaces(
      partialConfig({
        repositories: [
          {
            url: 'https://github.com/xing/canarist.git',
            branch: 'master',
            directory: 'canarist',
            commands: [],
          },
          {
            url: 'https://github.com/xing/hops.git',
            branch: 'master',
            directory: 'hops',
            commands: [],
          },
        ],
      })
    );

    expect(config.repositories.map((r) => r.packages)).toEqual([
      [],
      [
        {
          path: '/some/directory/hops/demo/package.json',
          manifest: hopsDemoManifest,
        },
        {
          path: '/some/directory/hops/packages/package-1/package.json',
          manifest: hopsPackage1Manifest,
        },
        {
          path: '/some/directory/hops/packages/package-2/package.json',
          manifest: hopsPackage2Manifest,
        },
      ],
    ]);
  });
});

describe('createRootManifest', () => {
  it('should create root manifest', () => {
    const manifest = createRootManifest(partialConfig() as WorkspacesConfig);

    expect(manifest).toEqual({
      name: 'canarist-root',
      version: '0.0.0-private',
      private: true,
      workspaces: [],
      resolutions: {},
    });
  });

  it('should merge root manifest additions', () => {
    const manifest = createRootManifest(
      partialConfig({
        rootManifest: {
          devDependencies: { jest: '^25' },
          workspaces: ['another-workspace'],
        },
      }) as WorkspacesConfig
    );

    expect(manifest).toEqual({
      name: 'canarist-root',
      version: '0.0.0-private',
      private: true,
      workspaces: ['another-workspace'],
      resolutions: {},
      devDependencies: {
        jest: '^25',
      },
    });
  });

  it('should merge workspaces of root manifests', () => {
    const manifest = createRootManifest(
      partialConfig({
        repositories: [
          {
            url: 'https://github.com/xing/canarist.git',
            branch: 'master',
            directory: 'canarist',
            commands: [],
            manifest: canaristManifest,
            packages: [],
          },
          {
            url: 'https://github.com/xing/hops.git',
            branch: 'master',
            directory: 'hops',
            commands: [],
            manifest: hopsManifest,
            packages: [
              {
                path: '/some/directory/hops/demo/package.json',
                manifest: hopsDemoManifest,
              },
              {
                path: '/some/directory/hops/packages/package-1/package.json',
                manifest: hopsPackage1Manifest,
              },
              {
                path: '/some/directory/hops/packages/package-2/package.json',
                manifest: hopsPackage2Manifest,
              },
            ],
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as WorkspacesConfig
    );

    expect(manifest.workspaces).toEqual([
      'canarist',
      'hops',
      'hops/demo',
      'hops/packages/*',
    ]);
  });

  it('should merge resolutions of root manifests', () => {
    const manifest = createRootManifest(
      partialConfig({
        repositories: [
          {
            url: 'https://github.com/xing/canarist.git',
            branch: 'master',
            directory: 'canarist',
            commands: [],
            manifest: canaristManifest,
            packages: [],
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as WorkspacesConfig
    );

    expect(manifest.resolutions).toEqual({ jest: '^24.0.0' });
  });
});

describe('alignWorkspaceVersions', () => {
  it('should align all versions across workspaces', () => {
    const manifests = alignWorkspaceVersions(
      partialConfig({
        repositories: [
          {
            url: 'https://github.com/xing/canarist.git',
            branch: 'master',
            directory: 'canarist',
            commands: [],
            manifest: canaristManifest,
            packages: [],
          },
          {
            url: 'https://github.com/xing/hops.git',
            branch: 'master',
            directory: 'hops',
            commands: [],
            manifest: hopsManifest,
            packages: [
              {
                path: '/some/directory/hops/demo/package.json',
                manifest: hopsDemoManifest,
              },
              {
                path: '/some/directory/hops/packages/package-1/package.json',
                manifest: hopsPackage1Manifest,
              },
              {
                path: '/some/directory/hops/packages/package-2/package.json',
                manifest: hopsPackage2Manifest,
              },
            ],
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as WorkspacesConfig
    );

    expect(manifests).toEqual([
      {
        path: '/some/directory/canarist/package.json',
        manifest: canaristManifest,
      },
      {
        path: '/some/directory/hops/package.json',
        manifest: hopsManifest,
      },
      {
        path: '/some/directory/hops/demo/package.json',
        manifest: {
          ...hopsDemoManifest,
          dependencies: { canarist: '1.0.0' },
        },
      },
      {
        path: '/some/directory/hops/packages/package-1/package.json',
        manifest: hopsPackage1Manifest,
      },
      {
        path: '/some/directory/hops/packages/package-2/package.json',
        manifest: {
          ...hopsPackage2Manifest,
          devDependencies: { canarist: '1.0.0', 'package-1': '1.0.0' },
        },
      },
    ]);
  });
});
