
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace) {

    return async function (instance) {

        return async function (invocation) {

            if (invocation.method === 'ensure') {
                return {
                    value: invocation.value.message
                };
            }

            return {
                value: function (req, res, next) {

                    res.end(invocation.value.message);
                }
            };
        }
    };
}
