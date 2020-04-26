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
  bugs?: string | { email: string; url: string };
  repository?: string | { type: string; url: string };

  // maintainers https://classic.yarnpkg.com/en/docs/package-json/#toc-maintainers
  author?: string | { name: string; email?: string; url?: string };
  contributors?: string[] | { name: string; email?: string; url?: string }[];

  // files https://classic.yarnpkg.com/en/docs/package-json/#toc-files
  files?: string[];
  main?: string;
  bin?: string | Record<string, string>;
  man?: string | string[];
  directories?: {
    lib?: string;
    bin?: string;
    man?: string;
    doc?: string;
    example?: string;
    test?: string;
  };

  // tasks https://classic.yarnpkg.com/en/docs/package-json/#toc-tasks
  scripts?: Record<string, string>;
  config?: Record<string, unknown>;

  // dependencies https://classic.yarnpkg.com/en/docs/package-json/#toc-dependencies
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  optionalDependencies?: Record<string, string>;
  bundledDependencies?: string[];
  flat?: boolean;
  resolutions?: Record<string, string>;
  workspaces?: string[];

  // system https://classic.yarnpkg.com/en/docs/package-json/#toc-system
  engines?: {
    node?: string;
    npm?: string;
    yarn?: string;
  };
  os?: string[];
  cpu?: string[];

  // publishing https://classic.yarnpkg.com/en/docs/package-json/#toc-publishing
  private?: boolean;
  publishConfig?: {
    access?: string;
    registry?: string;
    tag?: string;
  };
}
