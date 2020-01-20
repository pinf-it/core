
exports.inf = async function (INF, NS) {

    const workspaceEvents = INF.LIB.workspaceEvents = new INF.LIB.EventEmitter();

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

            const absPath = INF.LIB.PATH.join(this._baseDir, path);

            if (!Buffer.isBuffer(content)) {
                content = Buffer.from(content);
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

        async writeStream (path, stream) {

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
        }

        async exists (path) {
            return (!!this._mounts[path]);
        }

        async mount (path, app) {

            // TODO: Write mount socket files to the filesystem.

            INF.LIB.console.info(`Mounting to: ${INF.LIB.PATH.join(this._baseDir, path)}`);

            this._mounts[path] = app;
        }

        getAll () {
            return this._mounts;
        }

        getAllForPrefix (prefix) {
            const self = this;
            const mounts = {};
            Object.keys(self._mounts).forEach(function (path) {
                if (path.indexOf(prefix) === 0) {
                    mounts[path.substring(prefix.length)] = self._mounts[path];
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
            if (options.callerNamespace.anchorPrefix) {
                path = INF.LIB.PATH.join(options.callerNamespace.anchorPrefix.toString(), path);
            }
            context.mount = {
                path: path
            };
        }
        context.config = config;
        return context;
    }

    return {

        watch: async function () {
            workspaceEvents.emit("watch");
        },

        unwatch: async function () {
            workspaceEvents.emit("unwatch");
        },

        invoke: async function (pointer, value, options) {

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

            m = pointer.match(/^(set|write|ensure|mount|run)\(\)(?:\s(.+))?$/);
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

                    return true;
                } else
                if (m[1] === 'set') {

                    await value.value({
                        method: 'set',
                        name: m[2],
                        config: config,
                        fs: fs
                    });

                    return true;
                } else
                if (m[1] === 'write') {

                    const callerContext = makeCallerContext(m[1], m[2], value, options);

                    let output = value.value;
                    if (typeof output === 'function') {    
                        output = (await output(callerContext));

                        if (output === true) {
                            output = undefined;
                        } else {

                            output = output.value;

                            if (
                                output === undefined ||
                                output === null ||
                                typeof output === 'boolean'
                            ) {
                                throw new Error(`Invalid tool 'output'!`);
                            }
                        }
                    }

                    if (output !== undefined) {

                        // Check if we have a ValueProvider that may update the value
                        if (typeof output.getValue === 'function') {

                            await fs.writeFile(callerContext.mount.path, output.getValue());

                            if (typeof output.on === 'function') {
                                output.on('value.changed', function () {
                                    fs.writeFile(callerContext.mount.path, output.getValue());
                                });
                            }

                        } else
                        if (
                            typeof output === 'string' ||
                            Buffer.isBuffer(output)
                        ) {
                            await fs.writeFile(callerContext.mount.path, output);
                        } else {
                            await fs.writeStream(callerContext.mount.path, output);
                        }
                    }

                    if (process.env.PINF_IT_TEST_VERBOSE) {
                        console.log(`[gi0-PINF-it] ${m[1]}():`, NS, pointer, callerContext.mount.path, output);

                        return {
                            event: `[gi0-PINF-it] ${m[1]}():`,
                            NS: NS,
                            pointer: pointer,
                            path: callerContext.mount.path,
                            value: output
                        };                        
                    }

                    return true;
                } else
                if (m[1] === 'mount') {

                    const callerContext = makeCallerContext(m[1], m[2], value, options);

                    let app = value.value;
                    if (typeof app === 'function') {    
                        app = (await app(callerContext)).value;
                    }

                    await mounts.mount(callerContext.mount.path, app);

                    return true;
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

                    return true;
                }
            }
        }
    };
}
