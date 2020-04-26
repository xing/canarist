import { readFileSync } from 'fs';
import { join } from 'path';
import glob from 'fast-glob';
import mergeWith from 'lodash.mergewith';
import { Config } from './config';
import { PackageJSON } from './package-json';

export interface FullConfig extends Config {
  repositories: (Config['repositories'][0] & {
    manifest: PackageJSON;
    packages: { path: string; manifest: PackageJSON }[];
  })[];
}

export function collectWorkspaces(config: Config): FullConfig {
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

export function createRootManifest(config: FullConfig): PackageJSON {
  return mergeWith(
    {
      name: 'canarist-root',
      version: '0.0.0-private',
      private: true,
      workspaces: config.repositories
        .map((repo) => [
          repo.directory,
          ...(repo.manifest.workspaces || []).map((pattern) =>
            join(repo.directory, pattern)
          ),
        ])
        .filter(Boolean)
        .flat(),
      resolutions: config.repositories.reduce((resolutions, repo) => {
        if (repo.manifest.resolutions) {
          mergeWith(resolutions, repo.manifest.resolutions);
        }
        return resolutions;
      }, {}),
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
  config: FullConfig
): { path: string; manifest: PackageJSON }[] {
  const packages = [
    ...config.repositories.map((repo) => {
      return {
        path: join(config.targetDirectory, repo.directory, 'package.json'),
        manifest: JSON.parse(JSON.stringify(repo.manifest)) as PackageJSON,
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

  const versions = packages.reduce(
    (versions: { [name: string]: string }, pkg) => {
      versions[pkg.manifest.name] = pkg.manifest.version;
      return versions;
    },
    {}
  );

  return packages.map((pkg) => {
    ([
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ] as const).forEach((type) => {
      const dependencies = Object.keys(pkg.manifest[type] || {});
      dependencies.forEach((name) => {
        if (name in versions) {
          pkg.manifest[type][name] = versions[name];
        }
      });
    });

    return pkg;
  });
}
