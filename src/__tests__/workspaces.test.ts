import { readFileSync } from 'fs';
import glob from 'fast-glob';
import {
  collectWorkspaces,
  createRootManifest,
  alignWorkspaceVersions,
} from '../workspaces';
import {
  partialWorkspacesConfig,
  partialConfig,
  partialRepositoryConfig,
  partialWorkspacesRepositoryConfig,
} from './_helpers';

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

const nohoistManifest = {
  name: 'nohoist',
  version: '1.0.0',
  workspaces: {
    packages: ['packages/*'],
    nohoist: ['packages/pkg-1/react'],
  },
};

const nohoistPkg1 = {
  name: 'nohoist-pkg-1',
  version: '1.0.0',
  dependencies: {
    react: '^16.8.0',
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
    case '/some/directory/nohoist/package.json':
      return JSON.stringify(nohoistManifest);
    case '/some/directory/nohoist/packages/pkg-1/package.json':
      return JSON.stringify(nohoistPkg1);
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
    case 'nohoist/packages/*/package.json':
      return ['/some/directory/nohoist/packages/pkg-1/package.json'];
  }
  return [];
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
          partialRepositoryConfig({
            url: 'https://github.com/xing/canarist.git',
            directory: 'canarist',
          }),
          partialRepositoryConfig({
            url: 'https://github.com/xing/hops.git',
            directory: 'hops',
          }),
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
          partialRepositoryConfig({
            url: 'https://github.com/xing/canarist.git',
            directory: 'canarist',
          }),
          partialRepositoryConfig({
            url: 'https://github.com/xing/hops.git',
            directory: 'hops',
          }),
          partialRepositoryConfig({
            url: 'https://github.com/xing/nohoist.git',
            directory: 'nohoist',
          }),
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
      [
        {
          path: '/some/directory/nohoist/packages/pkg-1/package.json',
          manifest: nohoistPkg1,
        },
      ],
    ]);
  });
});

describe('createRootManifest', () => {
  it('should create root manifest', () => {
    const manifest = createRootManifest(partialWorkspacesConfig());

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
      partialWorkspacesConfig({
        rootManifest: {
          devDependencies: { jest: '^25' },
          workspaces: ['another-workspace'],
        },
      })
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
      partialWorkspacesConfig({
        repositories: [
          partialWorkspacesRepositoryConfig({
            url: 'https://github.com/xing/canarist.git',
            directory: 'canarist',
            manifest: canaristManifest,
          }),
          partialWorkspacesRepositoryConfig({
            url: 'https://github.com/xing/hops.git',
            directory: 'hops',
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
          }),
        ],
      })
    );

    expect(manifest.workspaces).toEqual([
      'canarist',
      'hops',
      'hops/demo',
      'hops/packages/*',
    ]);
  });

  it('should merge workspaces and nohoist patterns of root manifests', () => {
    const manifest = createRootManifest(
      partialWorkspacesConfig({
        repositories: [
          partialWorkspacesRepositoryConfig({
            url: 'https://github.com/xing/hops.git',
            directory: 'hops',
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
          }),
          partialWorkspacesRepositoryConfig({
            url: 'https://github.com/xing/nohoist.git',
            directory: 'nohoist',
            manifest: nohoistManifest,
            packages: [
              {
                path: '/some/directory/nohoist/packages/pkg-1/package.json',
                manifest: nohoistPkg1,
              },
            ],
          }),
        ],
      })
    );

    expect(manifest.workspaces).toEqual({
      nohoist: ['nohoist/packages/pkg-1/react'],
      packages: [
        'hops',
        'hops/demo',
        'hops/packages/*',
        'nohoist',
        'nohoist/packages/*',
      ],
    });
  });

  it('should merge resolutions of root manifests', () => {
    const manifest = createRootManifest(
      partialWorkspacesConfig({
        repositories: [
          partialWorkspacesRepositoryConfig({
            url: 'https://github.com/xing/canarist.git',
            directory: 'canarist',
            manifest: canaristManifest,
          }),
        ],
      })
    );

    expect(manifest.resolutions).toEqual({ jest: '^24.0.0' });
  });

  it('should warn on incompatible resolutions', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {
      /* swallow logs */
    });

    const manifest = createRootManifest(
      partialWorkspacesConfig({
        repositories: [
          partialWorkspacesRepositoryConfig({
            url: 'https://github.com/xing/canarist.git',
            directory: 'canarist',
            manifest: canaristManifest,
          }),
          partialWorkspacesRepositoryConfig({
            url: 'https://github.com/xing/canarist.git',
            directory: 'canarist',
            manifest: { ...canaristManifest, resolutions: { jest: '^25.0.0' } },
          }),
        ],
      })
    );

    expect(manifest.resolutions).toEqual({ jest: '^25.0.0' });
    expect(spy).toHaveBeenCalledWith(
      '[canarist] incompatible resolutions found: "%s" is defined as "%s" and "%s"',
      'jest',
      '^24.0.0',
      '^25.0.0'
    );

    spy.mockRestore();
  });
});

describe('alignWorkspaceVersions', () => {
  it('should align all versions across workspaces', () => {
    const manifests = alignWorkspaceVersions(
      partialWorkspacesConfig({
        repositories: [
          partialWorkspacesRepositoryConfig({
            url: 'https://github.com/xing/canarist.git',
            directory: 'canarist',
            manifest: canaristManifest,
          }),
          partialWorkspacesRepositoryConfig({
            url: 'https://github.com/xing/hops.git',
            directory: 'hops',
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
          }),
        ],
      })
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
