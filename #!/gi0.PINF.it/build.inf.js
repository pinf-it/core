

console.error("INIT RUNNER!");


let firstTurnDone = null;
let pendingBuilds = 0;


exports.inf = async function (INF, NS) {

    if (!firstTurnDone) {
        firstTurnDone = INF.LIB.Promise.defer();
    }

    const workspaceEvents = INF.LIB.workspaceEvents;
    let trackPromise = null;

    class FS extends INF.LIB.EventEmitter {

        constructor (baseDir) {
            super();
            const self = this;

            self._baseDir = baseDir;

            self.setMaxListeners(100);

            self._watchHandlers = {};
            self._watcher = INF.LIB.CHOKIDAR.watch([], {
                persistent: true
            });
            self.watchingPaths = {};

            let changedPaths = {};
            let lastModifiedSizes = {};
            let changedHandlerInvocationQueue = INF.LIB.Promise.resolve();
            const notifyPathChanged = INF.LIB.LODASH.debounce(function () {
                if (!self._watching) return;

// console.log("aaaaa1")                

                trackPromise(                    
                    (changedHandlerInvocationQueue = changedHandlerInvocationQueue.then(async function () {
// console.log("aaaaa3")                

                        if (!self._watching) return;

                        let changedPathsSet = changedPaths;
                        changedPaths = {};
                        const changedPathsStack = [];
// console.log("changedPathsSet", changedPathsSet);

                        await Promise.all(Object.keys(changedPathsSet).map(async function (path) {
                            if (
                                changedPathsSet[path].type === 'file' &&
                                changedPathsSet[path].event === 'modified' &&
                                await INF.LIB.FS.exists(path)
                            ) {
                                const size = (await INF.LIB.FS.stat(path)).size;
                                let hash = null;
                                // For all files we compare by size first
                                if (
                                    !lastModifiedSizes[path] ||
                                    size !== lastModifiedSizes[path].size
                                ) {
                                    changedPathsStack.push(path);
                                } else
                                // For files < 250kb we compare by checksum
                                if (size < 250 * 1000) {
                                    hash = await hashForPath(path);
                                    if (
                                        !lastModifiedSizes[path] ||
                                        hash !== lastModifiedSizes[path].hash
                                    ) {
                                        changedPathsStack.push(path);
                                    }
                                }
                                lastModifiedSizes[path] = {
                                    size: size,
                                    hash: hash
                                };
                            } else {
                                changedPathsStack.push(path);
                            }
                        }));
                        changedPathsSet = null;
// console.log("changedPathsStack", changedPathsStack);
                        changedPathsStack.sort(function(a, b) {
                            return b.length - a.length;
                        });

                        if (!self._watching) return;

                        if (!changedPathsStack.length) return;

                        INF.LIB.console.info(`Changed paths:`, changedPathsStack);

        // console.log("HANDLERS BY PATH:", Object.keys(self._watchHandlers));

                        // We fire exact matches first and then increasingly wider scoped
                        // handlers with the intent that the modified file gets re-built
                        // and then parent handlers will potentially invoke specific build again
                        // where the specific handler will just scan and exit as it has already run.
                        // We also ensure that each handler is only invoked once.
                        const matchingHandlers = [];

                        changedPathsStack.forEach(function (path) {
                            if (self._watchHandlers[path]) {
                                self._watchHandlers[path].forEach(function (handler) {
                                    if (matchingHandlers.indexOf(handler) === -1) {
                                        matchingHandlers.push(handler);
                                    }
                                });
                            }
                            Object.keys(self._watchHandlers).filter(function (handlerPath) {
                                if (path.indexOf(handlerPath) === 0) {
                                    self._watchHandlers[handlerPath].forEach(function (handler) {
                                        if (matchingHandlers.indexOf(handler) === -1) {
                                            matchingHandlers.push(handler);
                                        }
                                    });
                                }
                            });
                        });

        // console.log("matchingHandlers", matchingHandlers);

                        await INF.LIB.Promise.mapSeries(matchingHandlers, function (handler) {
                            if (!self._watching) return;
                            try {
                                return handler();
                            } catch (err) {
                                INF.LIB.console.error(`Error while calling change handler for path '${path}':`, err);
                            }
                        });
                    }))
                );

            }, 100);
            self._watcher.on('raw', function (event, path, details) {
                if (!self._watching) return;
                if (details.type !== 'file') return;
                changedPaths[path] = details;
//console.log("CHANGED", path)                
                notifyPathChanged();
            });
            self._watching = false;
            workspaceEvents.on("watch", function () {
                self._watching = true;
                self._watchPaths();
            });
            workspaceEvents.on("unwatch", function () {
                self._watching = false;
                self._unwatchPaths();
            });
        }

        async exists (path) {
            return INF.LIB.FS.exists(INF.LIB.PATH.resolve(this._baseDir, path));
        }

        async registerPathOnChangedHandler (paths, handler) {
            const self = this;
            if (!Array.isArray(paths)) {
                paths = [ paths ];
            }
            paths.forEach(function (path) {
                path = INF.LIB.PATH.resolve(self._baseDir, path);
                if (!self._watchHandlers[path]) {
                    self._watchHandlers[path] = self._watchHandlers[path] || [];
                    if (self._watching) {
                        self._watchPath(path);
                    }
                }
                const exists = self._watchHandlers[path].filter(function (existingHandler) {
                    return (
                        (existingHandler._ID && (existingHandler._ID === handler._ID))
                        ||
                        existingHandler === handler
                    );
                });
                if (exists.length) {
                    return;
                }
                self._watchHandlers[path].push(handler);
            });
        }
        _watchPaths () {
            const self = this;
            Object.keys(self._watchHandlers).forEach(function (path) {
                self._watchPath(path);
            });
        }
        _watchPath (path) {
            if (this.watchingPaths[path] !== true) {
                INF.LIB.console.debug(`Watch path: ${path}`);
                this._watcher.add(path);
                this.watchingPaths[path] = true;
            }
        }
        _unwatchPaths () {
            const self = this;
            Object.keys(self._watchHandlers).forEach(function (path) {
                self._unwatchPath(path);
            });
        }
        _unwatchPath (path) {
            if (this.watchingPaths[path] !== false) {
                INF.LIB.console.debug(`Unwatch path: ${path}`);
                this._watcher.unwatch(path);
                this.watchingPaths[path] = false;
            }
        }
    }

    class BuildWorkspace {
        constructor () {
            const self = this;

            // Path to the root of the workspace.
            // Based on the path used to invoke 'pinf.it'.
            // Not necessarily the $PWD.
            self.path = null;

            // The current working directory of the user.
            // This is the $PWD or process.cwd().
            self.cwd = null;
        }

        toString () {
            return `BuildWorkspace(path:./${INF.LIB.PATH.relative(process.cwd(), this.path)})`;
        }
    }
    class BuildTarget {
        constructor (cloneFromInstance) {
            const self = this;

            // Path to where the build output should go.
            self.path = (cloneFromInstance && cloneFromInstance.path) || null;
        }

        toString () {
            return `BuildTarget(path:./${INF.LIB.PATH.relative(process.cwd(), this.path)})`;
        }
    }    
    // Used to track a component's use of build services and the target path used by component.
    class BuildStepInstance extends BuildTarget {
        constructor (cloneFromInstance) {
            super(cloneFromInstance);
            const self = this;

            // An ID that represents the BuildStep within the workspace including a component URI & protocol URI
            self.kindId = (cloneFromInstance && cloneFromInstance.kindId) || null;

            // The local API uri that determines available methods and signatures for build calls.
            // This is the API uri that the caller chose as the interface for interacting with this BuildStep.
            self.api = (cloneFromInstance && cloneFromInstance.api) || null;

            // The target path to where the build entity is pointed.
            self.path = (cloneFromInstance && cloneFromInstance.path) || null;

            // All paths that change the result of the builds of this instance.
            // Specifically that subset of paths that relates to the
            // builds that will be invoked.
            self.inputPaths = {};
        }

        toString () {
            return `BuildStepInstance(path:./${INF.LIB.PATH.relative(process.cwd(), this.path)})`;
        }
    }
    class BuildHome extends BuildStepInstance {

        constructor (buildStepInstance) {
            super(buildStepInstance);
            const self = this;

            // Path to where common build assets should go.
            self.path = self.path || null;
        }

        toString () {
            return `BuildHome(path:./${INF.LIB.PATH.relative(process.cwd(), this.path)})`;
        }
    }
    class Build {
        constructor () {
            const self = this;

            // Path to where the build is defined.
            self.path = null;

            // The build method that was invoked.
            self.method = null;

            // Build configuration.
            self.config = null;
        }

        toString () {
            return `Build(method:${this.method})`;
        }
    }


    async function hashForPath (path) {
       return (await INF.LIB.FOLDER_HASH.hashElement(path, {
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
        })).hash;
    }

    async function BuildResult_needsRebuild_checkPaths (basePath, hashes, paths) {
        const original = {};
        await Promise.all(paths.map(async function (path) {
            try {
                const absPath = INF.LIB.PATH.resolve(basePath, path);
                let hash = await hashForPath(absPath);
                if (hashes[path] !== hash) {
                    original[path] = hashes[path];
                    hashes[path] = hash;
                }
            } catch (err) {
                // If any error occurs we assume that file does not exist.
                original[path] = hashes[path];
                hashes[path] = false;
            }
        }));
        return original;
    }

    function BuildResult_needsRebuild (self) {

        return async function () {

            self.complete = false;

            const inputPaths = Object.keys(self.inputPaths);
            const outputPaths = Object.keys(self.outputPaths);

            if (inputPaths.length || outputPaths.length) {

// console.log('BuildResult_needsRebuild() inputPaths', self.inputPaths);
// console.log('BuildResult_needsRebuild() outputPaths', self.outputPaths);

                const originalInputPaths = await BuildResult_needsRebuild_checkPaths(self.path, self.inputPaths, inputPaths);
                const originalOutputPaths = await BuildResult_needsRebuild_checkPaths(self.path, self.outputPaths, outputPaths);

// console.log('BuildResult_needsRebuild() inputPaths', originalInputPaths, self.inputPaths);    
// console.log('BuildResult_needsRebuild() outputPaths', originalOutputPaths, self.outputPaths);                

                self.complete = (
                    !Object.keys(originalInputPaths).length &&
                    !Object.keys(originalOutputPaths).length
                );
            }

            return !self.complete;
        }
    }

    class BuildResult extends BuildTarget {

        constructor (cloneFromInstance) {
            super(cloneFromInstance);
            const self = this;

            // An ID that represents the BuildStep within the workspace including a component URI & protocol URI
            self.kindId = (cloneFromInstance && cloneFromInstance.kindId) || null;

            // Path to where the build assets are located.
            // This is typically the same as the BuildTarget.path
            // but may be different if the tool chose to provide
            // a different path to the root of the build.
            // The rest of the properties in this class
            // describe aspects relating to the exported 'path'.
            // e.g. If 'path' is a directory then 'inputPaths'
            // lists all paths needed to generate the content of that directory.
            // If 'path' is a file, 'inputPaths' relates to
            // all paths used to generate the file.
            // The 'outputPaths' includes 'path' as well as all
            // asset paths required or optionalfor the exported 'path'.
            self.path = self.path || null;

            // All paths used to generate output.
            // Specifically that subset of paths that relates to the
            // exported 'path' of the build result.
            self.inputPaths = {};

            // All paths that are part of the build result.
            // Specifically that subset of paths that relates to the
            // exported 'path' of the build result. This allows
            // for picking a subset of files for lifting/publishing from
            // a larger set of build result paths.
            // It is assumed that only these paths must survive to keep
            // the exported code functional and thus make the rest of
            // the build result disposable.
            self.outputPaths = {};

            // Signifies that 'inputPaths' and 'outputPaths' are in
            // sync with files on disk. If in sync the result is complete.
            self.complete = false;

            // Compares 'inputPaths' and 'outputPaths' to what is on disk
            // to check if they have diverged. If there are any differences
            // 'complete' is set to 'false'. The result is also always incomplete
            // if no 'inputPaths' nor 'outputPaths' are specified.
            self.needsRebuild = BuildResult_needsRebuild(self);

            // Events that the BuildStep implementation code can register handlers for.
            self.on = {
                rebuild: async function () {
                    // NOTE: This method should be sub-classed.
                    return null;
                }
            };
        }

        toString () {
            return `${INF.LIB.COLORS.magenta(`BuildResult`)}(kindId:${INF.LIB.COLORS.white(this.kindId)},path:${INF.LIB.COLORS.magenta.bold(`/${INF.LIB.PATH.relative(process.cwd(), this.path)}`)})`;
        }        
    }

    let $buildWorkspace = null;
    let buildWorkspaceFS = null;

    class BuildStep {

        constructor () {
            const self = this;

            self['#gi0.PINF.it/core/v0'] = {

                getInterfaceInstanceFor: async function (LIB, namespace, impl, context, helpers) {

                    if (!$buildWorkspace) {
                        $buildWorkspace = new BuildWorkspace();
                        $buildWorkspace.path = INF.options.cwd;
                        $buildWorkspace.cwd = process.cwd();
                        $buildWorkspace.runCodeblock = context.componentInitContext.runCodeblock;

                        buildWorkspaceFS = new FS($buildWorkspace.cwd);

                        workspaceStack.push({
                            console: LIB.console,
                            BuildStep: self,
                            BuildWorkspace: $buildWorkspace
                        });
                    }

                    const kindId = `${context.compNamespace.anchorReference}:${context.compAlias || context.alias}`;
                    if (!kindId) {
                        throw new Error(`Could not determine 'kindId' from 'compNamespace.anchorReference'!`);
                    }

                    let $BuildStepInstance = null;

                    if (context.prefixPath) {

                        $BuildStepInstance = new BuildStepInstance();
                        $BuildStepInstance.kindId = kindId,
                        $BuildStepInstance.api = context.compAlias;

                        // We only splice in the alias and treat it as a path when it
                        // is a path. This allows for the mapping of sub-components
                        // against our own namespac instead of giving the sub-component
                        // its own namespace.
                        $BuildStepInstance.path = INF.LIB.PATH.join.apply(INF.LIB.PATH, [
                            $buildWorkspace.path
                        ].concat(context.prefixPathStack.filter(function (segment) {
                            if (/^\//.test(segment)) {
                                // We give the sub-component its own namespace.
                                return true;
                            }
                            // We map the sub-component namespace into ours.
                            return false;    
                        })));

                        instanceStack.push({
                            console: LIB.console,
                            BuildStep: self,
                            BuildStepInstance: $BuildStepInstance,
                            BuildWorkspace: $buildWorkspace
                        });
                    }

                    if (!context.compNamespace) {
                        throw new Error(`'context.compNamespace' not set for namespace.baseDir '${namespace.baseDir}'!`);
                    }

                    let interfaceMountPrefix = null;
                    if (context.compNamespace.anchorPrefixStack) {
                        let parts = [];
                        let allPaths = (context.compNamespace.anchorPrefixStack.filter(function (segment) {
                            if (/^\//.test(segment.toString())) {
                                parts.push(segment.toString());
                                return true;
                            }
                            return false;
                        }).length === context.compNamespace.anchorPrefixStack.length);
                        if (parts.length) {
                            interfaceMountPrefix = INF.LIB.PATH.join.apply(INF.LIB.PATH, parts);
                        }
                    }

                    const interfaceSourcePath = context.compNamespace.baseDir;

                    const workspaceContext = helpers.getWorkspaceContext();

                    if (!trackPromise) {
                        trackPromise = workspaceContext.trackPromise;
                    }

                    workspaceContext.runCodeblock = context.componentInitContext.runCodeblock;

                    let idAliases = null;

                    // TODO: Inherit from common class that implements common 'pinf.it/core' methods like 'id', 'setIdAliases', ...
                    return {

                        // setIdAliases: function (aliases) {
                        //     idAliases = aliases;
                        // },

                        // id: function () {
                        //     return {
                        //         canonical: kindId,
                        //         aliases: idAliases.filter(function (id) {
                        //             return (id !== kindId);
                        //         })
                        //     };
                        // },

                        // @see https://github.com/pinf-it/inf/blob/master/tests/34-Interfaces/stream.inf.js
                        interface: async function (alias, node) {

                            const instanceMountPrefix = (node.namespace.anchorPrefix && node.namespace.anchorPrefix.toString()) || null;

                            const instanceContext = helpers.getInstanceContext(workspaceContext, kindId, alias, instanceMountPrefix);

                            const $BuildTargets = {};

                            return async function (value, pointer, invocationContext) {

                                if (pointer === "prependInputPaths()") {                                    
                                    value.value.forEach(function (path) {
                                        $BuildStepInstance.inputPaths[path] = true;
                                    });
                                    return true;
                                }

                                let invocationMountPrefix = null;
                                if (invocationContext.namespace.anchorPrefixStack) {
                                    let parts = [];
                                    let allPaths = (invocationContext.namespace.anchorPrefixStack.filter(function (segment) {
                                        if (/^\//.test(segment.toString())) {
                                            parts.push(segment.toString());
                                            return true;
                                        }
                                        return false;
                                    }).length === invocationContext.namespace.anchorPrefixStack.length);
                                    if (parts.length) {
                                        invocationMountPrefix = LIB.PATH.join.apply(LIB.PATH, parts);
                                    }
                                }

                                let origValue = value.value;

                                if (INF.LIB.CODEBLOCK.isCodeblock(origValue)) {
                                    origValue = INF.LIB.CODEBLOCK.thawFromJSON(origValue);
                                }

                                value.value = async function (invocation) {

                                    const context = helpers.makeInvocationContext(
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

                                    context.dirs.source = value.baseDir;

                                    context.value = origValue;
                                    context.declaration = invocation.declaration;
                                    context.mount = invocation.mount;
                                    context.config = (invocation.config && invocation.config[instanceContext.id]) || {};
                                    context.mounts = invocation.mounts;

                                    const invocationAnchorPrefixes = (node.namespace.anchorPrefixStack && node.namespace.anchorPrefixStack.map(function (anchorPrefix) {
                                        return anchorPrefix.toString();
                                    })) || [];

                                    const pointerParts = pointer.match(/^([^\()]+)\(\)\s+(.+)$/);
                                    if (!pointerParts) {
                                        throw new Error(`Error parsing pointer '${pointer}'!`);
                                    }

                                    const targetPath = LIB.PATH.join.apply(LIB.PATH, [
                                        $buildWorkspace.path
                                    ].concat(invocationAnchorPrefixes).concat([
                                        (invocationContext.namespace.initOptions && invocationContext.namespace.initOptions._pinf_it_targetPrefix) || '',
                                        pointerParts[2]
                                    ])).replace(/\/$/, '');
                                    let $BuildTarget = $BuildTargets[targetPath];

                                    if (!$BuildTarget) {
                                        $BuildTarget = $BuildTargets[targetPath] = new BuildTarget();
                                        $BuildTarget.path = targetPath;
                                    }

                                    const $build = new Build();
                                    $build.path = value.baseDir;
                                    $build.method = pointerParts[1];
                                    $build.config = context.value;

                                    invocationStack.push({
                                        console: LIB.console,
                                        BuildStep: self,
                                        Build: $build,
                                        BuildStepInstance: $BuildStepInstance,
                                        BuildTarget: $BuildTarget,
                                        BuildWorkspace: $buildWorkspace
                                    });
                                }

                                return value;
                            }
                        }
                    };                    

                }
            };
        }

        async onWorkspace (BuildWorkspace) {
            // NOTE: This method should be sub-classed.
            return null;
        }
        async onHome (BuildResult, BuildHome, BuildWorkspace) {
            // NOTE: This method should be sub-classed.
            return null;
        }
        async onInstance (BuildStepInstance, BuildHome, BuildWorkspace) {
            // NOTE: This method should be sub-classed.
            return null;
        }
        async onBuild (BuildResult, Build, BuildTarget, BuildStepInstance, BuildHome, BuildWorkspace) {
            // NOTE: This method should be sub-classed.
            return null;
        }
        async onDone (BuildStepInstance, BuildHome, BuildWorkspace) {
            // NOTE: This method should be sub-classed.
            return null;
        }
    }

    // Pass classes that we expect to use to the pinf.it wrapper so that
    // the wrapper can provide them to the interfaces that will be used
    // when invoking methods on us.
    INF.registerInterfaceClasses({
        BuildStep,
        BuildStepInstance,
        BuildWorkspace,
        BuildTarget,
        Build
    });



    function makeReportPathForResult (buildResult) {

//console.log("INF.options", INF.options.contextId);
        return INF.LIB.PATH.join(
            buildWorkspaceFS._baseDir, '.~',
            NS.replace(/\//g, '~'),
            buildResult.kindId.replace(/\//g, '~'),
            `${buildResult.path.replace(/\//g, '~')}~${INF.options.contextId}~build.result.json`
        );
    }

    let buildInvocations = {};

    async function monitorBuildResult (buildResult) {
        monitorBuildResult._handlers = monitorBuildResult._handlers || {};


        const reportBasePath = INF.LIB.PATH.join($buildWorkspace.path, '.~', NS.replace(/\//g, '~'));
        const metaPath = makeReportPathForResult(buildResult);

        const idPath = buildResult.kindId.split(':').slice(1).concat('/' + INF.LIB.PATH.relative($buildWorkspace.path, buildResult.path));
        let obj = INF.LIB.LODASH.get(buildInvocations, idPath, {
            count: 0,
            resultPath: `./${INF.LIB.PATH.relative(reportBasePath, buildResult.path)}`,
            resultReportPath: `./${INF.LIB.PATH.relative(reportBasePath, metaPath)}`
        });
        obj.count += 1;
        INF.LIB.LODASH.set(buildInvocations, idPath, obj);

        let handler = INF.LIB.LODASH.get(monitorBuildResult._handlers, [buildResult.kindId, buildResult.path], null);
        if (!handler) {
            handler = /*INF.LIB.LODASH.debounce(*/ function () {

                trackPromise((async function () {

                    if (!(await buildResult.needsRebuild())) {
                        INF.LIB.console.log(`SKIP rebuild() for ${buildResult} due to 'result.needsRebuild() === false'`);                        
                        return;
                    }

                    INF.LIB.console.info(`Trigger rebuild() for ${buildResult}`);
                    INF.LIB.console.debug(`buildResult.on.rebuild.toString():`, buildResult.on.rebuild.toString());
                    
                    try {

                        const api = await buildResult.on.rebuild();

                        if (api !== null) {
                            await monitorBuildResult(buildResult);
                        }
                    } catch (err) {
                        console.error(`Error while rebuilding:`, err);
                        throw err;
                    }
                })());
            }//, 100);
            INF.LIB.LODASH.set(monitorBuildResult._handlers, [buildResult.kindId, buildResult.path], handler);
        }

        const inputPaths = Object.keys(buildResult.inputPaths);
        if (Object.keys(inputPaths).length) {
            INF.LIB.console.debug(`Track 'inputPaths' from ${buildResult.toString()}:`, inputPaths);

            buildWorkspaceFS.registerPathOnChangedHandler(inputPaths, handler);
            // buildWorkspaceFS.registerPathOnChangedHandler(inputPaths.map(function (path) {
            //     return INF.LIB.PATH.resolve(buildResult.path, path || buildResult.path);
            // }), handler);
        }

        const outputPaths = Object.keys(buildResult.outputPaths);
        if (outputPaths.length) {
            INF.LIB.console.debug(`Track 'outputPaths' from ${buildResult.toString()}:`, outputPaths);

            buildWorkspaceFS.registerPathOnChangedHandler(outputPaths, handler);
            // buildWorkspaceFS.registerPathOnChangedHandler(outputPaths.map(function (path) {
            //     return INF.LIB.PATH.resolve(buildResult.path, path || buildResult.path);
            // }), handler);
        }

        // This computes 'inputPaths' and 'outputPaths' hashes and in the process
        // completes the result.
        await buildResult.needsRebuild();
        // The 'buildResult.needsRebuild()' call will set 'buildResult.complete === false' if any of the
        // 'inputPaths' or 'outputPaths' were set to 'true' or 'false' or if any of the paths do not exist
        // or do not match a value we previously had.
        if (!buildResult.complete) {
            // We need to store the result report as it has changed.
            INF.LIB.console.debug(`Saving ${buildResult} to:`, metaPath);

            await INF.LIB.FS.outputFile(metaPath, JSON.stringify(INF.LIB.LODASH.merge({}, buildResult, {
                path: INF.LIB.PATH.relative(buildWorkspaceFS._baseDir, buildResult.path),
                complete: null,
                on: null
            }), null, 4), 'utf8');
            // Everything is in sync now so the result is complete.
            buildResult.complete = true;
        }
    }

    let workspaceStack = [];
    let homeStack = [];
    let instanceStack = [];
    let invocationStack = [];
    const homeByKind = {};

    const exportedAPI = {};
    const onDoneInstructions = [];



    let invocationIndex = 0;
//    let modelProcessingDeferred = INF.LIB.Promise.defer();
    INF.registerOnProcessingDoneHandler(async function (reason) {

        if (reason) {
            // processing done after loading more instructions.
            return;
        }

        invocationIndex += 1;

        const ourInvocationIndex = invocationIndex;

        if (!workspaceStack.length) {
            // The 'build' model was never used.
            return;
        }

        // ##################################################
        // # The instruction processing phase has completed
        // # and all BuildStep invocations are linked into the target
        // # structure and stacked in the order they were delcared.
        // # The resulting structure may now be invoked which will
        // # cause it to be traversed from start to finish.
        // ##################################################

        // ##################################################
        // # Preparing model to receive build events.
        // ##################################################

        INF.LIB.console.log(`Processing done. Executing model.`);

        async function executeModel () {

            const stacks = {};

            stacks.instanceStack = instanceStack;
            instanceStack = [];
            // Go through all instances and determine the closest to the top
            // of the tree for each different kind. These are the 'home' instances.
            stacks.instanceStack.forEach(function (instance) {
                const kindId = instance.BuildStepInstance.kindId;
                if (
                    !homeByKind[kindId] ||
                    homeByKind[kindId].BuildStepInstance.path.substring(0, instance.BuildStepInstance.path.length) === instance.BuildStepInstance.path
                ) {
                    homeByKind[kindId] = instance;
                }
            });
            Object.keys(homeByKind).forEach(function (kindId) {
                homeStack.push(homeByKind[kindId]);
            });

            stacks.workspaceStack = workspaceStack;
            workspaceStack = [];
            INF.LIB.console.log(`Executing onWorkspace():`, stacks.workspaceStack.length);
            await INF.LIB.Promise.mapSeries(stacks.workspaceStack, async function (args) {

                if (args.BuildStep.onWorkspace !== BuildStep.prototype.onWorkspace) {

                    const buildResult = new BuildResult(args.BuildWorkspace);
                    buildResult.kindId = `${NS}:onWorkspace`;

                    args.console.log('onWorkspace()', buildResult.toString(), args.BuildWorkspace.toString());            
                    args.console.debug('onWorkspace()', buildResult, args.BuildWorkspace);            

                    const ret = await args.BuildStep.onWorkspace(buildResult, args.BuildWorkspace);

                    if (ret !== null) {
                        await monitorBuildResult(buildResult);
                    }
                }
            });

            stacks.invocationStack = invocationStack;
            invocationStack = [];

            stacks.homeStack = homeStack;
            homeStack = [];
            INF.LIB.console.log(`Executing onHome():`, stacks.homeStack.length);
            await INF.LIB.Promise.mapSeries(stacks.homeStack, async function (args) {

                $BuildHome = new BuildHome(args.BuildStepInstance);

                homeByKind[$BuildHome.kindId].BuildHome = $BuildHome;

                if (args.BuildStep.onHome !== BuildStep.prototype.onHome) {

                    const buildResult = new BuildResult(args.BuildStepInstance);
                    buildResult.kindId = `${buildResult.kindId}:onHome`;
                    INF.LIB.LODASH.merge(buildResult.inputPaths, args.BuildStepInstance.inputPaths, buildResult.inputPaths);

                    args.console.log(INF.LIB.COLORS.white.bold('onHome()'), buildResult.toString(), $BuildHome.toString(), args.BuildWorkspace.toString());
                    args.console.debug(INF.LIB.COLORS.white.bold('onHome()'), buildResult, $BuildHome, args.BuildWorkspace);

                    let api = await args.BuildStep.onHome(buildResult, $BuildHome, args.BuildWorkspace);

                    if (api !== null) {

                        api = api || {};

                        if (!api['path']) {
                            api['path'] = function () {
                                return buildResult.path;
                            };
                        }
                        if (api['BuildResult']) throw new Error(`ToolStep may not return 'BuildResult' result API from 'onHome()!`);
                        api['BuildResult'] = buildResult;

                        // TODO: Move this into pinf-it in general so it works for all models.
                        INF.LIB.LODASH.set(exportedAPI, ['invocationsByKindIdAndPath', buildResult.kindId, buildResult.path], api);

                        await monitorBuildResult(buildResult);
                    }
                }
            });

            if (instanceStack.length) {
                throw new Error(`onHome() instructions may only invoke builds. They may not map new interfaces!`);
            }
            if (invocationStack.length) {
                stacks.invocationStack = invocationStack.concat(stacks.invocationStack);
                invocationStack = [];
            }

            INF.LIB.console.log(`Executing onInstance():`, stacks.instanceStack.length);

            await INF.LIB.Promise.mapSeries(stacks.instanceStack, async function (args) {

                if (args.BuildStep.onInstance !== BuildStep.prototype.onInstance) {

                    const kindId = args.BuildStepInstance.kindId;

                    const buildResult = new BuildResult(args.BuildStepInstance);
                    buildResult.kindId = `${buildResult.kindId}:onInstance`;
                    INF.LIB.LODASH.merge(buildResult.inputPaths, args.BuildStepInstance.inputPaths, buildResult.inputPaths);

                    args.console.log('onInstance()', buildResult.toString(), args.BuildStepInstance.toString(), homeByKind[kindId].BuildHome.toString(), args.BuildWorkspace.toString());
                    args.console.debug('onInstance()', buildResult, args.BuildStepInstance, homeByKind[kindId].BuildHome, args.BuildWorkspace);            

                    const ret = await args.BuildStep.onInstance(buildResult, args.BuildStepInstance, homeByKind[kindId].BuildHome, args.BuildWorkspace);

                    if (ret !== null) {
                        await monitorBuildResult(buildResult);
                    }
                }
            });

            if (instanceStack.length) {
                throw new Error(`onInstance() instructions may only invoke builds. They may not map new interfaces!`);
            }

            // ##################################################
            // # Invoking build events on model.
            // ##################################################

            async function executeOnBuild () {

                if (invocationStack.length) {
                    stacks.invocationStack = invocationStack.concat(stacks.invocationStack);
                    invocationStack = [];
                }

                INF.LIB.console.log(`Executing onBuild():`, stacks.invocationStack.length);
                await INF.LIB.Promise.mapSeries(stacks.invocationStack, async function (args) {
    
                    if (
                        args.BuildStep.onBuild !== BuildStep.prototype.onBuild ||
                        args.BuildStep.onEveryBuild !== BuildStep.prototype.onEveryBuild
                    ) {

                        const kindId = args.BuildStepInstance.kindId;
        
                        const buildResult = new BuildResult(args.BuildTarget);
                        buildResult.kindId = `${kindId}:onBuild`;
                        INF.LIB.LODASH.merge(buildResult.inputPaths, args.BuildStepInstance.inputPaths, buildResult.inputPaths);
        
                        const metaPath = makeReportPathForResult(buildResult);
                        // Load existing result if we have it.
                        if (await INF.LIB.FS.exists(metaPath)) {
                            try {
                                const existingResult = await INF.LIB.FS.readJSON(metaPath);
                                // Ensure the result cache belongs to us.
                                if (
                                    INF.LIB.PATH.join(buildWorkspaceFS._baseDir, existingResult.path) === buildResult.path &&
                                    existingResult.kindId === buildResult.kindId
                                ) {
                                    INF.LIB.LODASH.merge(buildResult.inputPaths, existingResult.inputPaths);
                                    INF.LIB.LODASH.merge(buildResult.outputPaths, existingResult.outputPaths);
        
                                    // Check if report is in sync with what is on disc
                                    await buildResult.needsRebuild();
                                }
                            } catch (err) {
                                // We assume there is no existing cache.
                            }
                        }
        
        
                        async function callBuild (funcName) {
        
                            args.console.log(INF.LIB.COLORS.yellow.bold(`${funcName}()`), buildResult.toString(), args.Build.toString(), args.BuildTarget.toString(), args.BuildStepInstance.toString(), homeByKind[kindId].BuildHome.toString(), args.BuildWorkspace.toString());
                            args.console.debug(INF.LIB.COLORS.yellow.bold(`${funcName}()`), buildResult, args.Build, args.BuildTarget, args.BuildStepInstance, homeByKind[kindId].BuildHome, args.BuildWorkspace);            
            
                            let api = await args.BuildStep[funcName](
                                buildResult,
                                args.Build,
                                args.BuildTarget,
                                args.BuildStepInstance,
                                homeByKind[kindId].BuildHome,
                                args.BuildWorkspace
                            );
        
                            return api;
                        }
        
                        async function doBuild (funcName) {
        
                            let api = await callBuild(funcName);
        
                            if (api !== null) {
                                api = api || {};
            
                                if (!api['path']) {
                                    api['path'] = function () {
                                        return args.BuildTarget.path;
                                    };
                                }
                                if (api['BuildResult']) throw new Error(`ToolStep may not return 'BuildResult' result API from 'onBuild()!`);
                                api['BuildResult'] = buildResult;
            
                                // TODO: Move this into pinf-it in general so it works for all models.
                                INF.LIB.LODASH.set(exportedAPI, ['invocationsByKindIdAndPath', buildResult.kindId, args.BuildTarget.path], api);
            
                                await monitorBuildResult(buildResult);
                            }                    
                        }
        
                        buildResult.on.rebuild = async function () {
                            // NOTE: We do not use the exported API. We only keep the one from the first invocation.
                            if (args.BuildStep.onEveryBuild) {
                                return await callBuild('onEveryBuild');
                            } else {
                                return await callBuild('onBuild');
                            }
                        }
        
                        if (args.BuildStep.onEveryBuild) {
                            // Called if report is complete or not.
                            // Used to always export an initialized API when booting up.
                            // Maybe start using an 'getAPI' function instead of exporting API from onHome/onBuild?
                            await doBuild('onEveryBuild');
                            return;
                        }
        
                        // See if we need to run the build at all.
                        if (
                            buildResult.complete === true &&
                            INF.options.rebuild !== true
                        ) {
                            args.console.log(INF.LIB.COLORS.yellow.bold(`SKIP onBuild()`) + ' due to no changes', buildResult.toString(), args.Build.toString(), args.BuildTarget.toString(), args.BuildStepInstance.toString(), homeByKind[kindId].BuildHome.toString(), args.BuildWorkspace.toString());

                            const api = {};        
                            api['path'] = function () {
                                return args.BuildTarget.path;
                            };
                            api['BuildResult'] = buildResult;

                            // TODO: Move this into pinf-it in general so it works for all models.
                            INF.LIB.LODASH.set(exportedAPI, ['invocationsByKindIdAndPath', buildResult.kindId, args.BuildTarget.path], api);

                            return;
                        }
        
                        await doBuild('onBuild');
                    }
                });
    
                if (instanceStack.length) {
                    throw new Error(`onBuild() instructions may only invoke builds. They may not map new interfaces!`);
                }

                if (invocationStack.length) {
                    // The builds above ran instructions that added more builds
                    // which we need to run before we can continue.

                    INF.LIB.console.log(`onBuild() ran instructions that scheduled ${invocationStack.length} more builds.`);

                    stacks.invocationStack = [];
                    await executeOnBuild();
                }
            }

            await executeOnBuild();

            // if (invocationStack.length !== invocationStackLength) {
            //     throw new Error(`The 'invocationStack' grew by '${(invocationStack.length - invocationStackLength)}' while executing itself.`);
            // }

            // ##################################################
            // # Finalizing model.
            // ##################################################

            INF.LIB.console.log(`Executing onDone():`, stacks.instanceStack.length);

            await INF.LIB.Promise.mapSeries(stacks.instanceStack, async function (args) {

                if (args.BuildStep.onDone !== BuildStep.prototype.onDone) {

                    const kindId = args.BuildStepInstance.kindId;

                    const buildResult = new BuildResult(args.BuildStepInstance);
                    buildResult.kindId = `${buildResult.kindId}:onDone`;
                    INF.LIB.LODASH.merge(buildResult.inputPaths, args.BuildStepInstance.inputPaths, buildResult.inputPaths);

                    args.console.log('onDone()', buildResult.toString(), args.BuildStepInstance.toString(), homeByKind[kindId].BuildHome.toString(), args.BuildWorkspace.toString());
                    args.console.debug('onDone()', buildResult, args.BuildStepInstance, homeByKind[kindId].BuildHome, args.BuildWorkspace);

                    const ret = await args.BuildStep.onDone(buildResult, args.BuildStepInstance, homeByKind[kindId].BuildHome, args.BuildWorkspace);

                    if (ret !== null) {
                        await monitorBuildResult(buildResult);
                    }
                }
            });

            if (instanceStack.length) {
                throw new Error(`onDone() instructions may only invoke builds. They may not map new interfaces!`);
            }
        }

        await executeModel();

        if (ourInvocationIndex === 1) {

            INF.LIB.console.log(`Executing onDoneInstructions:`, onDoneInstructions.length);

            await INF.LIB.Promise.mapSeries(onDoneInstructions, function (args) {

                args.console.log('onDoneInstruction handler', args.meta.file, args.meta.line);
                args.console.debug('onDoneInstruction handler:', args.meta);

                return args.handler();
            });

            // TODO: Write build invocation to a new time-based filename and merge into existing root report.
            const reportPath = INF.LIB.PATH.join($buildWorkspace.path, '.~', NS.replace(/\//g, '~'), 'build-invocations.json');
            await INF.LIB.FS.outputFile(reportPath, JSON.stringify(buildInvocations, null, 4), 'utf8');

            INF.LIB.console.debug(`Build invocations::`, JSON.stringify(buildInvocations, null, 4));
        }

//        modelProcessingDeferred.resolve();
    });

    return {

        invoke: async function (pointer, value, options) {

            INF.LIB.console.debug(`Handle invoke() for pointer:`, pointer);

            if (pointer === "prependInputPaths()") {
                if (typeof value.value === 'function') {
                    // Trigger all implementation adapters to take these input paths into account.
                    await value.value();
                }
                return true;
            }

            if (pointer === 'onDone()') {
                onDoneInstructions.push({
                    console: INF.LIB.console,
                    meta: value.meta,
                    handler: async function () {
                        await options.callerNamespace.componentInitContext.load(value, {
                            _pinf_it_targetPrefix: pointer
                        });
                    }
                });
                return true;
            }
            if (/^onOption\(\)\s/.test(pointer)) {
                onDoneInstructions.push({
                    console: INF.LIB.console,
                    meta: value.meta,
                    handler: async function () {

//                        await modelProcessingDeferred.promise;

                        const optionName = pointer.match(/^onOption\(\)\s(.+)$/)[1];
                        if (INF.options[optionName]) {
                            // await INF.load(value);
                            await options.callerNamespace.componentInitContext.load(value, {
                                _pinf_it_targetPrefix: pointer
                            });
                        }
                    }
                });
                return true;
            }
            if (pointer === 'watch()') {
                workspaceEvents.emit("watch");
                return true;
            }
            if (pointer === 'unwatch()') {
                workspaceEvents.emit("unwatch");
                return true;
            }

            if (/^\//.test(pointer)) {
                // We just have a path which means we are scheduling invocations to run with
                // the specified prefix for the target path.
                await options.callerNamespace.componentInitContext.load(value, {
                    _pinf_it_targetPrefix: pointer
                });
                return true;
            }

            const m = pointer.match(/^([^\()]+)\(\)(?:\s(.*))?$/);
            if (m) {
                const callerContext = {
                    declaration: value.meta,
                    method: m[1]
                };
                if (m[2]) {
                    callerContext.mount = {
                        path: m[2]
                    };
                }

                await value.value(callerContext);
                return exportedAPI;
            }
        }
    };
}
