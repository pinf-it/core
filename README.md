gi0.PINF.it
===========

[![CircleCI](https://circleci.com/gh/pinf-it/core.svg?style=svg)](https://circleci.com/gh/pinf-it/core)

> Tools must be easily leveraged or they remain unused.

**PINF.it** is a JSON & NodeJS-based tooling abstraction that configures and invokes typical web software development tooling commands & services. Using a declarative JSON-based composition & instruction language, tooling may be easily and consistently applied to any project.


Usage
=====

Install for global use:

    npm install -g @pinf-it/core

(**NYI**) Run in the root directory of your NodeJS project (must be a git repository):

    pinf.it . --init auto

This will configure and invoke some basic **PINF.it** tooling depending on what is found in your project.

Any time in the future, run the following to start working on your project:

    pinf.it

For additional commands and docs run:

    pinf.it help


Design
======

Data Repository Layout
----------------------

Data is located in different locations:

  * `<WorkspaceRoot>` - The root of the git repository working directory of the project.
  * `<InvocationRoot>` - The directory declaring the tool invocation.
  * `<UserHome>` - The user home directory on the OS filesystem.

Data is anchored in the following base layout:

  * `._` - **Persistent data** for all kinds of un-coordinated implementations.
    * `/<ImplID>` - Globally unique implementation ID which **structures the contained data**.
      * `/<Category>` - Groups a specific set of data into an addressable structure.
        * `/<EntityID>` - Globally unique entity ID which **identifies the contained data**.

  * `.~` - **Disposable data** for all kinds of un-coordinated implementations.
    * `/<ImplID>` - Globally unique implementation ID which structures the contained directories and data.
      * `/<Category>` - Groups a specific set of data into an addressable structure.
        * `/<EntityID>` - Globally unique entity ID which **identifies the contained data**.

For `<ImplID>` **`gi0.PINF.it~core~v0`** this results in some common base paths:

  * `<WorkspaceRoot|InvocationRoot>._/gi0.PINF.it~core~v0/data/<EntityID>`
  * `<WorkspaceRoot|InvocationRoot>.~/gi0.PINF.it~core~v0/logs/<EntityID>`
  * `<WorkspaceRoot|InvocationRoot>.~/gi0.PINF.it~core~v0/cache/<EntityID>`
  * `<WorkspaceRoot>/._/gi0.PINF.it~core~v0/profile/<EntityID>`
  * `<UserHome>/._/gi0.PINF.it~core~v0/credentials/<EntityID>`

When a tool with `<EntityID>` **readme.com/generator/v0** runs, the following directories are provided to a tool via context objects:

  * `gi0.pinf.it/core/v0/tool/workspace` - Most generic context shared by all tools. Used to build tools that act on other tools.
```
    // cwd: /projects/gi0.PINF.it/core/tests/07-DataRepositories
    {
        id: "/projects/gi0.PINF.it/core/tests/07-DataRepositories",
        fsid: "~projects~gi0.PINF.it~core~tests~07-DataRepositories",
        hashid: "1234567890123456789012345",
        fshashid: "1234567",
        dirs: {
            data: "<WorkspaceRoot>/._/gi0.PINF.it~core~v0/data/${fshashid}",
            profile: "<WorkspaceRoot>/._/gi0.PINF.it~core~v0/profile/${fshashid}",
            credentials: "<UserHome>/._/gi0.PINF.it~core~v0/credentials/${fshashid}",
            logs: "<WorkspaceRoot>/.~/gi0.PINF.it~core~v0/logs/${fshashid}",
            cache: "<WorkspaceRoot>/.~/gi0.PINF.it~core~v0/cache/${fshashid}"
        }
    }
```

  * `gi0.pinf.it/core/v0/tool/instance` - The context provided whenever a tool is mapped to an alias in a config file. Used to persist exported entities. All exported assets and APIs should have defined schemas to allow stable external tool integration.
```
    {
        id: "readme.com/generator/v0",
        fsid: "readme.com~generator~v0",
        hashid: "1234567890123456789012345",
        fshashid: "1234567",
        dirs: {
            data: "<gi0.pinf.it/core/v0/tool/workspace:dirs.data>/tools/${fshashid}",
            profile: "<gi0.pinf.it/core/v0/tool/workspace:dirs.profile>/tools/${fshashid}",
            credentials: "<gi0.pinf.it/core/v0/tool/workspace:dirs.credentials>/tools/${fshashid}",
            logs: "<gi0.pinf.it/core/v0/tool/workspace:dirs.logs>/tools/${fshashid}",
            cache: "<gi0.pinf.it/core/v0/tool/workspace:dirs.cache>/tools/${fshashid}"
        }
    }
```

  * `gi0.pinf.it/core/v0/tool/invocation` - The context provided whenever an aliased tool is used in a mapping. Used to persist intermediate and internal entities. No external tool should access these directly as the structure can easily change and credentials may be leaked. This data is primarily used for learning and debugging purposes.
```
    {
        id: "sub:/._dist/sub/README1.md",
        fsid: "sub:~._dist~sub~README1.md",
        hashid: "1234567890123456789012345",
        fshashid: "1234567",
        dirs: {
            data: "<InvocationRoot>/._/gi0.PINF.it~core~v0/data/${fshashid}/<YY-MMM-DD>/<RunId>",
            profile: "<gi0.pinf.it/core/v0/tool/instance:dirs.profile>",
            credentials: "<gi0.pinf.it/core/v0/tool/instance:dirs.credentials>",
            logs: "<InvocationRoot>/.~/gi0.PINF.it~core~v0/logs/${fshashid}/<YYMMDD>/<RunId>",
            cache: "<InvocationRoot>/.~/gi0.PINF.it~core~v0/cache/${fshashid}/<YYMMDD>/<RunId>"
        }
    }
```


TODO
====

  * Add test for `ensure()` fed by inquirer shell input. Need to simulate shell input.
  * Add test for `write()` fed by JavaScript codeblock.
  * Add test for chained tools.

