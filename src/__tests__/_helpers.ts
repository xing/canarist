import type { Config, RepositoryConfig } from '../config';
import type { WorkspacesConfig } from '../workspaces';

export function partialConfig({
  repositories = [],
  targetDirectory = '/some/directory',
  yarnArguments = '',
  rootManifest = {},
}: Partial<Config> = {}): Config {
  return {
    clean: true,
    repositories,
    targetDirectory,
    yarnArguments,
    rootManifest,
  };
}

export function partialRepositoryConfig({
  url = '',
  branch = 'master',
  directory = '',
  commands = ['yarn test'],
}: Partial<RepositoryConfig> = {}): RepositoryConfig {
  return {
    url,
    branch,
    directory,
    commands,
  };
}

export function partialWorkspacesConfig({
  repositories = [],
  targetDirectory = '/some/directory',
  yarnArguments = '',
  rootManifest = {},
}: Partial<WorkspacesConfig> = {}): WorkspacesConfig {
  return {
    clean: true,
    repositories,
    targetDirectory,
    yarnArguments,
    rootManifest,
  };
}

export function partialWorkspacesRepositoryConfig({
  url = '',
  branch = 'master',
  directory = '',
  commands = ['yarn test'],
  packages = [],
  manifest = { name: 'unnamed', version: '0.0.0' },
}: Partial<
  WorkspacesConfig['repositories'][0]
> = {}): WorkspacesConfig['repositories'][0] {
  return {
    url,
    branch,
    directory,
    commands,
    packages,
    manifest,
  };
}
