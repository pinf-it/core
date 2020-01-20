
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace, LIB) {

    return async function (instance) {

        return async function (invocation) {

            const stream = new LIB.MEMORYSTREAM();

            setImmediate(function () {
                stream.write(invocation.value);
                stream.end();
            });

            return {
                value: stream
            };
        }
    };
}
