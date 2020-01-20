
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs-extra");


exports['gi0.pinf.it/core/v0/tool'] = async function (workspace) {

    delete workspace.events;
    delete workspace.fs;
    delete workspace.registerPathOnChangedHandler;
    console.log("[readme.com] Workspace:", JSON.stringify(workspace, null, 4));

    ASSERT.equal(workspace['#'], 'gi0.pinf.it/core/v0/tool/workspace');
    ASSERT.equal(typeof workspace['id'], 'string');
    ASSERT.equal(typeof workspace['dirs'], 'object');

    return async function (instance) {

        console.log("[readme.com] Instance:", JSON.stringify(instance, null, 4));

        ASSERT.equal(instance['#'], 'gi0.pinf.it/core/v0/tool/instance');
        ASSERT.equal(typeof instance['id'], 'string');
        ASSERT.equal(typeof instance['dirs'], 'object');

        // ASSERT.deepEqual(workspace['tool'], {
        //     id: 'readme.com/generator/v0'
        // });
    
        return async function (invocation) {

            console.log("[readme.com] Invocation:", JSON.stringify(invocation, null, 4));

            ASSERT.equal(invocation['#'], 'gi0.pinf.it/core/v0/tool/invocation');
            ASSERT.equal(typeof invocation['id'], 'string');
            ASSERT.equal(typeof invocation['dirs'], 'object');
            ASSERT.equal(invocation['method'], 'write');
            ASSERT.deepEqual(Object.keys(invocation['declaration']), ['line', 'column', 'pos', 'file']);
            ASSERT.equal(invocation['cwd'].indexOf(PATH.dirname(__dirname)) > -1, true);
            ASSERT.equal(invocation['value'].replace(/\d$/, ''), './config.json ~ message');

            const invocationParts = invocation.value.match(/^([^~]+) ~ ([^~]+)$/);
            const path = PATH.join(invocation.cwd, invocationParts[1]);
            const config = JSON.parse(await FS.readFile(path, 'utf8'));

            return {
                value: `README: ${config[invocationParts[2]]}`
            };
        }
    };
}
