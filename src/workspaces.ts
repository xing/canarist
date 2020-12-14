import { readFileSync } from 'fs';
import { join } from 'path';
import glob from 'fast-glob';
import semver from 'semver';
import mergeWith from 'lodash.mergewith';
import type { Config } from './config';
import type { PackageJSON } from './package-json';

const hasKey = <K extends string>(
  key: K,
  object: unknown
): object is Record<K, unknown> => {
  return typeof object === 'object' && object !== null && key in object;
};

type VersionMap = Record<string, string>;

export interface WorkspacesConfig extends Config {
  repositories: (Config['repositories'][0] & {
    manifest: PackageJSON;
    packages: { path: string; manifest: PackageJSON }[];
  })[];
}

export function collectWorkspaces(config: Config): WorkspacesConfig {
  const repositories = config.repositories.map((repo) => {
    const manifest = JSON.parse(
      readFileSync(
        join(config.targetDirectory, repo.directory, 'package.json'),
        'utf8'
      )
    );

    return {
      ...repo,
      manifest,
      packages: (manifest.workspaces || [])
        .map((pattern: string) => {
          return glob
            .sync(join(repo.directory, pattern, 'package.json'), {
              cwd: config.targetDirectory,
              absolute: true,
            })
            .map((path) => {
              return {
                path,
                manifest: JSON.parse(readFileSync(path, 'utf8')),
              };
            });
        })
        .flat(),
    };
  });

  return {
    ...config,
    repositories,
  };
}

export function createRootManifest(config: WorkspacesConfig): PackageJSON {
  const workspaces = config.repositories.reduce((accumulator, repository) => {
    const { workspaces } = repository.manifest;
    const packages = Array.isArray(workspaces)
      ? workspaces
      : workspaces && Array.isArray(workspaces.packages)
      ? workspaces.packages
      : [];

    return [
      ...accumulator,
      repository.directory,
      ...packages.map((pattern) => join(repository.directory, pattern)),
    ];
  }, [] as string[]);

  const nohoist = config.repositories.reduce((accumulator, repository) => {
    const { workspaces } = repository.manifest;
    return accumulator.concat(
      ...(hasKey('nohoist', workspaces) && Array.isArray(workspaces.nohoist)
        ? workspaces.nohoist.map((p) => join(repository.directory, p))
        : [])
    );
  }, [] as string[]);

  const resolutions = config.repositories.reduce((resolutions, repo) => {
    if (repo.manifest.resolutions) {
      mergeWith(
        resolutions,
        repo.manifest.resolutions,
        (objValue, srcValue, key) => {
          if (objValue && srcValue && objValue !== srcValue) {
            console.warn(
              '[canarist] incompatible resolutions found: "%s" is defined as "%s" and "%s"',
              key,
              objValue,
              srcValue
            );
            return srcValue;
          }
        }
      );
    }
    return resolutions;
  }, {});

  return mergeWith(
    {
      name: 'canarist-root',
      version: '0.0.0-private',
      private: true,
      workspaces: nohoist.length
        ? { nohoist, packages: workspaces }
        : workspaces,
      resolutions,
    },
    config.rootManifest,
    (objValue, srcValue) => {
      if (Array.isArray(objValue)) {
        return objValue.concat(srcValue);
      }
      return undefined;
    }
  );
}

export function alignWorkspaceVersions(
  config: WorkspacesConfig,
  options: { unpin?: boolean } = {}
): { path: string; manifest: PackageJSON }[] {
  const packages = [
    ...config.repositories.map((repo) => {
      const manifest = JSON.parse(JSON.stringify(repo.manifest)) as PackageJSON;
      return {
        path: join(config.targetDirectory, repo.directory, 'package.json'),
        manifest: {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          version: '0.0.0-test',
          ...manifest,
        },
      };
    }),
    ...config.repositories
      .map((repo) => {
        return repo.packages.map((pkg) => {
          return {
            path: pkg.path,
            manifest: JSON.parse(JSON.stringify(pkg.manifest)) as PackageJSON,
          };
        });
      })
      .flat(),
  ];

  const directDependencyTypes = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ] as const;

  const allDependencyTypes = [
    ...directDependencyTypes,
    'peerDependencies',
  ] as const;

  const workspacePackages = packages.reduce((versions: VersionMap, pkg) => {
    versions[pkg.manifest.name] = pkg.manifest.version;
    return versions;
  }, {});

  const dependencyVersions = packages.reduce((versions: VersionMap, pkg) => {
    directDependencyTypes
      .flatMap((type) => Object.entries(pkg.manifest[type] || {}))
      .filter(([name]) => !(name in workspacePackages))
      .forEach(([name, range]) => {
        const minVersion = semver.minVersion(range)?.version ?? '0.0.0';
        versions[name] =
          versions[name] && semver.gt(versions[name], minVersion)
            ? versions[name]
            : minVersion;
      });

    return versions;
  }, {});

  if (options.unpin) {
    packages.forEach((pkg) => {
      directDependencyTypes.forEach((type) => {
        Object.keys(pkg.manifest[type] || {})
          .filter((name) => name in dependencyVersions)
          .forEach((name) => {
            const deps = pkg.manifest[type];
            if (deps) {
              deps[name] = `^${dependencyVersions[name]}`;
            }
          });
      });
    });
  }

  return packages.map((pkg) => {
    allDependencyTypes.forEach((type) => {
      const names = Object.keys(pkg.manifest[type] || {});
      names.forEach((name) => {
        const dependencies = pkg.manifest[type];
        if (dependencies && name in workspacePackages) {
          dependencies[name] = workspacePackages[name];
        }
      });
    });

    return pkg;
  });
}
