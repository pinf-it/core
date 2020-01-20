
'use strict';

exports.inf = async function (INF, alias) {

    return {

        invoke: function (pointer, value) {

            if (pointer === "run()") {

                const api = this._infComponent.getAPI();

                if (process.env.PINF_IT_TEST_VERBOSE) console.log("api (main.inf.js)", JSON.stringify(api, null, 4));

                return {
                    output: INF.LIB.output
                };                
            }
        }
    };
}
