
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs");
const FSP = FS.promises;
const CHILD_PRECESS = require("child_process");
const PINF_IT = require(".");


describe('core', function () {

    describe('Api: CLI', function () {

        it('No Arguments: Show Usage', function (done) {
            CHILD_PRECESS.exec('pinf.it', { cwd: __dirname }, function (err, stdout, stderr) {
                if (err) return done(err);
                ASSERT.equal(stderr, '[pinf.it] ERROR: No COMMAND to run specified!\n');
                ASSERT.equal(/Usage: pinf\.it \[OPTIONS\] COMMAND FILEPATH/.test(stdout), true);
                done();
            });
        });

        it('Command: help', function (done) {
            CHILD_PRECESS.exec('pinf.it help', { cwd: __dirname }, function (err, stdout, stderr) {
                if (err) return done(err);
                ASSERT.equal(stderr, '');
                ASSERT.equal(/Usage: pinf\.it \[OPTIONS\] COMMAND FILEPATH/.test(stdout), true);
                done();
            });
        });

        it('Command: identity', function (done) {
            CHILD_PRECESS.exec(`${require.resolve(".")} identity`, { cwd: __dirname }, function (err, stdout, stderr) {
                if (err) return done(err);
                ASSERT.equal(stderr, '');
                const result = JSON.parse(stdout);
                result.identity.argv.splice(0, 2);
                ASSERT.deepEqual(result, {
                    "identity": {
                        "id": "gi0.PINF.it/core/0",
                        "cwd": __dirname,
                        "argv": [
                            "identity"
                        ]
                    }
                });
                done();
            });
        });

        it('Run: module doc via filepath', function (done) {
            (async () => {
                const path = `.~${Date.now()}~${(""+Math.random()).split(".")[1]}.json`;
                await FSP.writeFile(PATH.join(__dirname, path), `
                    {
                        "module#": (javascript (exports, process) >>>
                            exports.inf = async function (inf) {
                                return {            
                                    run: function () {
                                        return {
                                            ran: true
                                        };
                                    }
                                };
                            }
                        <<<),
                        "module # run()": ""
                    }
                `);
                CHILD_PRECESS.exec(`${require.resolve(".")} "${path}"`, { cwd: __dirname }, async function (err, stdout, stderr) {
                    if (err) return done(err);
                    ASSERT.equal(stderr, '');
                    const result = JSON.parse(stdout);
                    ASSERT.deepEqual(result, {
                        module: {
                            ran: true
                        }
                    });
                    await FSP.unlink(PATH.join(__dirname, path));                
                    done();
                });
            })();
        });

        it('Run: module doc via stdin', function (done) {
            (async () => {
                const path = `.~${Date.now()}~${(""+Math.random()).split(".")[1]}.json`;
                await FSP.writeFile(PATH.join(__dirname, path), `
                    {
                        "module#": (javascript (exports, process) >>>
                            exports.inf = async function (inf) {
                                return {            
                                    run: function () {
                                        return {
                                            ran: true
                                        };
                                    }
                                };
                            }
                        <<<),
                        "module # run()": ""
                    }
                `);
                const proc = CHILD_PRECESS.spawn(require.resolve("."), [ '---' ], {
                    cwd: __dirname,
                    stdio: [ 'pipe', 'pipe', 'inherit' ]
                });
                const buffer = [];
                proc.stdout.on('data', function (data) {
                    buffer.push(data.toString());
                });
                proc.stdout.on('end', async function () {
                    const result = JSON.parse(buffer.join(''));
                    ASSERT.deepEqual(result, {
                        module: {
                            ran: true
                        }
                    });
                    await FSP.unlink(PATH.join(__dirname, path));
                    done();
                });
                var rstream = FS.createReadStream(PATH.join(__dirname, path));
                rstream.pipe(proc.stdin);
            })().catch(done)
        });

        it('Use wrapper', function () {

        });

    });

    describe('Api: NodeJS', function () {

        it('Create Instance: No Options', function () {
            ASSERT.equal(typeof PINF_IT, "function");
            const pinfIt = PINF_IT();
            ASSERT.equal(typeof pinfIt, "object");
        });

        it('identity()', async function () {
            const pinfIt = PINF_IT({
                cwd: __dirname
            });
            const result = await pinfIt.identity();
            result.identity.argv = [];
            ASSERT.deepEqual(result, {
                "identity": {
                    "id": "gi0.PINF.it/core/0",
                    "cwd": __dirname,
                    "argv": []
                }
            });
        });

        it('Run: module doc via string', async function () {
            const pinfIt = PINF_IT({
                cwd: __dirname
            });
            const doc = `
                {
                    "module#": (javascript (exports, process) >>>
                        exports.inf = async function (inf) {
                            return {            
                                run: function () {
                                    return {
                                        ran: true
                                    };
                                }
                            };
                        }
                    <<<),
                    "module # run()": ""
                }
            `;
            const result = await pinfIt.runDoc(doc);
            ASSERT.deepEqual(result, {
                module: {
                    ran: true
                }
            });
        });

        it('Run: module doc via filepath', async function () {
            const path = `.~${Date.now()}~${(""+Math.random()).split(".")[1]}.json`;
            await FSP.writeFile(PATH.join(__dirname, path), `
                {
                    "module#": (javascript (exports, process) >>>
                        exports.inf = async function (inf) {
                            return {            
                                run: function () {
                                    return {
                                        ran: true
                                    };
                                }
                            };
                        }
                    <<<),
                    "module # run()": ""
                }
            `);
            const pinfIt = PINF_IT({
                cwd: __dirname
            });
            const result = await pinfIt.runFile(path);
            ASSERT.deepEqual(result, {
                module: {
                    ran: true
                }
            });
            await FSP.unlink(PATH.join(__dirname, path));
        });

        it('Use wrapper', async function () {
            const result = await PINF_IT({
                cwd: __dirname
            }).runDoc(`{
                "#": "gi0.PINF.it/#_gi0.PINF.it_#.",

                ":browserify:": "gi0.PINF.it/wrappers/browserify/#_gi0.PINF.it_#.",

                "gi0.PINF.it @ # :browserify: write() /._dist/browser.js": {
                    "source": "../wrappers/browserify/component.js"
                }
            }`);
            ASSERT.deepEqual(result, {
                "gi0.PINF.it": {
                    "/._dist/browser.js": {
                        "path": "._dist/browser.js"
                    }
                }
            });            
        });
    });

    after(async function () {
        let files = await FSP.readdir(__dirname);
        files = files.filter(function (filename) {
            return /^\.~/.test(filename);
        });
        await Promise.all(files.map(function (filename) {
            return FSP.unlink(PATH.join(__dirname, filename));
        }));
    });
});
