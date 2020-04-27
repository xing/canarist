# canarist

**TLDR**: _A bit like `npm link`, but for workspaces / monorepos :rocket:_

## Introduction

canarist is a tool that allows you to combine multiple yarn workspace monorepos into one single temporary workspace and execute commands inside each of them.

This is useful if, for example, you have a tool or library that is being developed inside a monorepo and you want to test out new changes to your library in downstream projects by executing their test suites.

At XING we have this automated with our CI, so that PRs to central repositories will be tested against a few downstream projects.

_If you want to read more into how and why this tool works, check out the [overview](./docs/overview.md) (which I had prepared for a small presentation in our company)._

## System requirements

This tool is built with modern Node.js and needs at least Node.js 10.13 or higher.

Since this is a tool for managing yarn workspaces, it is required to have `yarn` and `git` installed locally.

## Quick start

You can use canarist as a CLI tool, just install it globally or use npx to run it as a one-off command:

```shell
npx canarist -r . -r git@github.com:some/other.git
```

This command will create a temporary folder and clone the repository from your current working directory (`.`) and the some/other repository from GitHub into the temporary folder and execute `yarn test` in both repositories.

## Configuration and projects

canarist is fully configurable through `cosmiconfig` and even allows to specify multiple different combinations of repositories (called "projects") which can be run from the CLI.

You can configure canarist through one of the following places:

- a `"canarist"` key in the package.json
- a `.canaristrc{.json,.yml,.js}` file
- a `canarist.config.js` file

**Example single-mode configuration in package.json**

```json
{
  "canarist": {
    "repositories": [
      {
        "url": ".",
        "directory": "local-repo",
        "commands": [""]
      },
      {
        "url": "git@github.com:some/other.git",
        "commands": ["yarn build"]
      },
      {
        "url": "git@github.com:my/other.git",
        "directory": "my-other",
        "branch": "next"
      }
    ],
    "rootManifest": {
      "resolutions": {
        "typescript": "3.2.4"
      }
    },
    "targetDirectory": "~/work/canarist-target",
    "yarnArguments": "--production"
  }
}
```

The above configuration can be executed by typing:

```shell
npx canarist
```

into the terminal and will do the following:

- clone the local repository (`.`) into `~/work/canarist-target/local-repo`
- clone the remote repository (`git@github.com:some/other.git`) into `~/work/canarist-target/other`
- clone the remote repository (`git@github.com:my/other.git`) into `~/work/canarist-target/my-other`
- create a `package.json` in `~/work/canarist-target/` which combines all workspaces from the other repositories
- execute `yarn --production` in `~/work/canarist-target/`
- execute `yarn build` in `~/work/canarist-target/other`
- execute `yarn test` in `~/work/canarist-target/my-other`

In case you want to test multiple different combinations, you can make use of projects (see below):

**Example project-mode configuration in package.json**

```json
{
  "canarist": {
    "projects": [
      {
        "name": "canarist",
        "repositories": [
          {
            "url": "git@github.com:xing/canarist.git"
          },
          {
            "url": "git@github.com:my/canarist.git",
            "directory": "my-canarist",
            "branch": "next",
            "commands": ["yarn build", "yarn test"]
          }
        ],
        "rootManifest": {
          "resolutions": {
            "jest": "^24.0.0"
          }
        }
      },
      {
        "name": "other",
        "repositories": [
          {
            "url": "git@github.com:some/other.git",
            "branch": "next"
          },
          {
            "url": "git@github.com:my/other.git",
            "directory": "my-other"
          }
        ],
        "yarnArguments": "--ignore-scripts"
      }
    ]
  }
}
```

The above configuration specifies two projects, which can each be run by typing:

```shell
npx canarist -p canarist
```

or

```shell
npx canarist -p other
```

into the terminal.

**CLI output:**

```
$ canarist --help
Usage: canarist options [<target>]

Options:
    --repository, -r
        The URL (or local file path) to a repository to clone.
        This option accepts sub-arguments (see examples):
            --branch, -b
                The branch that should be checked out (default: master).
            --command, -c
                The command to execute in this repository (default: "yarn test").
            --directory, -d
                This option allows to change the directory name in case of conflicts.
    --root-manifest, -m
        A valid JSON string that should be merged into the generated root manifest.
    --yarn-arguments, -y
        Additional arguments that should be passed to the "yarn install" command.
    --project, -p
        The name of a project to execute in a multi-project configuration.

Examples:
    $ canarist -r git@github.com:xing/canarist.git -r git@github.com:some/other.git
        Clones xing/canarist and some/other into a temporary directory
        and executes "yarn test" in both repositories.

    $ canarist -r [git@github.com:xing/canarist.git -b next -c] -r git@github.com:some/other.git
        Clones the "next" branch of xing/canarist and the master branch of some/other
        and executes no command in xing/canarist and "yarn test" in some/other.

    $ canarist -r [git@github.com:xing/canarist.git -d canarist] -r [git@github.com:my/canarist.git -d my-canarist]
        Clones xing/canarist into canarist and my/canarist into my-canarist inside a temporary directory.

    $ canarist -r ~/work/canarist -r ~/work/other -m '{"resolutions":{"typescript":"3.2.4"},"devDependencies":{"jest":"23.0.0}}'
        Clones the master branches of both local repositories into a temporary directory
        and additionally installs yarn resolutions and a missing dev dependency.

    $ canarist -r ~/work/canarist -r ~/work/other -r ~/work/other2 -r ~/work/other3
        Clones the master branches of all four local repositories into a temporary directory
        and executes "yarn test" for each of them.

    $ canarist -r ~/work/canarist -r ~/work/other --y "--production=true"
        Clones the master branches of both repositories and installs production dependencies only

    $ canarist -p my-project
        Looks up the project configuration with the name "my-project" in the cosmiconfig
        of the current repository and clones and executes the repositories and commands therein.
        Read more: https://github.com/xing/canarist/blob/master/README.md
```

## TODOs

- [ ] allow to unpin dependencies which would otherwise be installed multiple times (for example: packages of both repositories have "webpack" as a dependency, one has it pinned to "4.40.0" and the other has a semver range "^4.30.0". If webpack@latest is at 4.40.0 we have no issues, but if webpack has a new release, say 4.41.0, we now have two versions installed).
- [ ] allow to configure which dotfiles should be copied / merged into the root (currently only ".npmrc" will be merged)
- [ ] implement a `--no-install` or `--no-commands` flag, as a simple way to "link" two repositories and debug inside them?
- [ ] encrypted urls in project config to prevent leakage of internal URLs?
