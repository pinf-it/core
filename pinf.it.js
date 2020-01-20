#!/usr/bin/env node

// ##################################################
// # Dependencies
// ##################################################

const INF = require('@pinf-it/inf');
const LIB = INF.LIB;
LIB.MOMENT = require("moment");
LIB.UUID = require("uuid");
LIB.EXECA = require("execa");
LIB.LODASH = require("lodash");
LIB.CHOKIDAR = require("chokidar");


class Console {

    constructor (toolId, options) {
        this._logPrefix = toolId ? `[pinf.it][${toolId}]` : '[pinf.it]';
        this._options = options;
    }

    _formatMessage (args, colorizer) {
        return args.map(function (arg) {
            if (
                typeof arg === 'function' ||
                (typeof arg !== 'string' && typeof arg === 'object')
            ) {
                return colorizer(arg.toString());
            }
            return colorizer(arg);
        });
    }

    _getCallLocationPrefixIfApplicable () {
        if (!this._options.debug) return '';
        const frame = new Error().stack.split("\n")[3].match(/ \(?([^\(\)\s]+):(\d+):\d+\)?/);
        return LIB.COLORS.black(`[ ${frame[1]}:${frame[2]} ]`);
    }

    debug () {
        if (!this._options.debug) return;
        let args = Array.from(arguments);
        args = this._formatMessage(args, LIB.COLORS.white);
        args.unshift(LIB.COLORS.white(this._logPrefix) + this._getCallLocationPrefixIfApplicable());
        LIB.CONSOLE.log.apply(LIB.CONSOLE, args);
    }
    log () {
        if (this._options.silent) return;
        if (!this._options.verbose && !this._options.debug) return;
        let args = Array.from(arguments);
        args = this._formatMessage(args, LIB.COLORS.gray.bold);
        args.unshift(LIB.COLORS.gray.bold(this._logPrefix) + this._getCallLocationPrefixIfApplicable());
        LIB.CONSOLE.log.apply(LIB.CONSOLE, args);
    }
    warn () {
        if (this._options.silent) return;
        if (!this._options.verbose && !this._options.debug) return;
        let args = Array.from(arguments);
        args = this._formatMessage(args, LIB.COLORS.yellow.bold);
        args.unshift(LIB.COLORS.yellow.bold(this._logPrefix) + this._getCallLocationPrefixIfApplicable());
        LIB.CONSOLE.warn.apply(LIB.CONSOLE, args);
    }
    info () {
        if (this._options.silent) return;
        let args = Array.from(arguments);
        args = this._formatMessage(args, LIB.COLORS.blue.bold);
        args.unshift(LIB.COLORS.blue.bold(this._logPrefix) + this._getCallLocationPrefixIfApplicable());
        LIB.CONSOLE.info.apply(LIB.CONSOLE, args);
    }
    error () {
        let args = Array.from(arguments);
        args = this._formatMessage(args, LIB.COLORS.red.bold);
        args.unshift(LIB.COLORS.red.bold(this._logPrefix) + this._getCallLocationPrefixIfApplicable());
        LIB.CONSOLE.error.apply(LIB.CONSOLE, args);
    }    
}

function hash (str) {
    return INF.LIB.CRYPTO.createHash('sha1').update(str).digest('hex');
}

// ##################################################
// # Source Logic
// ##################################################

class Runner {
    constructor (options) {
        const self = this;

        options = options || {};
        options.cwd = options.cwd || process.cwd();

        LIB.console = new Console('', options);

        let dateDirname = `${LIB.MOMENT().format('YY-MMM-DD')}`;
        if (process.env.PINF_IT_TEST_VERBOSE) {
            dateDirname = 'TEST_YY-MMM-DD';
        }
        let hashId = hash(options.cwd);
        let runId = `${LIB.MOMENT().format('x')}-${hashId.substring(0, 7)}`;
        if (process.env.PINF_IT_TEST_VERBOSE) {
            runId = 'TEST_RUNID';
        }

        let workspaceFS = null;
        let workspaceEvents = null;

        function registerPathOnChangedHandler (paths, handler) {
            return workspaceFS.registerPathOnChangedHandler(paths, handler);
        }

        function getWorkspaceContext() {

            if (!workspaceFS) {
                workspaceFS = INF.LIB.workspaceFS;
                delete INF.LIB.workspaceFS;
            }
            if (!workspaceEvents) {
                workspaceEvents = INF.LIB.workspaceEvents;
                delete INF.LIB.workspaceEvents;
                if (options.watch) {
                    workspaceEvents.emit("watch");
                }
            }

            // NOTE: The first declaration has the correct source id. All other
            //       declarations are aliases which only have local meaning.
            if (!getWorkspaceContext._cache) {
                /*
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
                */
                getWorkspaceContext._cache = {
                    "#": "gi0.pinf.it/core/v0/tool/workspace",
                    "id": options.cwd,
                    "fsid": options.cwd.replace(/\//g, '~'),
                    "hashid": hashId,
                    "fshashid": hashId.substring(0, 7),
                    "dirs": {
                        "data": INF.LIB.PATH.join(options.cwd, '._', 'gi0.PINF.it~core~v0', 'data'),
                        "profile": INF.LIB.PATH.join(options.cwd, '._', 'gi0.PINF.it~core~v0', 'profile'),
                        "credentials": INF.LIB.PATH.join(process.env.HOME, '._', 'gi0.PINF.it~core~v0', 'credentials'),
                        "logs": INF.LIB.PATH.join(options.cwd, '.~', 'gi0.PINF.it~core~v0', 'logs'),
                        "cache": INF.LIB.PATH.join(options.cwd, '.~', 'gi0.PINF.it~core~v0', 'cache')
                    },
                    events: workspaceEvents,
                    fs: workspaceFS,
                    registerPathOnChangedHandler: registerPathOnChangedHandler
                };
            }
            return getWorkspaceContext._cache;
        }

        function getInstanceContext (workspaceContext, kindId, alias) {
            if (!getInstanceContext._cache) {
                getInstanceContext._cache = {};
            }
            let instanceId = `${kindId}:${alias}`;
            if (!getInstanceContext._cache[instanceId]) {
                /*
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
                */
                let hashId = hash(instanceId);
                getInstanceContext._cache[instanceId] = {
                    "#": "gi0.pinf.it/core/v0/tool/instance",
                    "kindId": kindId,
                    "id": instanceId,
                    "fsid": instanceId.replace(/\//g, '~'),
                    "hashid": hashId,
                    "fshashid": hashId.substring(0, 7),
                    "dirs": {
                        "data": INF.LIB.PATH.join(workspaceContext.dirs.data, 'tools', hashId.substring(0, 7)),
                        "profile": INF.LIB.PATH.join(workspaceContext.dirs.profile, 'tools', hashId.substring(0, 7)),
                        "credentials": INF.LIB.PATH.join(workspaceContext.dirs.credentials, 'tools', hashId.substring(0, 7)),
                        "logs": INF.LIB.PATH.join(workspaceContext.dirs.logs, 'tools', hashId.substring(0, 7)),
                        "cache": INF.LIB.PATH.join(workspaceContext.dirs.cache, 'tools', hashId.substring(0, 7))
                    }
                };
            }
            return getInstanceContext._cache[instanceId];
        }

        function makeInvocationContext (instanceContext, baseDir, targetId) {
            /*
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
            */
            let subDir = INF.LIB.PATH.relative(options.cwd, baseDir);
            let invocationId = `${subDir}:${targetId}`;
            let invocationDirname = `${dateDirname}/${runId}`;
            let hashId = hash(invocationId);
            return {
                "#": "gi0.pinf.it/core/v0/tool/invocation",
                "id": invocationId,
                "fsid": invocationId.replace(/\//g, '~'),
                "hashid": hashId,
                "fshashid": hashId.substring(0, 7),
                "dirs": {
                    "data": INF.LIB.PATH.join(baseDir, '._/gi0.PINF.it~core~v0/data', hashId.substring(0, 7), invocationDirname),
                    "profile": instanceContext.dirs.profile,
                    "credentials": instanceContext.dirs.credentials,
                    "logs": INF.LIB.PATH.join(baseDir, '._/gi0.PINF.it~core~v0/logs', hashId.substring(0, 7), invocationDirname),
                    "cache": INF.LIB.PATH.join(baseDir, '._/gi0.PINF.it~core~v0/cache', hashId.substring(0, 7), invocationDirname)
                }
            };
        }

        const initializedImplementationAdapters = {};

        let toolAlias = null;


        class ValueProvider extends INF.LIB.EventEmitter {
            constructor () {
                super();
                this._value = undefined;
            }
            setValue (value) {
                this._value = value;
                this.emit("value.changed");
            }
            getValue () {
                return this._value;
            }
            toString () {
                return `${this._value}`;
            }
        }

        class ValueChangedMonitor extends INF.LIB.EventEmitter {
            constructor (valuesToMonitor) {
                super();
                const self = this;

                valuesToMonitor.forEach(function (value) {
                    if (value instanceof ValueProvider) {
                        value.on("value.changed", function () {
                            self.emit("value.changed");
                        });
                    }
                });
            }
            async onInitialAndChanged (handler) {
                this.on("value.changed", handler);
                return handler();
            }
        }

        const invocationHelpers = {
            ValueProvider: ValueProvider,
            ValueChangedMonitor: ValueChangedMonitor
        };

        options.implementationAdapters = {
            "gi0.pinf.it/core/v0/tool": {
                /*
                    exports['gi0.pinf.it/core/v0/tool'] = async function (workspace) {
                        ASSERT.equal(workspace['#'], 'gi0.pinf.it/core/v0/tool/workspace');
                        return async function (instance) {
                            ASSERT.equal(instance['#'], 'gi0.pinf.it/core/v0/tool/instance');
                            return async function (invocation) {
                                ASSERT.equal(invocation['#'], 'gi0.pinf.it/core/v0/tool/invocation');
                                return {
                                    value: invocation.value
                                };
                            }
                        };
                    }
                */
                forInstance: async function (namespace, impl, context) {

                    const canonicalToolId = INF.LIB.PATH.join(INF.LIB.PATH.basename(namespace.baseDir), context.alias);

                    const workspaceContext = getWorkspaceContext();

                    let idAliases = null;

                    return {

                        setIdAliases: function (aliases) {
                            idAliases = aliases;
                        },

                        id: function () {
                            return {
                                canonical: canonicalToolId,
                                aliases: idAliases.filter(function (id) {
                                    return (id !== canonicalToolId);
                                })
                            };
                        },

                        // @see https://github.com/pinf-it/inf/blob/master/tests/34-Interfaces/stream.inf.js
                        interface: async function (alias, node) {

                            const instanceContext = getInstanceContext(workspaceContext, canonicalToolId, alias);

                            if (!initializedImplementationAdapters[instanceContext.id]) {
                                const lib = {};
                                Object.getOwnPropertyNames(LIB).forEach(function (name) {
                                    lib[name] = LIB[name];
                                });
                                lib.console = new Console(instanceContext.id, options);
                                initializedImplementationAdapters[instanceContext.id] = await impl(workspaceContext, lib);
                            }

                            const implWorkspace = initializedImplementationAdapters[instanceContext.id];
                            
                            const implInstance = await implWorkspace(instanceContext);

                            return async function (value) {

                                let origValue = value.value;

                                if (LIB.CODEBLOCK.isCodeblock(origValue)) {
                                    origValue = LIB.CODEBLOCK.thawFromJSON(origValue);
                                }

                                value.value = async function (invocation) {

                                    if (invocation.method === 'set') {
                                        invocation.config[instanceContext.id] = invocation.config[instanceContext.id] || {};
                                        if (
                                            typeof origValue === 'string' &&
                                            await invocation.fs.exists(origValue)
                                        ) {
                                            const val = new invocationHelpers.ValueProvider();
                                            val.setValue(origValue);
                                            invocation.fs.on(`path.changed:${origValue}`, function () {
                                                val.setValue(origValue);
                                            });
                                            invocation.config[instanceContext.id][invocation.name] = val;
                                        } else {
                                            invocation.config[instanceContext.id][invocation.name] = origValue;
                                        }
                                        return;
                                    }

                                    const context = makeInvocationContext(
                                        instanceContext,
                                        value.baseDir,
                                        (invocation.mount && invocation.mount.path) || ''
                                    );

                                    context.method = invocation.method;
                                    context.pwd = namespace.inf.options.cwd;
                                    context.cwd = value.baseDir;
                                    context.value = origValue;
                                    context.declaration = invocation.declaration;
                                    context.mount = invocation.mount;
                                    context.config = (invocation.config && invocation.config[instanceContext.id]) || {};
                                    context.mounts = invocation.mounts;

                                    if (
                                        typeof context.value === 'function' &&
                                        context.value._gi0_pinf_it_core_v0_tool_invocation_handler === true
                                    ) {
                                        context.value = (await context.value(context)).value;
                                    }

                                    return implInstance(context, invocationHelpers);
                                }
                                value.value._gi0_pinf_it_core_v0_tool_invocation_handler = true;

                                return value;
                            }
                        }
                    };
                }
            }
        }

        const libs = {};

        // TODO: Relocate into 'pinf.it.resolve.js' module for use in other packages.
        async function getLibForBaseDir (baseDir, subUri) {
            if (!libs[`${baseDir}:${subUri}`]) {
                libs[`${baseDir}:${subUri}`] = await INF.LIB.LIB_JSON.docFromFilepathsInOwnAndParent(baseDir, {
                    // No assumptions interface.
                    '#!/gi0.PINF.it/#!inf.json': '#!/gi0.PINF.it/#!',
                    // We are assuming that '#!/#!inf.json' is gi0.PINF.it compatible.
                    '#!/#!inf.json': '#!/#!',
                    // We are assuming that '#!inf.json' is gi0.PINF.it compatible.
                    '#!inf.json': '#!'
                }, {
                    subUri: subUri,
                    lookupDirs: [
                        '',
                        'node_modules'
                    ]
                });
            }
            return libs[`${baseDir}:${subUri}`];
        }

        // TODO: Relocate into 'pinf.it.resolve.js' module for use in other packages.
        async function getLibForUri (baseDir, uri) {
            const uriParts = uri.split('/');
            let queue = Promise.resolve();
            let path = null;
            [
                '#!',
                'node_modules',
                ''
            ].forEach(function (rootDir) {

                queue = queue.then(async function () {
                    if (path) return;

                    const lookupDir = INF.LIB.PATH.join(baseDir, rootDir);

                    if (!(await INF.LIB.FS.existsAsync(lookupDir))) {
                        return;
                    }

                    const lib = await getLibForBaseDir(lookupDir, uriParts.slice(1).join('/'));

                    for (let i = uriParts.length; i > 0; i--) {
                        let lookupUri = uriParts.slice(0, i).join('/') || '';
                        path = (
                            (lib['#!/gi0.PINF.it/#!'] && lib['#!/gi0.PINF.it/#!'][lookupUri]) ||
                            (lib['#!/#!'] && lib['#!/#!'][lookupUri]) ||
                            (lib['#!'] && lib['#!'][lookupUri]) ||
                            null
                        );                
                        if (path) {
                            path = INF.LIB.PATH.join(lookupDir, path);
                            break;
                        }
                    }
                });
            });
            await queue;
            return {
                path: path,
                libAlias: uriParts[0]
            };
        }

        // TODO: Relocate into 'pinf.it.resolve.js' module for use in other packages.
        async function resolveInfUri (baseDir, uri) {

            if (
                /^\//.test(uri) &&
                await INF.LIB.FS.exists(uri)
            ) {
                return INF.LIB.PATH.relative(baseDir, uri.replace(/inf\.json$/, ''));
            }

            async function resolveRelative (uri) {
                uri = uri.replace(/inf\.json$/, '');

                let path = INF.LIB.PATH.resolve(baseDir, uri);
                if (await INF.LIB.FS.existsAsync(path)) {
                    const stat = await INF.LIB.FS.statAsync(path);
                    if (stat.isDirectory()) {    
                        path = INF.LIB.PATH.join(baseDir, uri);

                        if (await INF.LIB.FS.existsAsync(INF.LIB.PATH.join(path, '#!/gi0.PINF.it/#!inf.json'))) {
                            return INF.LIB.PATH.join(uri, '/#!/gi0.PINF.it/#!');
                        }
                        if (await INF.LIB.FS.existsAsync(INF.LIB.PATH.join(path, '#!/#!inf.json'))) {
                            return INF.LIB.PATH.join(uri, '#!/#!');
                        }
                        if (await INF.LIB.FS.existsAsync(INF.LIB.PATH.join(path, '#!inf.json'))) {
                            return INF.LIB.PATH.join(uri, '#!');
                        }
                        if (await INF.LIB.FS.existsAsync(`${path}inf.json`)) {
                            return uri;
                        }
                    }
                } else {
                    path = `${path}inf.json`;
                    if (await INF.LIB.FS.existsAsync(path)) {
                        uri = `${uri}inf.json`;

                        return uri;
                    }
                }
                return null;
            }

            const resolvedCachePath = INF.LIB.PATH.join(baseDir, '.~', 'gi0.PINF.it', 'resolveInfUriCache', hash(uri));

            if (
                // We ignore the cache when running with --verbose or --debug as it is a handy way to clear the cache.
                options.verbose ||
                options.debug ||
                !(await INF.LIB.FS.exists(resolvedCachePath))
            ) {
                const lookupUri = uri;
                LIB.console.debug(`Resolving uri '${lookupUri}' from baseDir '${baseDir}'`);

                if (/^\./.test(uri)) {
                    uri = (await resolveRelative(uri)) || uri;
                } else {
                    let {
                        path,
                        libAlias
                    } = await getLibForUri(baseDir, uri);

                    if (!path) {
                        throw new Error(`Could not resolve uri '${uri}' to path!`);
                    }

                    if (await INF.LIB.FS.existsAsync(path)) {
                        uri = INF.LIB.PATH.relative(baseDir, path);
                    } else {
                        path = INF.LIB.PATH.relative(baseDir, path);
                        if (uri.indexOf('/') !== -1) {
                            path = path.substring(0, path.indexOf(libAlias));
                            path = INF.LIB.PATH.join(path, uri);
                            uri = (await resolveRelative(path)) || uri;
                        } else {
                            uri = path;
                        }
                    }
                }

                uri = uri.replace(/inf\.json$/, '');

                LIB.console.debug(`Resolved uri '${lookupUri}' from baseDir '${baseDir}' to '${uri}'`);

                await INF.LIB.FS.outputFile(resolvedCachePath, uri, 'utf8');            
            }

            return INF.LIB.FS.readFile(resolvedCachePath, 'utf8');            
        }

        options.resolveInfUri = async function (uri, namespace) {
            return resolveInfUri(namespace.baseDir, uri);
        }

        self.runDoc = async function (doc, filepath) {
            const inf = new INF.INF(options.cwd, null, options);
            return inf.runInstructions(doc, filepath);
        }

        self.runFile = async function (iniFilePath) {
            let path = await resolveInfUri(options.cwd, iniFilePath);
            if (!/\.json$/.test(path)) {
                path = `${path}inf.json`;
            }
            const inf = new INF.INF(options.cwd, null, options);
            return inf.runInstructionsFile(path);
        }

        /*
        self.identity = async function () {
            return self.runFile('#_identity_#.inf.json');
        }
        */
    }
}


// ##################################################
// # API: NodeJS
// ##################################################

module.exports = function (options) {
    return new Runner(options);
}

module.exports.LIB = INF.LIB;


// ##################################################
// # API: CLI
// ##################################################

if (require.main === module) {

    async function main (args) {

        let cwd = process.cwd();
        if ((args.v || args.verbose || args.d || args.debug) && !process.env.VERBOSE) {
            process.env.VERBOSE = "1";
        }
        if (args.cwd) {
            cwd = PATH.resolve(cwd, args.cwd);
            process.chdir(cwd);
        }

        const command = args._.shift();

        function showUsage () {
            process.stdout.write(`
Usage: pinf.it [OPTIONS] [COMMAND] [FILEPATH]

OPTIONS:

  --verbose     Enable verbose logging.
   -v
  --debug       Enable debug logging.
   -d
  --silent      Silence all logging.
   -s
  --watch       Watch for file changes and re-execute tools.
   -w
  --report      Log tool API report in JSON format when exiting.

COMMAND:

  help      Show this usage info.

FILEPATH: Path to *[[#!/]#!inf.json] file to execute.

`);
        }

        const runnerArgs = {
            cwd: cwd,
            verbose: args.verbose || args.v || false,
            debug: args.debug || args.d || false,
            silent: args.silent || args.s || false,
            watch: args.watch || args.w || false
        };

        if (!command) {
            if (args['-'] === true) {
                const stdin = [];
                process.stdin.on('data', function (data) {
                    stdin.push(data.toString());
                });
                process.stdin.on('end', async function () {
                    const runner = module.exports(runnerArgs);
                    const result = await runner.runDoc(stdin.join(''));
                    if (
                        args.report ||
                        process.env.PINF_IT_TEST_VERBOSE
                    ) {
                        process.stdout.write(JSON.stringify(result, null, 4));
                    }
                    return;
                });
                return;
            }
            console.error('[pinf.it] ERROR: No COMMAND to run specified!');
            showUsage();
            return;
        } else
        if (command === 'help') {
            showUsage();
            return;
        } else
        /*
        if (command === 'identity') {
            const runner = module.exports(runnerArgs);
            process.stdout.write(JSON.stringify(await runner.identity(), null, 4));
            return;
        } else
        */
        if (/^(\.|\/)/.test(command)) {     
            const runner = module.exports(runnerArgs);
            const result = await runner.runFile(command);
            if (
                args.report ||
                process.env.PINF_IT_TEST_VERBOSE
            ) {
                process.stdout.write(JSON.stringify(result, null, 4));
            }
            return;
        } else {
            console.error(`[pinf.it] ERROR: COMMAND '${command}' not supported!`);
            showUsage();
            return;
        }
    }
    try {
        main(INF.LIB.MINIMIST(process.argv.slice(2), {
            boolean: [
                'verbose',
                'debug',
                'silent',
                'report'
            ]
        })).catch(function (err) {
            console.error("[pinf.it] ERROR:", err.stack);
            process.exit(1);
        });
    } catch (err) {
        console.error("[pinf.it] ERROR:", err.stack);
        process.exit(1);
    }
}
