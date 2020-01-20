
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
    
/*
exports.inf = async function (INF, NS) {

    if (process.env.PINF_IT_TEST_VERBOSE) console.log("[builder.com] inf():", NS);

    return {

        id: function () {
            return {
                canonical: NS,
                aliases: [
                    "builder.com/foo/bar"
                ]
            };
        },

        // @see https://github.com/pinf-it/inf/blob/master/tests/34-Interfaces/stream.inf.js
        interface: function (alias, node) {

            return async function (value) {

                value.value = value.value.toUpperCase() + " (built)";

                return value;
            }
        }        
    };
}
*/
