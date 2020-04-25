# canarist

## why do we want it?

With this tool we can make use of the test-suites of downstream projects to help us to detect potentially breaking changes in our libraries. Of course this is not 100% solid, but it will be a good starting point.

## what is this?

canarist is a tool to execute arbitrary commands (usually the test command) of downstream projects to ensure that changes in the current branch do not break projects relying on our libraries.

## how does it work?

This tool relies on yarn workspaces to work its magic. In a nutshell:

- it checks out a set of git repositories and their specified branches
- it creates a root manifest (package.json) that uses workspaces
- inside these workspaces are the combined workspaces of all checked-out git repositories plus the repositories themselves
- it then cd's into each of the subfolders and executes a specified command

### what is a package

A packge (in terms of npm) is any folder that has a `package.json` with at least the following items:

**`package.json`**

```json
{
  "name": "my-package",
  "version": "1.0.0"
}
```

This can now be published to npm (or any other compatible registry) by executing the command `npm publish` inside that folder.

### flat vs deep dependencies

Until a few years ago, npm (and other package managers) would install dependencies in a deep tree-like structure. Imagine the following package: A package that has a dependency to `dependency-a`, `dependency-b` and `dependency-c` and `dependency-a` itself has a dependency to `dependency-c` while `dependency-b` and `dependency-c` have no further dependencies. In the old world of npm your file system would now look similar to this:

```
.
├── package.json
└── node_modules
    ├── dependency-a
    │   └── node_modules
    │      └── dependency-c
    ├── dependency-b
    └── dependency-c
```

However a couple of years ago people decided it would be good to have "flat" dependency structures and therefore package managers (such as npm or yarn) try to put all dependencies of your package and the dependencies of its dependencies into one single folder. Obviously this won't work if there are two conflicting versions of the same dependency, so in that case, the package managers will still nest your dependencies, but it usually works pretty well.

### what is a monorepo / workspace

Some projects have multiple packages that belong together and therefore should be published together. While this of course is possible to do with discrete packages, it is much easier to automate this by using some sort of tool, for example lerna.

Lerna is a tool that knows the locations of all packages on your disk (by using something called a "glob") and will automatically move into each of the packages and execute `npm publish` there.

Yarn has, since some time, built-in support for defining multiple packages and managing them together (installing and upgrading dependencies, flatten dependencies), with a feature called "workspaces".

This allows you to organize all your packages in one folder and have a package.json file at the top-level that defines the glob patterns for your packages. Usually it looks similar to this:

**`package.json`**

```json
{
  "name": "my-workspace-root",
  "version": "0.0.0-none",
  "workspaces": ["packages/*"]
}
```

Which would imply a file system structure similar to this:

```
.
├── package.json
└── packages
    ├── my-package-a
    │   ├── index.js
    │   └── package.json
    └── my-package-b
        ├── index.js
        └── package.json
```

### putting it all together

So now that you know about flat dependency structures and workspaces, we can put our knowledge together and build "canarist".

First off, we start by creating a new temporary folder, for example: `/tmp/canarist-0` and then we clone two repositories into that folder, for example "untool" and "hops", so our folder now looks like this:

```
.
├── hops
│   ├── index.js
│   └── package.json
└── untool
    ├── index.js
    └── package.json
```

Now, imagine, that Hops and Untool are not workspace repositories, but instead just single packages, each sitting in their own repository.

So now we create a `package.json` file (our root manifest) that we put directly into our temporary folder and its contents are:

**`package.json`**

```json
{
  "name": "my-workspace-root",
  "version": "0.0.0-none",
  "workspaces": ["hops", "untool"]
}
```

And when we now execute `yarn install` inside our temporary folder, it will install all dependencies of both Hops and Untool in a flat structure into our temporary folder (`/tmp/canarist-0/node_modules`).

This allows us to `cd` into each of our repositories and to execute their tests, e.g. `cd /tmp/canarist-0/hops && yarn test`.

In the case that Hops and Untool are workspace repositories, we go almost the same route, but instead of only adding `"hops"` and `"untool"` to our `"workspaces"` field, we also add the workspace globs of each Hops and Untool, so our root manifest will look like this:

**`package.json`**

```json
{
  "name": "my-workspace-root",
  "version": "0.0.0-none",
  "workspaces": ["hops", "hops/packages/*", "untool", "untool/packages/*"]
}
```

_We have to add the workspace roots of each Hops and Untool too, because they define additional dependencies, for example the test framework and the linter and such._

There is one additional step, that we didn't look at yet: Before we actually install all the dependencies, we use the glob patterns in our root manifest to load all the `package.json` files of our packages and check / rewrite their "dependencies" blocks, so that they match up with the versions of our Hops and Untool packages, in order to ensure that only the workspace packages will get used (instead of downloading different versions of Hops or Untool from the internet).
