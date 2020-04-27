import { readFileSync } from 'fs';
import { join } from 'path';
import glob from 'fast-glob';
import mergeWith from 'lodash.mergewith';
import type { Config } from './config';
import type { PackageJSON } from './package-json';

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
          mergeWith(
            resolutions,
            repo.manifest.resolutions,
            (objValue, srcValue, key) => {
              if (objValue && srcValue) {
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
  config: WorkspacesConfig
): { path: string; manifest: PackageJSON }[] {
  const packages = [
    ...config.repositories.map((repo) => {
      const manifest = JSON.parse(JSON.stringify(repo.manifest)) as PackageJSON;
      return {
        path: join(config.targetDirectory, repo.directory, 'package.json'),
        manifest: {
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
      const names = Object.keys(pkg.manifest[type] || {});
      names.forEach((name) => {
        const dependencies = pkg.manifest[type];
        if (dependencies && name in versions) {
          dependencies[name] = versions[name];
        }
      });
    });

    return pkg;
  });
}
