

// # DEPRECATED: Use 'build/v0' or 'fs/v0' instead.


exports.inf = async function (INF, NS) {

    const workspaceEvents = INF.LIB.workspaceEvents;

    class FS extends INF.LIB.EventEmitter {

        constructor (baseDir) {
            super();
            const self = this;

            self.setMaxListeners(100);

            self._baseDir = baseDir;

            self._watchHandlers = {};
            self._watcher = INF.LIB.CHOKIDAR.watch([], {
                ignored: /(^|[\/\\])\../, // ignore dotfiles
                persistent: true
            });
            self._watcher.on('change', function (path) {

                INF.LIB.console.info(`Path changed: ${path}`);

                if (!self._watchHandlers[path]) return;

                // TODO: Track this promise and do not exit until resolved.
                Promise.all(self._watchHandlers[path].map(function (handler) {
                    try {
                        return handler();
                    } catch (err) {
                        INF.LIB.console.error(`Error while calling change handler for path '${path}':`, err);
                    }
                }));
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
            return INF.LIB.FS.exists(INF.LIB.PATH.join(this._baseDir, path));
        }

        async writeFile (path, content) {

            if (
                content.length === path.length &&
                content.toString() === path
            ) {
                const absPath = INF.LIB.PATH.join(this._baseDir, path);

                // TODO: Index content?

                // We act on the path

                INF.LIB.console.info(`Tracking: ${absPath}`);

console.error("TODO: Emit directory changed event for:", path);

                // TODO: Index content
                // TODO: Emit changed event

            } else {
                // We act on the content

                const absPath = INF.LIB.PATH.join(this._baseDir, path);

//console.error("WRITE CONTENT", content);

                if (!Buffer.isBuffer(content)) {
                    try {
                        content = Buffer.from(content);
                    } catch (err) {
                        console.error('content:', content);
                        throw err;
                    }
                }

                INF.LIB.console.info(`Writing to: ${absPath}`);

                let originalContent = null;

                if (await this.exists(path)) {
                    originalContent = await INF.LIB.FS.readFile(absPath);
                }

                await INF.LIB.FS.outputFile(absPath, content);

                if (
                    !originalContent ||
                    !content.equals(originalContent)
                ) {
                    this.emit(`path.changed:${path}`);
                }
            }
        }

        async writeStream (path, stream) {

            if (!stream) {
                throw new Error(`'stream' argument to writeStream() is null!`);
            }
            if (typeof stream.pipe !== 'function') {
                console.error('stream:', stream);
                throw new Error(`'stream' argument to writeStream() does not have a 'pipe()' method!`);
            }

            const absPath = INF.LIB.PATH.join(this._baseDir, path);

            INF.LIB.console.info(`Writing to: ${absPath}`);

            // TODO: Optionally compare content and not just size.
            let originalSize = null;

            if (await this.exists(path)) {
                originalSize = (await INF.LIB.FS.stat(absPath)).size;
            }

            if (!(await this.exists(INF.LIB.PATH.dirname(absPath)))) {
                await INF.LIB.FS.mkdirs(INF.LIB.PATH.dirname(absPath));
            }

            const file = INF.LIB.FS.createWriteStream(absPath, {
                flags: 'w'
            });
            stream.pipe(file);

            await new Promise(function (resolve, reject) {
                stream.once('error', reject);                    
                stream.once('end', resolve);                    
            });

            if (
                !originalSize ||
                ((await INF.LIB.FS.stat(absPath)).size) !== originalSize
            ) {
                this.emit(`path.changed:${path}`);
            }
        }

        async registerPathOnChangedHandler (paths, handler) {
            const self = this;
            if (!Array.isArray(paths)) {
                paths = [ paths ];
            }
            paths.forEach(function (path) {
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
            INF.LIB.console.debug(`Watch path: ${path}`);
            this._watcher.add(path);
        }
        _unwatchPaths () {
            const self = this;
            Object.keys(self._watchHandlers).forEach(function (path) {
                self._unwatchPath(path);
            });
        }
        _unwatchPath (path) {
            INF.LIB.console.debug(`Unwatch path: ${path}`);
            this._watcher.unwatch(path);
        }
    }

    const fs = INF.LIB.workspaceFS = new FS(INF.options.cwd);

    class Mounts {

        constructor (baseDir) {
            const self = this;

            self._baseDir = baseDir;
            self._mounts = {};
            self._apps = {};
        }

        async exists (path) {
            return (
                !!this._mounts[path] ||
                !!this._apps[path]
            );
        }

        async mount (path, app) {

            // TODO: Write mount socket files to the filesystem.

            INF.LIB.console.info(`Mounting route to: ${INF.LIB.PATH.join(this._baseDir, path)}`);

            this._mounts[path] = app;
        }

        async mountRouteApp (path, routeApp) {

            // TODO: Write mount socket files to the filesystem.

            INF.LIB.console.info(`Mounting route app to: ${INF.LIB.PATH.join(this._baseDir, path)}`);

            this._apps[path] = routeApp;            
        }

        getAllMounts () {
            return this._mounts;
        }

        getAllApps () {
            return this._apps;
        }

        getMountsForPrefix (prefix) {
            const self = this;
            const mounts = {};
            Object.keys(self._mounts).forEach(function (path) {
                if (path.indexOf(prefix) === 0) {
                    mounts[path.substring(prefix.length)] = self._mounts[path];
                }
            });
            return mounts;
        }

        getAppsForPrefix (prefix) {
            const self = this;
            const mounts = {};
// console.log("prefix", prefix);
// console.log("self._apps", self._apps);            
            
            Object.keys(self._apps).forEach(function (path) {
                if (path.indexOf(prefix) === 0) {
                    mounts[path.substring(prefix.length)] = self._apps[path];
                }
            });
            return mounts;
        }
    }

    // Mounts overlap with the filesystem.
    const mounts = new Mounts(INF.options.cwd);

    async function getProfileProperty (context, propertyGroup, propertyName) {
        const profilePath = INF.LIB.PATH.join(context.dirs.profile, `${propertyGroup}.json`);
        if (!(await INF.LIB.FS.exists(profilePath))) {
            return undefined;
        }
        const profile = await INF.LIB.FS.readJson(profilePath);
        return (profile[propertyName] || undefined);
    }

    async function setProfileProperty (context, propertyGroup, propertyName, value) {
        const profilePath = INF.LIB.PATH.join(context.dirs.profile, `${propertyGroup}.json`);
        let profile = {};
        if (await INF.LIB.FS.exists(profilePath)) {
            profile = await INF.LIB.FS.readJson(profilePath);
        }
        profile[propertyName] = value;
        await INF.LIB.FS.outputFile(profilePath, JSON.stringify(profile, null, 4), 'utf8');
    }

    const config = {};

    function makeCallerContext (method, path, value, options) {
        const context = {
            declaration: value.meta,
            method: method
        };
        if (path) {
            // if (options.callerNamespace.anchorPrefix) {
            //     path = INF.LIB.PATH.join(options.callerNamespace.anchorPrefix.toString(), path);
            // }
            context.mount = {
                path: path
            };
        }
        context.config = config;
        return context;
    }

    const infAPI = {
        mounts: mounts
    };

    return {

        watch: async function () {
            // TODO: Fire on all workspaces.
            workspaceEvents.emit("watch");
        },

        unwatch: async function () {
            // TODO: Fire on all workspaces.
            workspaceEvents.emit("unwatch");
        },

        invoke: async function (pointer, value, options) {

            if (pointer === 'waitForAnyKey()') {
                const INQUIRER = require("inquirer");

                await INQUIRER.prompt([
                    {
                        type: 'input',
                        name: 'question',
                        message: `Press any key to exit dev server.\n`
                    }
                ]);

                return true;
            }

            if (/^onOption\(\)\s/.test(pointer)) {

                const optionName = pointer.match(/^onOption\(\)\s(.+)$/)[1];

                if (INF.options[optionName]) {
                    await INF.load(value);
                }

                return true;
            }

            let m = null;

            if (m = pointer.match(/^ask\(([^\)]*)\)\s(.+)$/)) {
                const INQUIRER = require("inquirer");
                const answers = await INQUIRER.prompt([
                    {
                        type: 'input',
                        name: 'question',
                        message: `${m[2]}\n`
                    }
                ]);
                if (!answers.question) {
                    throw new Error('No answer to question provided!');
                }
                answers.question = answers.question.replace(/[\s\n]*$/, '');
                return answers.question;
            } else
            if (m = pointer.match(/^askOnce\(([^\)]*)\)\s(.+)$/)) {
                INF.LIB.ASSERT.equal(typeof value.value, 'object');
                INF.LIB.ASSERT.equal(typeof value.value.invocation, 'object');
                INF.LIB.ASSERT.equal(value.value.invocation['#'], 'gi0.pinf.it/core/v0/tool/invocation');
                INF.LIB.ASSERT.equal(typeof value.value.profilePropertyName, 'string');
                const INQUIRER = require("inquirer");
                const existingValue = await getProfileProperty(value.value.invocation, 'questions', value.value.profilePropertyName);
                if (existingValue !== undefined) {
                    return existingValue;
                }
                const answers = await INQUIRER.prompt([
                    {
                        type: 'input',
                        name: 'question',
                        message: `${m[2]}\n`
                    }
                ]);
                if (!answers.question) {
                    throw new Error('No answer to question provided!');
                }
                answers.question = answers.question.replace(/[\s\n]*$/, '');
                await setProfileProperty(value.value.invocation, 'questions', value.value.profilePropertyName, answers.question);
                return answers.question;
            }

//console.log("pointer", pointer, value);

            m = pointer.match(/^(set|write|ensure|mount|run)\(\)(?:\s(.*))?$/);

            if (m) {

                if (m[1] === 'ensure') {

                    const callerContext = makeCallerContext(m[1], m[2], value, options);
                    if (!(await fs.exists(callerContext.mount.path))) {
                        const getter = (await value.value(callerContext)).value;
                        if (typeof getter === 'function') {
                            await fs.writeFile(callerContext.mount.path, await getter());
                        } else {
                            await fs.writeFile(callerContext.mount.path, getter);
                        }
                    };

                    return infAPI;
                } else
                if (m[1] === 'set') {

                    await value.value({
                        method: 'set',
                        name: m[2],
                        config: config,
                        fs: fs
                    });

                    return infAPI;
                } else
                if (m[1] === 'write') {

// console.error("m[2]", m[2]);
                    
                    const callerContext = makeCallerContext(m[1], m[2], value, options);

//console.error("[core][write] callerContext", callerContext)                                    

                    let invocationContext = null;

                    let output = value.value;
                    if (typeof output === 'function') {    
                        output = (await output(callerContext));

                        if (output === true) {
                            output = undefined;
                        } else {

                            invocationContext = output.invocationContext;

                            output = output.value;

                            // if (
                            //     output === undefined ||
                            //     output === null ||
                            //     typeof output === 'boolean'
                            // ) {
                            //     throw new Error(`Invalid tool 'output'!`);
                            // }
                        }
                    }

                    if (!invocationContext) {
                        console.error("pointer:", pointer);
                        console.error("value:", value);
                        console.error("callerContext:", callerContext);
                        throw new Error(`No 'invocationContext' available.`);
                    }
                    if (!callerContext.mount.path) {
                        throw new Error(`No 'callerContext.mount.path' available.`);
                    }
                    const distPath = INF.LIB.PATH.relative(invocationContext.pwd, INF.LIB.PATH.join(invocationContext.dirs.dist, callerContext.mount.path));

                    if (
                        output !== undefined &&
                        output !== null &&
                        typeof output !== 'boolean'
                    ) {

                        if (INF.LIB.CODEBLOCK.isCodeblock(output)) {

                            output = await INF.LIB.CODEBLOCK.runAsync(output, {
                                LIB: INF.LIB,
                                '___PWD___': INF.options.cwd
                            });

                            await fs.writeFile(distPath, output);

                        } else
                        // Check if we have a ValueProvider that may update the value
                        if (typeof output.getValue === 'function') {

                            const val = output.getValue();
                            if (val !== undefined) {
                                await fs.writeFile(distPath, val);
                            }

                            if (typeof output.on === 'function') {
                                output.on('value.changed', function () {
                                    fs.writeFile(distPath, output.getValue());
                                });
                            }

                        } else
                        if (
                            typeof output === 'string' ||
                            Buffer.isBuffer(output)
                        ) {
                            await fs.writeFile(distPath, output);
                        } else {
                            await fs.writeStream(distPath, output);
                        }
                    }

                    if (process.env.PINF_IT_TEST_VERBOSE) {
                        console.log(`[gi0-PINF-it] ${m[1]}():`, NS, pointer, distPath, output);

                        return {
                            event: `[gi0-PINF-it] ${m[1]}():`,
                            NS: NS,
                            pointer: pointer,
                            path: distPath,
                            value: output
                        };                        
                    }

                    return infAPI;
                } else
                if (m[1] === 'mount') {

                    const callerContext = makeCallerContext(m[1], m[2], value, options);

                    if (typeof value.value !== 'function') {    
                        throw new Error(`'value' for mount() must be a function!`);
                    }

// console.error("[core][mount] callerContext", callerContext)                                    

                    const handlers = (await value.value(callerContext));

                    const invocationContext = handlers.invocationContext;

//console.log('[CORE] Mount at:', INF.LIB.PATH.relative(invocationContext.pwd, INF.LIB.PATH.join(invocationContext.dirs.dist, (callerContext.mount && callerContext.mount.path) || '')));

                    const mountPrefix = '/' + INF.LIB.PATH.relative(invocationContext.pwd, INF.LIB.PATH.join(invocationContext.dirs.dist, (callerContext.mount && callerContext.mount.path) || ''));

                    if (handlers.value) {
                        await mounts.mount(mountPrefix, handlers.value);
                    }
                    if (handlers.routeApp) {
                        await mounts.mountRouteApp(mountPrefix, handlers.routeApp);
                    }

                    return infAPI;
                } else
                if (m[1] === 'run') {

                    const callerContext = makeCallerContext(m[1], m[2] || '', value, options);

                    callerContext.fs = fs;
                    callerContext.mounts = mounts;

                    const result = (await value.value(callerContext)).value;

                    if (
                        typeof result !== 'undefined' &&
                        result !== true &&
                        typeof result.value !== 'undefined'
                    ) {
                        throw new Error(`TODO: Expect 'mount.path' to be set and write result to fs.`);
                    }

                    return infAPI;
                }
            }
        }
    };
}
