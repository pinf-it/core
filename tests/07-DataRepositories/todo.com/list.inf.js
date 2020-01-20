
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs-extra");


exports['gi0.pinf.it/core/v0/tool'] = async function (workspace) {

    delete workspace.events;
    delete workspace.fs;
    delete workspace.registerPathOnChangedHandler;
    console.log("[todo.com] Workspace:", JSON.stringify(workspace, null, 4));

    ASSERT.equal(workspace['#'], 'gi0.pinf.it/core/v0/tool/workspace');
    ASSERT.equal(typeof workspace['id'], 'string');
    ASSERT.equal(typeof workspace['dirs'], 'object');

    return async function (instance) {

        console.log("[todo.com] Instance:", JSON.stringify(instance, null, 4));

        ASSERT.equal(instance['#'], 'gi0.pinf.it/core/v0/tool/instance');
        ASSERT.equal(typeof instance['id'], 'string');
        ASSERT.equal(typeof instance['dirs'], 'object');
    
        return async function (invocation) {

            console.log("[todo.com] Invocation:", JSON.stringify(invocation, null, 4));

            ASSERT.equal(invocation['#'], 'gi0.pinf.it/core/v0/tool/invocation');
            ASSERT.equal(typeof invocation['id'], 'string');
            ASSERT.equal(typeof invocation['dirs'], 'object');
            ASSERT.equal(invocation['method'], 'write');
            ASSERT.deepEqual(Object.keys(invocation['declaration']), ['line', 'column', 'pos', 'file']);
            ASSERT.equal(invocation['cwd'].indexOf(PATH.dirname(__dirname)) > -1, true);

            return {
                value: invocation.value.join(", ")
            };
        }
    };
}
