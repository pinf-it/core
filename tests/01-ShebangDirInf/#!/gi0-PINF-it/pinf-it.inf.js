
exports.inf = async function (INF, NS) {

    let owner = null;

    return {

        invoke: async function (pointer, value, options) {

            if (pointer === "register()") {

                value = (await value.value()).value;

                if (process.env.PINF_IT_TEST_VERBOSE) console.log("[gi0-PINF-it] register():", NS, JSON.stringify(value, null, 4));

                return (owner = {
                    event: "[gi0-PINF-it] register():",
                    NS: NS,
                    value: value
                });
            } else
            if (/^write\(\)\s/.test(pointer)) {

                let path = pointer.replace(/^write\(\)\s*/, '');

                if (options.callerNamespace.anchorPrefix) {
                    path = INF.LIB.PATH.join(options.callerNamespace.anchorPrefix.toString(), path);
                }

                if (process.env.PINF_IT_TEST_VERBOSE) console.log("[gi0-PINF-it] write():", NS, pointer, path, value.value);

                return {
                    event: "[gi0-PINF-it] write():",
                    NS: NS,
                    pointer: pointer,
                    path: path,
                    value: value.value,
                    owner: owner
                };
            }
        }
    };
}
