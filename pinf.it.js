#!/usr/bin/env node

// ##################################################
// # Dependencies
// ##################################################

const INF = require('@pinf-it/inf');


// ##################################################
// # Source Logic
// ##################################################

class Runner {
    constructor (options) {
        const self = this;

        self.runDoc = async function (doc, filepath) {
            const inf = new INF.INF(options.cwd || process.cwd(), null, options);
            return inf.runInstructions(doc, filepath);
        }

        self.runFile = async function (iniFilePath) {
            const inf = new INF.INF(options.cwd || process.cwd(), null, options);
            return inf.runInstructionsFile(INF.LIB.PATH.basename(iniFilePath));
        }

        self.identity = async function () {
            return self.runFile('#_identity_#.inf.json');
        }
    }
}


// ##################################################
// # API: NodeJS
// ##################################################

module.exports = function (options) {
    return new Runner(options);
}


// ##################################################
// # API: CLI
// ##################################################

if (require.main === module) {
    
    const MINIMIST = require("minimist");

    async function main (args) {

        let cwd = process.cwd();
        if ((args.verbose || args.debug) && !process.env.VERBOSE) {
            process.env.VERBOSE = "1";
        }
        if (args.cwd) {
            cwd = PATH.resolve(cwd, args.cwd);
            process.chdir(cwd);
        }

        const command = args._.shift();

        function showUsage () {
            process.stdout.write(`
Usage: pinf.it [OPTIONS] COMMAND FILEPATH

OPTIONS:

  -v        Verbose
  -d        Debug

COMMAND:

  help      Show this usage info

FILEPATH: Path to *[.inf].json file to execute

`);
        }

        if (!command) {
            if (args['-'] === true) {
                const stdin = [];
                process.stdin.on('data', function (data) {
                    stdin.push(data.toString());
                });
                process.stdin.on('end', async function () {
                    const runner = module.exports({
                        cwd: cwd
                    });
                    const result = await runner.runDoc(stdin.join(''));
                    process.stdout.write(JSON.stringify(result, null, 4));
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
        if (command === 'identity') {
            const runner = module.exports({
                cwd: cwd
            });
            process.stdout.write(JSON.stringify(await runner.identity(), null, 4));
            return;
        } else
        if (/^(\.|\/)/.test(command)) {            
            const runner = module.exports({
                cwd: cwd
            });
            const result = await runner.runFile(command);
            process.stdout.write(JSON.stringify(result, null, 4));
            return;
        } else {
            console.error(`[pinf.it] ERROR: COMMAND '${command}' not supported!`);
            showUsage();
            return;
        }
    }    
    try {
        main(MINIMIST(process.argv.slice(2), {
            boolean: [
                'verbose',
                'debug'
            ]
        })).catch(function (err) {
            throw err;
        });
    } catch (err) {
        console.error("[pinf.it] ERROR:", err.stack);
        process.exit(1);
    }
}
