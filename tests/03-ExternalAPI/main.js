#!/usr/bin/env bash.origin.test via github.com/mochajs/mocha


console.log(">>>TEST_IGNORE_LINE:✓<<<");
console.log(">>>TEST_IGNORE_LINE:^Duration:<<<");

process.env.PINF_IT_TEST_VERBOSE = "1";


const ASSERT = require("assert");
const PATH = require("path");
const CHILD_PRECESS = require("child_process");
const PINF_IT = require("../..");
const LIB = PINF_IT.LIB;
const FS = LIB.FS;

describe('core', function () {

    describe('Api: CLI', function () {

        it('No Arguments: Show Usage', function (done) {
            CHILD_PRECESS.exec('pinf.it', { cwd: __dirname }, function (err, stdout, stderr) {
                if (err) return done(err);
                ASSERT.equal(stderr, '[pinf.it] ERROR: No COMMAND to run specified!\n');
                ASSERT.equal(/Usage: pinf\.it \[OPTIONS\] \[COMMAND\] \[FILEPATH\]/.test(stdout), true);
                done();
            });
        });

        it('Command: help', function (done) {
            CHILD_PRECESS.exec('pinf.it help', { cwd: __dirname }, function (err, stdout, stderr) {
                if (err) return done(err);
                ASSERT.equal(stderr, '');
                ASSERT.equal(/Usage: pinf\.it \[OPTIONS\] \[COMMAND\] \[FILEPATH\]/.test(stdout), true);
                done();
            });
        });

        /*
        it('Command: identity', function (done) {
            CHILD_PRECESS.exec(`${require.resolve("../..")} identity`, { cwd: __dirname }, function (err, stdout, stderr) {
                if (err) return done(err);
                ASSERT.equal(stderr, '');
                const result = JSON.parse(stdout);
                result.identity[0].api.argv.splice(0, 2);
                ASSERT.deepEqual(result, {
                    "identity": [
                        {
                            "anchor": [],
                            "implements": [],
                            "api": {
                                "id": "gi0.PINF.it/core/0",
                                "cwd": __dirname,
                                "argv": [
                                    "identity"
                                ]
                            }
                        }
                    ]
                });
                done();
            });
        });
        */

        it('Run: module doc via filepath', function (done) {
            (async () => {
                const path = `.~${Date.now()}~${(""+Math.random()).split(".")[1]}.json`;
                await FS.writeFileAsync(PATH.join(__dirname, path), `
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
                CHILD_PRECESS.exec(`${require.resolve("../..")} --report "${path}"`, {
                    cwd: __dirname,
                    env: process.env
                }, async function (err, stdout, stderr) {
                    if (err) return done(err);
                    ASSERT.equal(stderr, '');
                    const result = JSON.parse(stdout);
                    ASSERT.deepEqual(result, {
                        module: [
                            {
                                anchor: [],
                                implements: [],
                                api: {
                                    ran: true
                                }
                            }
                        ]
                    });
                    await FS.unlinkAsync(PATH.join(__dirname, path));                
                    done();
                });
            })();
        });

        it('Run: module doc via stdin', function (done) {
            (async () => {
                const path = `.~${Date.now()}~${(""+Math.random()).split(".")[1]}.json`;
                await FS.writeFileAsync(PATH.join(__dirname, path), `
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
                const proc = CHILD_PRECESS.spawn(require.resolve("../.."), [
                    '--report',
                    '---'
                ], {
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
                        module: [
                            {
                                anchor: [],
                                implements: [],
                                api: {
                                    ran: true
                                }
                            }
                        ]
                    });
                    await FS.unlinkAsync(PATH.join(__dirname, path));
                    done();
                });
                var rstream = FS.createReadStream(PATH.join(__dirname, path));
                rstream.pipe(proc.stdin);
            })().catch(done)
        });

        it('Run: full example via bootstrap file', function (done) {
            (async () => {
                const path = `.~${Date.now()}~${(""+Math.random()).split(".")[1]}.json`;
                await FS.writeFileAsync(PATH.join(__dirname, path), `
                    {
                        "#": "../01-ShebangDirInf/#!/gi0-PINF-it/#!",

                        "#": {
                            "/._dist/our-builder": "../01-ShebangDirInf/#!/builder.com/#!"
                        },
                    
                        ":my-builder:": "/._dist/our-builder @ builder/v0",
                    
                        "gi0-PINF-it @ # :my-builder: write() /._dist/browser.js": "Hello World (builder)"
                    }
                `);
                CHILD_PRECESS.exec(`${require.resolve("../..")} "${path}"`, {
                    cwd: __dirname,
                    env: process.env
                }, async function (err, stdout, stderr) {
                    if (err) return done(err);
                    ASSERT.equal(stderr, '');
                    const result = JSON.parse(stdout.replace(/^[\s\S]+\n\{/, '{'));
                    ASSERT.deepEqual(result, {
                        "/._dist/our-builder|gi0-PINF-it": [
                            {
                                "anchor": [
                                    [
                                        {
                                            "literal": "/._dist/our-builder"
                                        }
                                    ],
                                    [
                                        {
                                            "alias": "gi0-PINF-it",
                                            "resolved": "gi0-PINF-it"
                                        }
                                    ]
                                ],
                                "implements": [
                                    {
                                        "alias": "gi0-PINF-it",
                                        "resolved": "gi0-PINF-it"
                                    }
                                ],
                                "api": {
                                    "event": "[gi0-PINF-it] register():",
                                    "NS": "gi0-PINF-it",
                                    "value": {
                                        "canonical": "builder.com/builder/v0",
                                        "aliases": [
                                            "builder.com/foo/bar"
                                        ]
                                    }
                                }
                            }
                        ],
                        "gi0-PINF-it": [
                            {
                                "anchor": [
                                    [
                                        {
                                            "alias": "gi0-PINF-it",
                                            "resolved": "gi0-PINF-it"
                                        }
                                    ]
                                ],
                                "implements": [
                                    {
                                        "alias": "gi0-PINF-it",
                                        "resolved": "gi0-PINF-it"
                                    }
                                ],
                                "api": {
                                    "event": "[gi0-PINF-it] write():",
                                    "NS": "gi0-PINF-it",
                                    "pointer": "write() /._dist/browser.js",
                                    "path": "/._dist/browser.js",
                                    "value": "HELLO WORLD (BUILDER) (built)",
                                    "owner": {
                                        "event": "[gi0-PINF-it] register():",
                                        "NS": "gi0-PINF-it",
                                        "value": {
                                            "canonical": "builder.com/builder/v0",
                                            "aliases": [
                                                "builder.com/foo/bar"
                                            ]
                                        }
                                    }
                                }
                            }
                        ]
                    });
                    await FS.unlinkAsync(PATH.join(__dirname, path));                
                    done();
                });
            })();         
        });
    });

    describe('Api: NodeJS', function () {

        it('Create Instance: No Options', function () {
            ASSERT.equal(typeof PINF_IT, "function");
            const pinfIt = PINF_IT();
            ASSERT.equal(typeof pinfIt, "object");
        });
        /*
        it('identity()', async function () {
            const pinfIt = PINF_IT({
                cwd: __dirname
            });
            const result = await pinfIt.identity();
            result.identity[0].api.argv = [];

            ASSERT.deepEqual(result, {
                "identity": [
                    {
                        "anchor": [],
                        "implements": [],
                        "api": {
                            "id": "gi0.PINF.it/core/0",
                            "cwd": __dirname,
                            "argv": []
                        }
                    }
                ]
            });
        });
        */
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
                module: [
                    {
                        anchor: [],
                        implements: [],
                        api: {
                            ran: true
                        }
                    }
                ]
            });
        });

        it('Run: module doc via filepath', async function () {
            const path = `.~${Date.now()}~${(""+Math.random()).split(".")[1]}.json`;
            await FS.writeFileAsync(PATH.join(__dirname, path), `
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
                module: [
                    {
                        anchor: [],
                        implements: [],
                        api: {
                            ran: true
                        }
                    }
                ]
            });
            await FS.unlinkAsync(PATH.join(__dirname, path));
        });

        it('Run: full example via bootstrap doc', async function () {
            const result = await PINF_IT({
                cwd: __dirname
            }).runDoc(`{
                "#": "../01-ShebangDirInf/#!/gi0-PINF-it/#!",

                "#": {
                    "/._dist/our-builder": "../01-ShebangDirInf/#!/builder.com/#!"
                },
            
                ":my-builder:": "/._dist/our-builder @ builder/v0",
            
                "gi0-PINF-it @ # :my-builder: write() /._dist/browser.js": "Hello World (builder)"
            }`);

            ASSERT.deepEqual(result, {
                "/._dist/our-builder|gi0-PINF-it": [
                    {
                        "anchor": [
                            [
                                {
                                    "literal": "/._dist/our-builder"
                                }
                            ],
                            [
                                {
                                    "alias": "gi0-PINF-it",
                                    "resolved": "gi0-PINF-it"
                                }
                            ]
                        ],
                        "implements": [
                            {
                                "alias": "gi0-PINF-it",
                                "resolved": "gi0-PINF-it"
                            }
                        ],
                        "api": {
                            "event": "[gi0-PINF-it] register():",
                            "NS": "gi0-PINF-it",
                            "value": {
                                "canonical": "builder.com/builder/v0",
                                "aliases": [
                                    "builder.com/foo/bar"
                                ]
                            }
                        }
                    }
                ],
                "gi0-PINF-it": [
                    {
                        "anchor": [
                            [
                                {
                                    "alias": "gi0-PINF-it",
                                    "resolved": "gi0-PINF-it"
                                }
                            ]
                        ],
                        "implements": [
                            {
                                "alias": "gi0-PINF-it",
                                "resolved": "gi0-PINF-it"
                            }
                        ],
                        "api": {
                            "event": "[gi0-PINF-it] write():",
                            "NS": "gi0-PINF-it",
                            "pointer": "write() /._dist/browser.js",
                            "path": "/._dist/browser.js",
                            "value": "HELLO WORLD (BUILDER) (built)",
                            "owner": {
                                "event": "[gi0-PINF-it] register():",
                                "NS": "gi0-PINF-it",
                                "value": {
                                    "canonical": "builder.com/builder/v0",
                                    "aliases": [
                                        "builder.com/foo/bar"
                                    ]
                                }
                            }
                        }
                    }
                ]
            });            
        });
    });

    describe('Api: Features', function () {

        this.timeout(5 * 1000);

        describe('runDoc()', function () {

            it('Resolve uris against own directory', async function () {

                let result = await PINF_IT({
                    cwd: __dirname
                }).runDoc(`{
                    "#": "01-ShebangDirInf/#!/gi0-PINF-it/#!",

                    "#": {
                        "/._dist/our-builder": "01-ShebangDirInf/#!/builder.com/#!"
                    },
                
                    ":my-builder:": "/._dist/our-builder @ builder/v0",
                
                    "gi0-PINF-it @ # :my-builder: write() /._dist/browser.js": "Hello World (builder)"
                }`);

                ASSERT.deepEqual(Object.keys(result), [
                    "/._dist/our-builder|gi0-PINF-it",
                    "gi0-PINF-it"
                ]);
            });

            it('Resolve uris against parent directories', async function () {

                const subDir = PATH.join(__dirname, '.~subDir');

                if (!(await FS.existsAsync(subDir))) {
                    await FS.mkdirAsync(subDir);
                }

                let result = await PINF_IT({
                    cwd: subDir
                }).runDoc(`{
                    "#": "01-ShebangDirInf/#!/gi0-PINF-it",

                    "#": {
                        "/._dist/our-builder": "01-ShebangDirInf/#!/builder.com"
                    },
                
                    ":my-builder:": "/._dist/our-builder @ builder/v0",
                
                    "gi0-PINF-it @ # :my-builder: write() /._dist/browser.js": "Hello World (builder)"
                }`);

                ASSERT.deepEqual(Object.keys(result), [
                    "/._dist/our-builder|gi0-PINF-it",
                    "gi0-PINF-it"
                ]);
            });
        });

        // DEPRECATED
        it('runTool()', async function () {

            async function run () {

                const resultPath = await PINF_IT({
                    cwd: __dirname
                }).runTool('gi0.PINF.it/core/tests/03-ExternalAPI # builder/v0', {
                    foo: 'bar'
                });

                const result = await LIB.FS.readFile(resultPath, 'utf8');

                ASSERT.equal(result, 'Value: {"foo":"bar"}');
            }

            await run();

            const startTime = Date.now();
            await run();
            const endTime = Date.now();

            console.log('Duration:', (endTime - startTime), 'ms');
        });

        // DEPRECATED
        it('getRouteApp()', async function () {

            async function run () {

                const app = await PINF_IT({
                    cwd: __dirname
                }).getRouteApp('gi0.PINF.it/core/tests/03-ExternalAPI # router/v0');

                const route = await app({
                    foo: 'bar'
                });

                await new Promise(function (resolve) {
                    route(null, null, function (info) {

                        ASSERT.deepEqual(info, {
                            foo: 'bar'
                        });

                        resolve();
                    });
                });
            }

            await run();

            const startTime = Date.now();
            await run();
            const endTime = Date.now();

            console.log('Duration:', (endTime - startTime), 'ms');
        });

        it('runToolForModel()', async function () {

            async function run () {

                const path = await PINF_IT({
                    cwd: __dirname
                }).runToolForModel(
                    'gi0.PINF.it/build/v0',
                    '/.dist',
                    '/path.txt',
                    'gi0.PINF.it/core/tests/03-ExternalAPI # builder/v1', {
                        foo: 'bar',
                        func: function /* CodeBlock */ (args) {
                            return args;
                        }
                    },
                    [
                        'path'
                    ]
                );

                const result = await LIB.FS.readFile(path, 'utf8');

                ASSERT.equal(result, 'Value: {"foo":"bar","func":{".@":"github.com~0ink~codeblock/codeblock:Codeblock","_code":"return args;","_format":"javascript","_args":["args"],"_compiled":false}}');
            }

            await run();

            const startTime = Date.now();
            await run();
            const endTime = Date.now();

            console.log('Duration:', (endTime - startTime), 'ms');


            const inputPaths = {};
            const outputPaths = {};

            const router = await PINF_IT({
                cwd: __dirname,
                registries: {
                    inputPaths: inputPaths,
                    outputPaths: outputPaths
                }
            }).runToolForModel(
                'gi0.PINF.it/build/v0',
                '/.dist',
                '/path.txt',
                'gi0.PINF.it/core/tests/03-ExternalAPI # builder/v1', {
                    foo: 'bar',
                    func: function /* CodeBlock */ (args) {
                        return args;
                    }
                },
                [
                    'router'
                ]
            );

            console.log("inputPaths:", inputPaths);
            console.log("outputPaths:", outputPaths);

            let body = null;
            router(null, {
                end: function (_body) {
                    body = _body;
                }
            });
            ASSERT.equal(body, 'Value: {"foo":"bar","func":{".@":"github.com~0ink~codeblock/codeblock:Codeblock","_code":"return args;","_format":"javascript","_args":["args"],"_compiled":false}}');
        });

    });

    after(async function () {
        let files = await FS.readdirAsync(__dirname);
        files = files.filter(function (filename) {
            return /^\.~/.test(filename);
        });
        await Promise.all(files.map(function (filename) {
            return FS.removeAsync(PATH.join(__dirname, filename));
        }));
    });
});
