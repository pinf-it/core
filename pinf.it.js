#!/usr/bin/env node




// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// TODO: Get rid of this file and turn everything into plugins for `inf`.
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!




// ##################################################
// # Dependencies
// ##################################################

const INF = require('@pinf-it/inf');
const LIB = INF.LIB;
// TODO: Only set these if not already set.
LIB.MOMENT = require("moment");
LIB.UUID = require("uuid");
LIB.EXECA = require("execa");
LIB.LODASH = require("lodash");
LIB.CHOKIDAR = require("chokidar");
LIB.FOLDER_HASH = require("folder-hash");
LIB.MIME_TYPES = require("mime-types");
LIB.TRAVERSE = require("traverse");
LIB.INQUIRER = require("inquirer");


let cliRunnerArgs = null;

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
                return colorizer(require("util").inspect(arg, {
                    colors: true,
                    compact: false
                }));
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

let resolveInfUriQueue = INF.LIB.Promise.resolve();


class Runner {
    constructor (options) {
        const self = this;

        options = options || {};
        options.cwd = options.cwd || process.cwd();

        const inf = new INF.INF(options.cwd, null, options);

        LIB.FS = INF.LIB.FS;
        LIB.FS_EXTRA = INF.LIB.FS;

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
        let workspaceEvents = LIB.workspaceEvents = new LIB.EventEmitter();

        function registerPathOnChangedHandler (paths, handler) {
            return workspaceFS.registerPathOnChangedHandler(paths, handler);
        }

        let trackedPromises = [];

        function trackPromise (promise) {
            trackedPromises.push(promise);
            return promise;
        }

        function waitForTrackedPromises () {
            return new Promise(async function (resolve) {
                const trackedPromisesSet = trackedPromises;
                trackedPromises = [];
                if (trackedPromisesSet.length) {
                    await Promise.all(trackedPromisesSet);
                    await waitForTrackedPromises();
                }
                resolve();
            });
        }

        function getWorkspaceContext() {

            if (!workspaceFS) {
                workspaceFS = INF.LIB.workspaceFS;
                delete INF.LIB.workspaceFS;
            }
            if (options.watch) {
                workspaceEvents.emit("watch");
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
                    registerPathOnChangedHandler: registerPathOnChangedHandler,
                    trackPromise: trackPromise
                };
            }
            return getWorkspaceContext._cache;
        }

        function getInstanceContext (workspaceContext, kindId, alias, instanceMountPrefix) {
            if (!getInstanceContext._cache) {
                getInstanceContext._cache = {};
            }
            let instanceId = `${kindId}:${alias}:${instanceMountPrefix}`;
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
                    "logs": INF.LIB.PATH.join(baseDir, '.~/gi0.PINF.it~core~v0/logs', hashId.substring(0, 7), invocationDirname),
                    "cache": INF.LIB.PATH.join(baseDir, '.~/gi0.PINF.it~core~v0/cache', hashId.substring(0, 7), invocationDirname)
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
            async setValue (value) {
                const self = this;
                if (
                    value &&
                    typeof value === 'object' &&
                    typeof value._readableState === 'object' &&
                    typeof value.on === 'function'
                ) {
                    await trackPromise(new Promise(function (resolve) {
                        let buffer = null;
                        value.on('data', function (chunk) {
                            if (buffer) {
                                buffer = buffer.concat(chunk);
                            } else {
                                buffer = chunk;
                            }
                        });
                        value.on('end', function () {
                            self._value = buffer;
                            resolve();
                            self.emit("value.changed");
                        });
                    }));
                } else {
                    self._value = value;
                    self.emit("value.changed");
                }
                return self._value;
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

        class Step {

            constructor (instance, invocation, executionHandler, watchPaths) {
                const self = this;
                
                const CONSOLE = new Console(instance.id, options);

                const watchPathsObj = {};
                if (watchPaths) {
                    watchPaths.forEach(function (path) {
                        watchPathsObj[path] = true;
                    });
                }

                const valueProvider = new ValueProvider();

                const cacheBasePath = LIB.PATH.join(instance.dirs.cache, invocation.fshashid);
                const inputCachePath = LIB.PATH.join(cacheBasePath, 'input');
                const outputCachePath = LIB.PATH.join(cacheBasePath, 'output');
                const metaCachePath = LIB.PATH.join(cacheBasePath, 'meta');

                let lastInput = null;
                let lastOutput = null;
                let lastMeta = null;

                async function getWatchedHashes () {
                    const watchedPathsMtimes = {};
                    await Promise.all(Object.keys(watchPathsObj).map(async function (path) {

                        try {
                            let hashes = await INF.LIB.FOLDER_HASH.hashElement(LIB.PATH.join(invocation.pwd, path), {
                                encoding: 'hex',
                                folders: {
                                    ignoreRootName: false
                                },
                                files: {
                                    exclude: [
                                        '.DS_Store',
                                        '.~*'
                                    ],
                                    matchBasename: true,
                                    matchPath: false,
                                    ignoreRootName: false
                                }
                            });
    //console.error(path, "hashes:", hashes.hash);

    //                        const content = await LIB.FS.readFile(LIB.PATH.join(invocation.pwd, path));
                            watchedPathsMtimes[path] = hashes.hash;
                        } catch (err) {
                            // If any error occurs we assume that file does not exist.
                            watchedPathsMtimes[path] = false;
                        }
                    }));
                    return watchedPathsMtimes;
                }

                async function onFileChanged () {
                    const watchedPathsHashes = JSON.stringify(await getWatchedHashes());
                    if (
                        lastInput &&
                        lastMeta.obj.watchedPathsHashes !== watchedPathsHashes
                    ) {
                        const isBuffer = Buffer.isBuffer(lastInput);

                        if (isBuffer) {
                            await trackPromise(onValue(lastInput, true));
                        } else {
                            await trackPromise(onValue(lastInput.obj, true));
                        }
                    }
                }

                async function onMeta (lastMeta, skipUpdate) {
                    if (
                        lastMeta &&
                        (
                            lastMeta.obj.inputPaths ||
                            lastMeta.obj.outputPaths
                        )
                    ) {
// console.log("lastMeta.obj", lastMeta.obj);

                        if (lastMeta.obj.inputPaths) lastMeta.obj.inputPaths.forEach(function (path) {
                            watchPathsObj[LIB.PATH.relative(invocation.pwd, path)] = true;
                        });
                        if (lastMeta.obj.outputPaths) lastMeta.obj.outputPaths.forEach(function (path) {
                            watchPathsObj[LIB.PATH.relative(invocation.pwd, path)] = true;
                        });

                        if (!skipUpdate) {
                            lastMeta.obj.watchedPathsHashes = JSON.stringify(await getWatchedHashes());
                            lastMeta.str = JSON.stringify(lastMeta.obj);
                        }

                        workspaceFS.registerPathOnChangedHandler(Object.keys(watchPathsObj).map(function (path) {
                            return LIB.PATH.join(invocation.pwd, path);
                        }), onFileChanged);
                    }
                }

                async function onValue (value, forceRerun) {

                    const isBuffer = Buffer.isBuffer(value);

                    if (!lastInput && await LIB.FS_EXTRA.exists(inputCachePath)) {
                        lastInput = await LIB.FS_EXTRA.readFile(inputCachePath);
                        if (!isBuffer) {
                            try {
                                lastInput = {
                                    str: lastInput,
                                    obj: JSON.parse(lastInput)
                                };
                            } catch (err) {
                                console.error(`Warning: No valid cache available. Error parsing cache file '${inputCachePath}' as JSON.`);
                                lastInput = null;
                            }
                        }
                    }
                    if (!lastOutput && await LIB.FS_EXTRA.exists(outputCachePath)) {
                        lastOutput = await LIB.FS_EXTRA.readFile(outputCachePath);
                    }
                    if (!lastMeta && await LIB.FS_EXTRA.exists(metaCachePath)) {
                        lastMeta = await LIB.FS_EXTRA.readFile(metaCachePath);
                        lastMeta = {
                            str: lastMeta,
                            obj: JSON.parse(lastMeta)
                        };
                        onMeta(lastMeta, true);
                    }

                    let hasChanged = forceRerun || !(
                        lastInput &&
                        (
                            (isBuffer && value.equals(lastInput)) ||
                            (!isBuffer && JSON.stringify(value) == lastInput.str)
                        )                        
                    );
                    
// console.log("lastMeta", lastMeta);

                    if (lastMeta) {
                        const currentHashedPaths = JSON.stringify(await getWatchedHashes());

// console.log("currentHashedPaths      new:", currentHashedPaths);
// console.log("currentHashedPaths existing:", lastMeta.obj.watchedPathsHashes);

                        if (currentHashedPaths !== lastMeta.obj.watchedPathsHashes) {
                            hasChanged = true;
                        }
                    }

// console.log("hasChanged", hasChanged);

                    // TODO: Optionally cache multiple input/output combos in case file goes to and from new and old state often.
                    if (
                        lastOutput &&
                        !hasChanged
                    ) {
                        return valueProvider.setValue(lastOutput);
                    }

                    CONSOLE.info(`Run tool step for:`, invocation.id);

                    let result = null;
                    try {

                        result = await executionHandler(value, hasChanged);

                        if (isBuffer) {
                            lastInput = value;
                        } else {
                            lastInput = {
                                str: JSON.stringify(value),
                                obj: value
                            };
                        }
    
                        lastOutput = result;

                        if (lastOutput === null) {
                            throw new Error(`Tool output is 'null'!`);
                        }
                        if (lastOutput === undefined) {
                            throw new Error(`Tool output is 'undefined'!`);
                        }

                        if (
                            lastOutput &&
                            typeof lastOutput === 'object' &&
                            typeof lastOutput.meta === 'object' &&
                            (
                                Array.isArray(lastOutput.meta.inputPaths) ||
                                Array.isArray(lastOutput.meta.outputPaths)
                            )
                        ) {
                            lastOutput.meta.watchedPathsHashes = (lastMeta && lastMeta.obj.watchedPathsHashes) || '{}';
                            lastMeta = {
                                obj: lastOutput.meta,
                                str: JSON.stringify(lastOutput.meta)
                            };
                            lastOutput = lastOutput.body || null;
                            onMeta(lastMeta);
                        } else
                        if (
                            lastOutput &&
                            typeof lastOutput === 'object' &&
                            typeof lastOutput.body !== 'undefined'
                        ) {
                            lastMeta = {
                                obj: {},
                                str: JSON.stringify({})
                            };
                            lastOutput = lastOutput.body || null;
                        }

                    } catch (err) {
                        CONSOLE.error(`ERROR: While running tool step for '${invocation.id}':`, err);
                        throw err;
                    }

                    if (hasChanged) {
                        await LIB.FS_EXTRA.outputFile(inputCachePath, lastInput.str);
                        await LIB.FS_EXTRA.outputFile(outputCachePath, lastOutput);
                        if (lastMeta) {

// console.log("record last meta:", lastMeta.str);
                            
                            await LIB.FS_EXTRA.outputFile(metaCachePath, lastMeta.str);
                        }
                    }

                    return valueProvider.setValue(lastOutput);
                }

                async function forValue (value) {
                    if (
                        value === undefined ||
                        value === null
                    ) {
                        return;
                    }
                    if (Buffer.isBuffer(value)) {
                        return onValue(value);
                    } else
                    if (value instanceof ValueProvider) {
                        return new Promise(async function (resolve) {
                            let firstVal = value.getValue();
                            value.on('value.changed', async function () {
                                const val = value.getValue();
                                if (val !== undefined) {
                                    await trackPromise(forValue(val).then(function (val) {                                    
                                        if (firstVal === undefined) {
                                            firstVal = true;
                                            resolve(val);
                                        }    
                                    }));
                                }
                            });
                            if (firstVal !== undefined) {
                                resolve(await forValue(firstVal));
                            }
                        });
                    } else
                    if (typeof value === 'string') {
                        return onValue(Buffer.from(value));
                    } else
                    if (
                        typeof value === 'object' &&
                        typeof value._readableState === 'object' &&
                        typeof value.on === 'function'
                    ) {
                        return new Promise(function (resolve) {
                            let buffer = null;
                            value.on('data', function (chunk) {
                                if (buffer) {
                                    buffer = buffer.concat(chunk);
                                } else {
                                    buffer = chunk;
                                }
                            });
                            value.on('end', function () {
                                resolve(onValue(buffer));
                            });
                        });
                    } else
                    if (typeof value === 'object') {
                        return onValue(value);
                    } else {
                        console.error('value:', value);
                        throw new Error(`Invocation value format not supported!`);
                    }
                }

                self.forValue = async function (value) {
                    return trackPromise(await forValue(value));
                }

                self.watchValues = async function (values) {

                    values.forEach(function (value) {
                        if (value instanceof ValueProvider) {
                            value.on("value.changed", function () {

console.error("[pinf.it][watchValues()] VALUE CHANGED!!", value.getValue());

                            });
                        }
                    });
                }

                self.getValueProvider = function () {
                    return valueProvider;
                }

                self.getWatchedPaths = function () {
                    return Object.keys(watchPathsObj);
                }
            }
        }

        Step.LoadInput = async function (invocation, config, configPropertyPath) {

            if (Buffer.isBuffer(config)) {
                return {
                    input: config,
                    inputPaths: [],
                    outputPaths: []
                };
            }

            const uri = LIB.LODASH.get(config, configPropertyPath);
            let sourcePath = null;
            if (/^\//.test(uri)) {
                // Absolute paths always mount on the output directory.
                sourcePath = LIB.PATH.join(invocation.dirs.dist, uri);
            } else
            if (/^\./.test(uri)) {
                // Relative paths are resolved relative to the source location.
                sourcePath = LIB.PATH.join(invocation.dirs.source, uri);
            } else {
                // Alias paths are resolved against various package system layouts.
                sourcePath = LIB.RESOLVE.sync(uri, {
                    basedir: invocation.dirs.source
                });
                if (!sourcePath) {
                    throw new Error(`Could not resolve nodejs dependency uri '${uri}' from basedir '${invocation.dirs.source}'!`);
                }
            }

            return {
                sourcePath: sourcePath,
                content: await LIB.FS.readFile(sourcePath),
                inputPaths: [
                    sourcePath
                ]
            };
        }

        const invocationHelpers = {
            ValueProvider: ValueProvider,
            ValueChangedMonitor: ValueChangedMonitor,
            Step: Step
        };

        const implementationAdapters = {
            // TODO: Put into external file.
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


//console.error("INIT::", "pinf.it", namespace.interfaceClasses, namespace);


//console.log("context.alias::", namespace.baseDir, context.alias, context.compAlias, '---', context.compNamespace.baseDir);
// TODO: Get proper alias.

//console.log("FOR INTERFACE:::", context.compNamespace);

                    if (!context.compNamespace) {
                        throw new Error(`'context.compNamespace' not set for namespace.baseDir '${namespace.baseDir}'!`);
                    }

// console.log("---");
                    let interfaceMountPrefix = null;
                    if (context.compNamespace.anchorPrefixStack) {
                        let parts = [];
                        let allPaths = (context.compNamespace.anchorPrefixStack.filter(function (segment) {

// console.log("  -", segment.toString());
                            if (/^\//.test(segment.toString())) {
                                parts.push(segment.toString());
                                return true;
                            }
                            return false;
                        }).length === context.compNamespace.anchorPrefixStack.length);
                        if (parts.length) {
                            interfaceMountPrefix = LIB.PATH.join.apply(LIB.PATH, parts);
                        }
                        // TODO: Inject tmp '' path if 'allPaths' is false?
                    }


//console.log("interfaceMountPrefix::", interfaceMountPrefix);
//console.log("anchorPrefix::", (context.compNamespace.anchorPrefix && context.compNamespace.anchorPrefix.toString()) || null);

                    const interfaceSourcePath = context.compNamespace.baseDir;


// console.log("interfaceMountPrefix", interfaceMountPrefix, context.compNamespace.baseDir);

                    const kindId = INF.LIB.PATH.join(INF.LIB.PATH.basename(context.compNamespace.baseDir), context.compAlias || context.alias);
//console.log("canonicalToolId::", canonicalToolId);

// console.log("interfaceMountPrefix", interfaceMountPrefix, 'kindId', kindId);

                    const workspaceContext = getWorkspaceContext();

                    workspaceContext.runCodeblock = context.componentInitContext.runCodeblock;


                    let idAliases = null;

                    return {

                        setIdAliases: function (aliases) {
                            idAliases = aliases;
                        },

                        id: function () {
                            return {
                                canonical: kindId,
                                aliases: idAliases.filter(function (id) {
                                    return (id !== kindId);
                                })
                            };
                        },

                        // @see https://github.com/pinf-it/inf/blob/master/tests/34-Interfaces/stream.inf.js
                        interface: async function (alias, node) {

//console.log("INTERFACE NODE:::", alias, node);
                            const instanceMountPrefix = (node.namespace.anchorPrefix && node.namespace.anchorPrefix.toString()) || null;

                            const instanceContext = getInstanceContext(workspaceContext, kindId, alias, instanceMountPrefix);

// console.log("INSATNCE CONSTEXT", instanceContext);

                            if (!initializedImplementationAdapters[instanceContext.id]) {
                                const lib = {};
                                Object.getOwnPropertyNames(LIB).forEach(function (name) {
                                    lib[name] = LIB[name];
                                });
                                lib.console = new Console(instanceContext.id, options);
                                initializedImplementationAdapters[instanceContext.id] = await impl(workspaceContext, lib);
                            }

                            const implWorkspace = initializedImplementationAdapters[instanceContext.id];

// console.log("implWorkspace:::", implWorkspace);                            

                            const implInstance = await implWorkspace(instanceContext);

                            return async function (value, pointer, invocationContext) {

// if (invocationContext.namespace.anchorPrefixStack) {                                
// console.log('invocationContext.namespace.anchorPrefixStack', invocationContext.namespace.anchorPrefixStack);
// }

                                if (pointer === "prependInputPaths()") {
                                    return value;
                                }

                                let invocationMountPrefix = null;
                                if (invocationContext.namespace.anchorPrefixStack) {
                                    let parts = [];
                                    let allPaths = (invocationContext.namespace.anchorPrefixStack.filter(function (segment) {

                        // console.log("  -", segment.toString());
                                        if (/^\//.test(segment.toString())) {
                                            parts.push(segment.toString());
                                            return true;
                                        }
                                        return false;
                                    }).length === invocationContext.namespace.anchorPrefixStack.length);
                                    if (parts.length) {
                                        invocationMountPrefix = LIB.PATH.join.apply(LIB.PATH, parts);
                                    }
                                    // TODO: Inject tmp '' path if 'allPaths' is false?
                                }
//                                const invocationMountPrefix = (invocationContext.namespace.anchorPrefix && invocationContext.namespace.anchorPrefix.toString()) || null;


                                let origValue = value.value;

                                if (LIB.CODEBLOCK.isCodeblock(origValue)) {
                                    origValue = LIB.CODEBLOCK.thawFromJSON(origValue);
                                }

                                value.value = async function (invocation) {

//console.error("[pinf.it] invocation", invocation, new Error().stack)                                    

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

//console.error("invocation.mount", invocationMountPrefix, invocation.mount, "alias", alias)

                                    if (
                                        invocationMountPrefix && /^\//.test(invocationMountPrefix) &&
                                        invocation.mount
                                    ) {
                                        // throw new Error(`The alias of the interface config '${invocationMountPrefix}' must be a path beginning with '/' if 'mount() /' is used!`);

//console.error('instanceMountPrefix::', instanceMountPrefix);

                                        // if (invocation.mount) {
                                            // invocation.mount.prefix = invocationMountPrefix;
                                            // invocation.mount.path = LIB.PATH.join(invocationMountPrefix, invocation.mount.path);
    //console.log("invocation.mount.path:::", invocation.mount.path);

                                            // invocation.mount = {
                                            //     path: alias
                                            // };
                                        // } else {
                                            // invocation.mount = {
                                            //     prefix: instanceMountPrefix,
                                            //     path: LIB.PATH.join(instanceMountPrefix, invocation.mount.path)
                                            // };
                                        // }
                                    } else
                                    if (
                                        interfaceMountPrefix && /^\//.test(interfaceMountPrefix) &&
                                        !invocation.mount
                                    ) {
                                        // invocation.mount = {
                                        //     prefix: interfaceMountPrefix,
                                        //     path: interfaceMountPrefix
                                        // };
                                    }


//console.error("invocation.mount", invocation.mount)

//console.log("value", value.baseDir);

// console.log("interfaceMountPrefix", interfaceMountPrefix);
// console.log("instanceMountPrefix", instanceMountPrefix);


                                    const context = makeInvocationContext(
                                        instanceContext,
                                        value.baseDir,
                                        (invocation.mount && invocation.mount.path) || ''
                                    );

                                    context.method = invocation.method;
                                    context.pwd = namespace.inf.options.cwd;

                                    context.dirs.tool = interfaceSourcePath;

                                    // TODO: Fix this so we only need to check one variable.
                                    if (
                                        invocationMountPrefix &&
                                        interfaceMountPrefix
                                    ) {
                                        if (invocationMountPrefix === interfaceMountPrefix) {
                                            context.dirs.dist = INF.LIB.PATH.join(context.pwd, interfaceMountPrefix);
                                        } else
                                        if (invocationMountPrefix.length > interfaceMountPrefix.length) {
                                            context.dirs.dist = INF.LIB.PATH.join(context.pwd, invocationMountPrefix);
                                        } else {
                                            context.dirs.dist = INF.LIB.PATH.join(context.pwd, interfaceMountPrefix);
                                        }
                                    } else
                                    if (invocationMountPrefix) {
                                        context.dirs.dist = INF.LIB.PATH.join(context.pwd, invocationMountPrefix);
                                    } else
                                    if (interfaceMountPrefix) {
                                        context.dirs.dist = INF.LIB.PATH.join(context.pwd, interfaceMountPrefix);
                                    } else {
                                        context.dirs.dist = context.pwd;
                                    }

// console.log("interfaceMountPrefix::", interfaceMountPrefix);
// console.log('invocationMountPrefix::', invocationMountPrefix);
// console.log('context.dirs.dist::', context.dirs.dist);
                                    
                                    // context.dirs.dist = INF.LIB.PATH.join(context.pwd, (
                                    //     invocationMountPrefix ||
                                    //     interfaceMountPrefix ||
                                    //     // (interfaceMountPrefix && /^\//.test(interfaceMountPrefix) && interfaceMountPrefix) ||
                                    //     // invocationMountPrefix ||
                                    //     ''
                                    // ));
                                    context.dirs.source = value.baseDir;
                                    // context.cwd = value.baseDir;

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

                                    const result = await implInstance(context, invocationHelpers);

                                    if (typeof result === 'object') {
                                        result.invocationContext = context;
                                    }

                                    return result;
                                }
                                value.value._gi0_pinf_it_core_v0_tool_invocation_handler = true;

                                return value;
                            }
                        }
                    };
                }
            }
        };


        options.getImplementationAdapterForId = function (namespace, id) {

            // DEPRECATED
            if (implementationAdapters[id]) {
                return implementationAdapters[id];
            }

            const ns = id;
            if (
                // idParts &&
                namespace.interfaceClasses[ns]
            ) {
                // const ns = idParts[1];
                // const cls = idParts[2];

                return {
                    forInstance: async function (namespace, impl, context) {

                        const kindId = INF.LIB.PATH.join(INF.LIB.PATH.basename(context.compNamespace.baseDir), context.compAlias || context.alias);

                        const lib = {};
                        Object.getOwnPropertyNames(LIB).forEach(function (name) {
                            lib[name] = LIB[name];
                        });
                        lib.console = new Console(kindId, options);

                        const implementationClass = await impl(lib, namespace.interfaceClasses[ns]);

                        const implementationObject = new implementationClass();

                        if (!implementationObject['#gi0.PINF.it/core/v0']) {
                            throw new Error(`Class returned by tool must inherit from an object that declares '@gi0.PINF.it/core/v0'.`);
                        }

                        return implementationObject['#gi0.PINF.it/core/v0'].getInterfaceInstanceFor(lib, namespace, impl, context, {
                            getWorkspaceContext,
                            getInstanceContext,
                            makeInvocationContext
                        });
                    }
                };
            }
            return null;
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
                        'node_modules',
                        'node_modules/*'
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

        const resolvedCachePaths = {};

        // TODO: Relocate into 'pinf.it.resolve.js' module for use in other packages.
        async function resolveInfUri (baseDir, uri) {
            return (resolveInfUriQueue = resolveInfUriQueue.then(async function () {

// console.error("[pinf.it] START RESOLVE URI", uri);

                async function realpathBaseDir (baseDir) {
                    try {
                        return await INF.LIB.FS.realpath(baseDir);
                    } catch (err) {
                        // If the 'baseDir' does not exist we go up the dirs until we find a path that exists.
                        return realpathBaseDir(INF.LIB.PATH.dirname(baseDir));
                    }
                }

                baseDir = await realpathBaseDir(baseDir);

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
                    // TODO: Create a tool to reset cache assets that are registered under different categories.
                    // We ignore the cache when running with --verbose or --debug as it is a handy way to clear the cache.
                    // options.verbose ||
                    // options.debug ||
                    !(await INF.LIB.FS.exists(resolvedCachePath))
                ) {
                    if (resolvedCachePaths[resolvedCachePath]) {
                        return resolvedCachePaths[resolvedCachePath];
                    }

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
                            throw new Error(`Could not resolve uri '${uri}' to path using baseDir '${baseDir}'!`);
                        }

                        path = await INF.LIB.FS.realpath(path);

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

                    resolvedCachePaths[resolvedCachePath] = uri;

                    const tmpResolvedCachePath = resolvedCachePath + '~' + Date.now();

                    await INF.LIB.FS.outputFile(tmpResolvedCachePath, uri, 'utf8');
                    await new Promise(function (resolve) {
                        const subprocess = LIB.CHILD_PROCESS.spawn('bash', [], {
                            stdio: [ 'pipe', 'inherit', 'inherit' ]
                        });
                        subprocess.on('close', function (code) {
                            resolve();
                        });
                        subprocess.stdin.write(`rm -f "${resolvedCachePath}" || true && mv "${tmpResolvedCachePath}" "${resolvedCachePath}"`);
                        subprocess.stdin.end();
                    });
                }

// console.error("[pinf.it] END RESOLVE URI", uri);

                return (resolvedCachePaths[resolvedCachePath] = await INF.LIB.FS.readFile(resolvedCachePath, 'utf8'));
            }));
        }

        options.resolveInfUri = async function (uri, namespace) {
            return resolveInfUri(namespace.baseDir, uri);
        }

        self.runDoc = async function (doc, filepath) {
            const inf = new INF.INF(options.cwd, null, options);
            const result = await inf.runInstructions(doc, filepath);

            await inf.lastInstructionProcessed();

            await waitForTrackedPromises();

            return result;
        }

        self.runFile = async function (iniFilePath) {
            const result = await self._runFile(iniFilePath);

            await waitForTrackedPromises();

            return result;
        }

        self._runFile = async function (iniFilePath, opts) {
            opts = opts || {};
            let path = await resolveInfUri(options.cwd, iniFilePath);
            if (!/\.json$/.test(path)) {
                path = `${path}inf.json`;
            }

// console.log("RUN INF FILE options.cwd", options.cwd, "path", path);
// throw new Error(`Fix 'options.cwd' path. It needs to be set correctly when rep routes are called from bash.origin.express.`);

            const inf = new INF.INF(options.cwd, null, options);
            const api = await inf.runInstructionsFile(path, {
                baseDir: opts.baseDir || undefined
            });

            await inf.lastInstructionProcessed();

            return api;
        }

        // DEPRECATED
        self.runTool = async function (pointer, config) {

// console.log("[pinf-it] runTool:::", pointer, config);

            const pointerInfo = module.exports.isToolPointer(pointer);
            if (!pointerInfo) {
                throw new Error(`Pointer '${pointer}' is not a valid tool pointer!`);
            }

            const serializedConfig = JSON.stringify(config, null, 4);

            const id = hash(`${pointer}:${serializedConfig}`);

            // TODO: Use a better route convention here.
            const mountRoute = `/.~/gi0.PINF.it/core/runTool/` + `${pointerInfo.lib}~${pointerInfo.interface}~${id}`.replace(/\//g, '~');

            // TODO: Only allow one execution at a time for the same 'mountRoute'.

            // TODO: Use 'gi0.PINF.it/core' namespaced cache dir that conforms to PINF conventions.
            const filepath = LIB.PATH.join(options.cwd, `.~/gi0.PINF.it/core/runTool/${id}.inf.json`);
            
            await LIB.FS.outputFile(filepath, `{
                "#": "gi0.PINF.it/core/v0",
                "#": {
                    "tool_${id}": "${pointerInfo.lib}"
                },
                ":tool_${id}:": "tool_${id} @ ${pointerInfo.interface}",
                "gi0.PINF.it/core/v0 @ # :tool_${id}: write() ${mountRoute}": ${serializedConfig}
            }`, 'utf8');

// console.error("TOOL MOUNT PREFIX", options.cwd, options.mountPrefix);

            const API = await self._runFile(filepath, {
                baseDir: LIB.PATH.join(options.cwd, options.mountPrefix || '')
            });

            return LIB.PATH.join(options.cwd, mountRoute);
        }

        const routeApps = {};
        // DEPRECATED
        self.getRouteApp = async function (pointer, opts) {
            opts = opts || {};
            const pointerInfo = module.exports.isToolPointer(pointer);
            if (!pointerInfo) {
                throw new Error(`Pointer '${pointer}' is not a valid tool pointer!`);
            }

            const id = hash(pointer);

            // TODO: Use a better route convention here.
//            let mountRoute = `/.~/gi0.PINF.it/core/getRouteApp/` + `${pointerInfo.lib}~${pointerInfo.interface}`.replace(/\//g, '~');

// console.error('PINF.IT::', 'options.cwd', options.cwd, 'options.mountPrefix', options.mountPrefix, 'opts.mountPath', opts.mountPath);

            let mountString = LIB.PATH.join(options.mountPrefix || '/', opts.mountPath || '/').replace(/\/$/, '') || '/';

// console.error("mountString", mountString);

            // let appPrefix = mountRoute;
            // let mountString = mountRoute;
            // if (opts.mountPath) {
            //     mountString = '/';
            //     appPrefix = opts.mountPath;
            // }

            if (routeApps[mountString]) {
                // App was already previously mounted.
                return routeApps[mountString];
            }

            // TODO: Use 'gi0.PINF.it/core' namespaced cache dir that conforms to PINF conventions.
            const filepath = LIB.PATH.join(options.cwd, `.~/gi0.PINF.it/core/getRouteApp/${id}.inf.json`);
            
            await LIB.FS.outputFile(filepath, `{
                "#": "gi0.PINF.it/core/v0",
                "#": {
                    "${options.mountPrefix || '/'}": "${pointerInfo.lib}"
                },
                ":${`route_${id}`}:": "${options.mountPrefix || '/'} @ ${pointerInfo.interface}",
                "gi0.PINF.it/core/v0 @ # :${`route_${id}`}: mount() ${opts.mountPath || '/'}": ""
            }`, 'utf8');
// console.error('filepath:::', filepath);

            const API = await self._runFile(filepath, {
                baseDir: LIB.PATH.join(options.cwd, options.mountPrefix || '')
            });

//console.error("opts.mountPath", opts.mountPath);

// console.error("appPrefix", appPrefix);
//  console.error("mountString", mountString);
// console.error("API['gi0.PINF.it/core/v0'][0].api.mounts", API['gi0.PINF.it/core/v0'][0].api.mounts);
// console.error("API['gi0.PINF.it/core/v0'][0].api.mounts.getAppsForPrefix(appPrefix)", API['gi0.PINF.it/core/v0'][0].api.mounts.getAppsForPrefix(appPrefix));

            return (routeApps[mountString] = API['gi0.PINF.it/core/v0'][0].api.mounts.getAppsForPrefix(mountString)['']);
        }

        self.runToolForModel = async function (modedId, homePrefix, targetPrefix, toolPointer, toolConfig, preferredReturnInterfaces, returnInterfaceOptions) {

if (options.mountPrefix) throw new Error(`Check into 'options.mountPrefix'!`);
//            const mountPrefix = options.mountPrefix || '/';

            LIB.console.debug('runToolForModel(modedId, homePrefix, targetPrefix, toolPointer, toolConfig, preferredReturnInterfaces, returnInterfaceOptions)', modedId, homePrefix, targetPrefix, toolPointer, toolConfig, preferredReturnInterfaces, returnInterfaceOptions);

            homePrefix = homePrefix || '/';

            // NOTE: We prepend the homePrefix so that the runToolForModel() interface is nicer to use.
            targetPrefix = LIB.PATH.join(homePrefix, targetPrefix || '/').replace(/\/$/, '');


            preferredReturnInterfaces = preferredReturnInterfaces || [ 'path' ];
            if (typeof preferredReturnInterfaces === 'string') {
                preferredReturnInterfaces = [
                    preferredReturnInterfaces
                ];
            }
            if (!preferredReturnInterfaces.length) {
                preferredReturnInterfaces.push('path');
            }
            preferredReturnInterfaces = preferredReturnInterfaces.map(function (name) {
                if (!/:/.test(name)) {
                    return `onHome:${name}`;
                }
                return name;
            });
            if (
                preferredReturnInterfaces.length === 1 &&
                /^onHome:/.test(preferredReturnInterfaces[0])
            ) {
                preferredReturnInterfaces.push(`onBuild:${preferredReturnInterfaces[0].replace(/^onHome:/, '')}`);
            }
            returnInterfaceOptions = returnInterfaceOptions || {};

            const pointerInfo = module.exports.isToolPointer(toolPointer);
            if (!pointerInfo) {
                throw new Error(`Pointer '${toolPointer}' is not a valid tool pointer!`);
            }

//console.log("toolConfig::", toolConfig);
//console.log('CODEBLOCK', LIB.CODEBLOCK.freezeToSource(toolConfig));

            // Some properties get pulled of the 'toolConfig' as they should be generally supported.
            // These common properties should go into a new argument object or we need to namespace
            // the 'toolConfig'.
            const prependInputPaths = (toolConfig && toolConfig.prependInputPaths) || [];
            delete toolConfig.prependInputPaths;


// process.exit(1);
            const serializedToolConfig = LIB.CODEBLOCK.freezeToSource(toolConfig);

//            const serializedToolConfig = JSON.stringify(toolConfig, null, 4);

            const id = hash(`${modedId}:${homePrefix}:${targetPrefix}:${toolPointer}:${serializedToolConfig}`);

            const filepath = LIB.PATH.join(options.cwd, `.~/gi0.PINF.it/core/runToolForModel/${id}.inf.json`);

            prependInputPaths.push(filepath);

            const instructionDoc = `{
                "#": "gi0.PINF.it/core/v0",
                "#": {
                    "${homePrefix}": "${pointerInfo.lib}"
                },
                ":tool_${id}:": "${homePrefix} @ ${pointerInfo.interface}",
                "${modedId} @ # :tool_${id}: prependInputPaths()": ${JSON.stringify(prependInputPaths)},
                "${modedId} @ # :tool_${id}: write() ${targetPrefix}": ${serializedToolConfig}
            }`;

            await LIB.FS.outputFile(filepath, instructionDoc, 'utf8');

            try {

                const API = await self._runFile(filepath, {
                    // baseDir: LIB.PATH.join(options.cwd, options.mountPrefix || '')
                    baseDir: options.cwd
                });

                let invocationsByKindIdAndPath = API[modedId][API[modedId].length-1].api.invocationsByKindIdAndPath;

                // let toolAPI = toolAPIs[targetPath] || {};

                // LIB.console.debug(`toolAPI:`, toolAPI);

                // if (!toolAPI['path']) {
                //     toolAPI['path'] = function () {
                //         return targetPath;
                //     };
                // }

                // if (!invocationsByKindIdAndPath) {
                //     console.error("preferredReturnInterfaces:", preferredReturnInterfaces);
                //     console.error("modedId:", modedId);
                //     console.error("propertyPath:", `API[${modedId}][0].api.invocationsByKindIdAndPath`);
                //     console.error("API", JSON.stringify(API, null, 4));
                //     throw new Error(`No API exported by toolPointer '${toolPointer}'!`);
                // }

                LIB.console.debug(`modedId:`, modedId);
                LIB.console.debug(`API:`, API);
                LIB.console.debug(`API[modedId]:`, JSON.stringify(API[modedId], null, 4));
                LIB.console.debug(`invocationsByKindIdAndPath:`, invocationsByKindIdAndPath);
                LIB.console.debug(`preferredReturnInterfaces:`, preferredReturnInterfaces);

                let bestReturnInterface = null;
                preferredReturnInterfaces.forEach(function (typeId) {
                    if (bestReturnInterface) return;

                    let toolAPIs = null;
                    const typeIdParts = typeId.split(":");

                    let targetPath = null
                    if (typeIdParts[0] === 'onHome') {
                        targetPath = LIB.PATH.join(options.cwd, options.mountPrefix || '', homePrefix);
                    } else {
                        targetPath = LIB.PATH.join(options.cwd, options.mountPrefix || '', targetPrefix);
                    }

                    if (!invocationsByKindIdAndPath) {
                        bestReturnInterface = targetPath;
                    } else {

                        if (typeIdParts.length === 2) {
                            toolAPIs = invocationsByKindIdAndPath[`${pointerInfo.lib}:${pointerInfo.interface}:${typeIdParts[0]}`];
                            typeId = typeIdParts[1];
                        } else {
                            toolAPIs = invocationsByKindIdAndPath[`${pointerInfo.lib}:${pointerInfo.interface}`];
                        }

                        LIB.console.debug(`toolAPIs:`, toolAPIs);

                        if (!toolAPIs) {
                            // console.error(`typeIdParts:`, typeIdParts);
                            // console.error(`invocationKey:`, `${pointerInfo.lib}:${pointerInfo.interface}`);
                            // console.error(`invocationsByKindIdAndPath:`, invocationsByKindIdAndPath);
                            // throw new Error(`No 'toolAPIs' export!`);
                            return;
                        }

                        // The API of the tool we specifically invoked above.
                        let toolAPI = toolAPIs[targetPath];;
                        LIB.console.debug(`toolAPI:`, toolAPI);

                        if (!toolAPI) {
                            console.error(`typeIdParts:`, typeIdParts);
                            console.error("targetPath:", targetPath);
                            console.error("toolAPIs:", toolAPIs);
                            console.error("preferredReturnInterfaces:", preferredReturnInterfaces);
                            throw new Error(`No API exported by toolPointer '${toolPointer}'!`);
                        }

                        if (typeof toolAPI[typeId] !== 'undefined') {
                            bestReturnInterface = toolAPI[typeId];

                            LIB.console.debug(`Using 'toolAPI' of typeId '${typeId}'`);
                        }
                    }
                });
                if (!bestReturnInterface) {
                    console.error(`modedId:`, modedId);
                    console.error(`API:`, API);
                    console.error(`API[modedId]:`, JSON.stringify(API[modedId], null, 4));
                    console.error(`invocationsByKindIdAndPath:`, invocationsByKindIdAndPath);
                    console.error("preferredReturnInterfaces:", preferredReturnInterfaces);
                    throw new Error(`Could not determine best return interface for toolPointer '${toolPointer}'!`);
                }

                LIB.console.debug(`bestReturnInterface:`, bestReturnInterface.toString());
                LIB.console.debug(`returnInterfaceOptions:`, returnInterfaceOptions);

                let returnInterface = null;
                if (typeof bestReturnInterface === 'function') {
                    returnInterface = bestReturnInterface(returnInterfaceOptions);
                } else {
                    returnInterface = bestReturnInterface;
                }

                LIB.console.debug(`returnInterface:`, returnInterface);

                return returnInterface;
            } catch (err) {
                console.error("instructionDoc", instructionDoc);
                throw err;
            }
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

const instances = {};
module.exports = function (options) {
    options = options || {};
    options.cwd = options.cwd || process.cwd();

    const opts = Object.create(cliRunnerArgs);
    Object.keys(options).forEach(function (name) {
        opts[name] = options[name];
    });

    if (process.env.VERBOSE || process.env.PINF_IT_VERBOSE) {
        opts.verbose = true;
    } else
    if (process.env.PINF_IT_DEBUG) {
        opts.verbose = true;
        opts.debug = true;
    }

    const key = `${opts.cwd}:${opts.mountPrefix || ''}`;

//    if (!instances[key]) {
        instances[key] = new Runner(opts);
//    }
    return instances[key];
}

module.exports.LIB = INF.LIB;

module.exports.isToolPointer = function (pointer) {
    if (typeof pointer !== 'string') {
        return null;
    }
    const pointerMatch = pointer.match(/^([^#\s]+)\s*#\s*([^#\s]+)$/);
    if (!pointerMatch) {
        return null;
    }
    return {
        lib: pointerMatch[1],
        interface: pointerMatch[2]
    };
}

if (!LIB['@pinf-it/core']) LIB['@pinf-it/core'] = module.exports;



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
            watch: args.watch || args.w || false,
            rebuild: args.rebuild || false
        };

        cliRunnerArgs = runnerArgs;

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
                'report',
                'rebuild'
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
