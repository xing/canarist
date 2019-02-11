# canarist

## Introduction

canarist is a tool that helps you to combine multiple yarn workspace
mono-repositories into one single temporary workspace and execute the "test"
command in each of them.

This is useful if, for example you have a tool or library that is being developed
inside a mono-repository and you want to test out new changes to your library in
downstream projects by executing their test suites.

## System requirements

This tool is built with modern Node.js and needs at least Node.js 8.10 or higher.

Since this is a tool for managing yarn workspaces, it is required to have yarn and git installed locally.

## Quick start

You can use canarist as a CLI tool, just install it globally or use npx to run it as a one-off command:

```shell
npx canarist -r . -r [git@github.com:some/other.git]
```

This command will create a temporary folder and clone the repository from your current working directory and the some/other repository from GitHub into the temporary folder and execute "yarn test" in both repositories.

## Configuration

canarist uses cosmiconfig and can be configured via CLI arguments or any of the following methods:
- a `"canarist"` key in the package.json
- a `.canaristrc{.json,.yml,.js}` file
- a `canarist.config.js` file

**Example configuration in package.json**

```json
{
  "canarist": {
    "repositories": [
      {
        "repository": ".",
        "commands": [""]
      },
      {
        "repository": "git@github.com:some/other.git",
        "commands": [
          "yarn build -p",
          "yarn test"
        ]
      },
      {
        "repository": "git@github.com:my/other.git",
        "directory": "my-other",
        "branch": "next"
      },
    ],
    "rootManifest": {
      "resolutions": {
        "typescript": "3.2.4"
      }
    }
  }
}
```

**CLI output:**

```
$ canarist --help
Usage: canarist options [<target>] 

Options: 
        --repository, -r 
            The URL (or local file path) to a repository to clone. 
            This option accepts sub-arguments (see examples): 
                --branch, -b 
                --command, -c 
                --directory, -d 
        --root-manifest, -m 
            A valid JSON string that should be merged into the 
            generated root manifest. 

Examples: 
        $ canarist -r git@github.com:xing/hops.git -r [git@github.com:some/other.git -c 'yarn build -p' -c 'yarn test'] 
            Clones xing/hops and some/other into a temporary directory 
            and executes "yarn test" in xing/hops and "yarn build -p" and "yarn test" in some/other 

        $ canarist -r [git@github.com:xing/hops.git -c] -r git@github.com:some/other.git 
            Clones xing/hops and some/other into a temporary directory. 
            and executes no command in xing/hops and "yarn test" in some/other. 

        $ canarist -r [git@github.com:xing/hops.git -b next] -r git@github.com:some/other.git ~/work/integration-tests 
            Clones the "next" branch of xing/hops and the master branch of some/other 
            into the target directory and executes "yarn test" in both. 

        $ canarist -r [git@github.com:xing/hops.git -d xing-hops] -r [git@github.com:my/hops.git -d my-hops] 
            Clones xing/hops into xing-hops and my/hops into my-hops inside a temporary directory. 

        $ canarist -r ~/work/hops -r ~/work/other -m '{"resolutions":{"typescript":"3.2.4"},"devDependencies":{"jest":"23.0.0}}' 
            Clones the master branches of both local repositories into a temporary directory 
            and additionally installs yarn resolutions and a missing dev dependency. 

        $ canarist -r ~/work/hops -r ~/work/other -r ~/work/other2 -r ~/work/other3 
            Clones the master branches of all three local repositories into a temporary directory 
            and executes "yarn test" for each of them.
```