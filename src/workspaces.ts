import { readFileSync } from 'fs';
import { join } from 'path';
import glob from 'fast-glob';
import mergeWith from 'lodash.mergewith';
import type { Config } from './config';
import type { PackageJSON } from './package-json';

const hasKey = <K extends string>(
  key: K,
  object: unknown
): object is Record<K, unknown> => {
  return typeof object === 'object' && object !== null && key in object;
};

const getWorkspacesPackages = ({ workspaces }: PackageJSON): string[] => {
  const packages = Array.isArray(workspaces)
    ? workspaces
    : workspaces && Array.isArray(workspaces.packages)
    ? workspaces.packages
    : [];

  return packages;
};

const resolveFilePackagePath = (
  packageValue: string,
  repoDirectory: string
): string => {
  if (!packageValue.startsWith('file:')) {
    return packageValue;
  }

  const packagePath = packageValue.replace('file:', '');

  return `file:${join(repoDirectory, packagePath)}`;
};

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
    const packages = getWorkspacesPackages(manifest);

    return {
      ...repo,
      manifest,
      packages: packages
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
    const packages = getWorkspacesPackages(repository.manifest);

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
    return Object.entries(resolutions).reduce((accumulator, [k, v]) => {
      accumulator[k] = resolveFilePackagePath(v, repo.directory);
      return accumulator;
    }, {} as Record<string, string>);
  }, {} as Record<string, string>);

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
  config: WorkspacesConfig
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

  const versions = packages.reduce(
    (versions: { [name: string]: string }, pkg) => {
      versions[pkg.manifest.name] = pkg.manifest.version;
      return versions;
    },
    {}
  );

  return packages.map((pkg) => {
    (
      [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ] as const
    ).forEach((type) => {
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
