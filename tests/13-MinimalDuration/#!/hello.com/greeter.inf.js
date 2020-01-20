
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace, LIB) {

    return async function (instance) {

        return async function (invocation) {

            return {
                value: invocation.value
            };
        }
    };
}
