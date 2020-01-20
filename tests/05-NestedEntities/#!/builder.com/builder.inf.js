
const ASSERT = require("assert");

exports['gi0.pinf.it/core/v0/tool'] = async function (workspace) {

    ASSERT.equal(workspace['#'], 'gi0.pinf.it/core/v0/tool/workspace');

    return async function (instance) {

        ASSERT.equal(instance['#'], 'gi0.pinf.it/core/v0/tool/instance');

        return async function (invocation) {

            ASSERT.equal(invocation['#'], 'gi0.pinf.it/core/v0/tool/invocation');

            return {
                value: invocation.value.toUpperCase() + " (built)"
            };
        }
    };
}
