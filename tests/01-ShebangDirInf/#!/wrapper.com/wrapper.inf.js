
exports.inf = async function (INF, NS) {

    if (process.env.PINF_IT_TEST_VERBOSE) console.log("[wrapper.com] inf():", NS);

    return {

        id: function () {
            return {
                canonical: INF.LIB.PATH.join(INF.LIB.PATH.basename(__dirname), NS),
                aliases: [
                    "wrapper.com/foo/bar"
                ]
            };
        },

        // @see https://github.com/pinf-it/inf/blob/master/tests/34-Interfaces/stream.inf.js
        interface: function (alias, node) {

            if (process.env.PINF_IT_TEST_VERBOSE) console.log("[wrapper.com] interface():", alias);

            return async function (value) {

                value.value = "[wrapped][" + value.value + "]";

                return value;
            }
        }        
    };
}
