import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join, resolve } from 'path';
import minimist from 'minimist';
import { cosmiconfigSync } from 'cosmiconfig';
import gitUrlParse from 'git-url-parse';
import { PackageJSON } from './package-json';

export interface RepositoryConfig {
  url: string;
  branch: string;
  directory: string;
  commands: string[];
}

export interface Config {
  targetDirectory: string;
  rootManifest: Partial<PackageJSON>;
  yarnArguments: string;
  repositories: RepositoryConfig[];
}

interface SingleConfig extends Omit<Partial<Config>, 'repositories'> {
  repositories: (Omit<Partial<RepositoryConfig>, 'url'> &
    Pick<RepositoryConfig, 'url'>)[];
}

interface ProjectsConfig extends Omit<Partial<Config>, 'repositories'> {
  projects: (SingleConfig & { name: string })[];
}

export interface CosmiconfigResut
  extends Omit<
    ReturnType<ReturnType<typeof cosmiconfigSync>['search']>,
    'config'
  > {
  config: SingleConfig | ProjectsConfig;
}

interface RepositoryArguments extends minimist.ParsedArgs {
  branch?: string;
  command?: string | string[];
  directory?: string;
}

export interface Arguments extends minimist.ParsedArgs {
  help?: boolean;
  repository?: string | (string | RepositoryArguments)[];
  'root-manifest'?: string;
  'yarn-arguments'?: string;
  project?: string;
}

function isSingleConfig(
  config: SingleConfig | ProjectsConfig
): config is SingleConfig {
  const repositories = (config as SingleConfig).repositories;
  return typeof repositories === 'string' || Array.isArray(repositories);
}

function isProjectsConfig(
  config: SingleConfig | ProjectsConfig
): config is ProjectsConfig {
  return Array.isArray((config as ProjectsConfig).projects);
}

function tryParse(input: string): Record<string, unknown> {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function normalizeDirectoryName(url: string): string {
  const { name } = gitUrlParse(url);
  return name === '.' ? basename(resolve(name)) : name;
}

function normalizeRepository(
  input: string | RepositoryArguments | Partial<RepositoryConfig>
): RepositoryConfig {
  const defaultBranch = 'master';
  const defaultCommands = ['yarn test'];

  if (typeof input === 'string') {
    return {
      url: input,
      branch: defaultBranch,
      directory: normalizeDirectoryName(input),
      commands: defaultCommands,
    };
  }

  const url = Array.isArray((input as RepositoryArguments)._)
    ? (input as RepositoryArguments)._[0]
    : input.url;
  const branch = input.branch || defaultBranch;
  const command =
    typeof (input as RepositoryArguments).command === 'undefined'
      ? input.commands
      : (input as RepositoryArguments).command;
  const directory = normalizeDirectoryName(input.directory || url);
  const commands = Array.isArray(command)
    ? command
    : typeof command === 'string'
    ? [command]
    : defaultCommands;

  return {
    url: url,
    branch,
    directory,
    commands,
  };
}

export function normalizeConfig(
  argv: Arguments,
  config: null | CosmiconfigResut
): Config {
  if (!argv.repository) {
    if (!config) {
      throw new Error('No repositories are passed through arguments.');
    } else if (
      isSingleConfig(config.config) &&
      config.config.repositories.length === 0
    ) {
      throw new Error('No repositories are configured.');
    }
    if (argv.project) {
      if (isProjectsConfig(config.config)) {
        if (!config.config.projects.find((p) => p.name === argv.project)) {
          throw new Error(`Project "${argv.project}" does not exist.`);
        }
      } else {
        throw new Error(`Project config for "${argv.project}" does not exist.`);
      }
    } else if (isProjectsConfig(config.config)) {
      throw new Error('No project is selected.');
    }
  }

  const repositories = [];
  const project =
    argv.project && isProjectsConfig(config.config)
      ? config.config.projects.find((p) => p.name === argv.project)
      : null;
  const targetDirectory =
    argv._[0] ||
    (config &&
      ((isSingleConfig(config.config) && config.config.targetDirectory) ||
        (project && project.targetDirectory))) ||
    mkdtempSync(join(tmpdir(), 'canarist-'));
  const rootManifest: Partial<PackageJSON> =
    (argv['root-manifest'] && tryParse(argv['root-manifest'])) ||
    (config &&
      ((isSingleConfig(config.config) && config.config.rootManifest) ||
        (project && project.rootManifest))) ||
    {};
  const yarnArguments =
    argv['yarn-arguments'] ||
    (config &&
      ((isSingleConfig(config.config) && config.config.yarnArguments) ||
        (project && project.yarnArguments))) ||
    '';

  if (typeof argv.repository === 'string') {
    repositories.push(normalizeRepository(argv.repository));
  } else if (Array.isArray(argv.repository)) {
    repositories.push(...argv.repository.map(normalizeRepository));
  } else if (argv.project && isProjectsConfig(config.config)) {
    if (project) {
      repositories.push(...project.repositories.map(normalizeRepository));
    }
  } else if (isSingleConfig(config.config)) {
    repositories.push(...config.config.repositories.map(normalizeRepository));
  }

  return {
    targetDirectory,
    rootManifest,
    yarnArguments,
    repositories,
  };
}
