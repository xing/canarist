interface Author {
  name: string;
  email?: string;
  url?: string;
}

interface BinMap {
  [commandName: string]: string;
}

interface Bugs {
  email: string;
  url: string;
}

interface DependencyMap {
  [dependencyName: string]: string;
}

interface Directories {
  lib?: string;
  bin?: string;
  man?: string;
  doc?: string;
  example?: string;
  test?: string;
}

interface Engines {
  node?: string;
  npm?: string;
  yarn?: string;
}

interface PublishConfig {
  access?: string;
  registry?: string;
  tag?: string;
}

interface Repository {
  type: string;
  url: string;
}

interface ScriptsMap {
  [scriptName: string]: string;
}

export interface PackageJSON extends Record<string, unknown> {
  // essentials https://classic.yarnpkg.com/en/docs/package-json/#toc-essentials
  name: string;
  version: string;

  // info https://classic.yarnpkg.com/en/docs/package-json/#toc-info
  description?: string;
  keywords?: string[];
  license?: string;

  // links https://classic.yarnpkg.com/en/docs/package-json/#toc-links
  homepage?: string;
  bugs?: string | Bugs;
  repository?: string | Repository;

  // maintainers https://classic.yarnpkg.com/en/docs/package-json/#toc-maintainers
  author?: string | Author;
  contributors?: string[] | Author[];

  // files https://classic.yarnpkg.com/en/docs/package-json/#toc-files
  files?: string[];
  main?: string;
  bin?: string | BinMap;
  man?: string | string[];
  directories?: Directories;

  // tasks https://classic.yarnpkg.com/en/docs/package-json/#toc-tasks
  scripts?: ScriptsMap;
  config?: Record<string, unknown>;

  // dependencies https://classic.yarnpkg.com/en/docs/package-json/#toc-dependencies
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  peerDependenciesMeta?: { [dependencyName: string]: { optional?: boolean } };
  optionalDependencies?: DependencyMap;
  bundledDependencies?: string[];
  flat?: boolean;
  resolutions?: DependencyMap;
  workspaces?: string[];

  // system https://classic.yarnpkg.com/en/docs/package-json/#toc-system
  engines?: Engines;
  os?: string[];
  cpu?: string[];

  // publishing https://classic.yarnpkg.com/en/docs/package-json/#toc-publishing
  private?: boolean;
  publishConfig?: PublishConfig;
}
