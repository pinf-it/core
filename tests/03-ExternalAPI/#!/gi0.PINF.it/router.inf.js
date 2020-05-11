
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace, LIB) {

    function makeApp (routeOptions) {

        if (!routeOptions) {
            return undefined;
        }

        return function (req, res, next) {

            next(routeOptions);
        };
    }

    return async function (instance) {

        return async function (invocation) {

            return {
                routeApp: makeApp,
                value: makeApp(invocation.value)
            };
        }
    };
}
