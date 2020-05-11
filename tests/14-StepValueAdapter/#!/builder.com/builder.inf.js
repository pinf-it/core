
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace, LIB) {

    return async function (instance) {

        if (/\/reissue\/v0$/.test(instance.kindId)) {

            return async function (invocation, HELPERS) {

                const step = new HELPERS.Step(instance, invocation, async function (value) {

                    return value;
                }, [
                    __filename
                ]);

                const value = await step.forValue(invocation.value);

                let issueIndex = 0;
                function issue () {
                    issueIndex += 1;
                    return step.forValue(value.toString().replace(/'(Hello World - \d+)'/, `'[ISSUE:${issueIndex}] $1'`));
                }

                workspace.registerPathOnChangedHandler(step.getWatchedPaths(), async function () {
                    await issue();
                });

                workspace.trackPromise(new Promise(function (resolve) {
                    setTimeout(async function () {

                        await issue();

                        setTimeout(async function () {

                            await issue();
    
                            resolve();
                        }, 100);
                    }, 100);
                }));

                return {
                    value: step.getValueProvider()
                };
            }
        } else
        if (/\/transform\/v0$/.test(instance.kindId)) {

            return async function (invocation, HELPERS) {

//console.error("TRANSFORM", instance.kindId);
//console.error("TRANSFORM", instance.kindId, invocation.value);
                let transformIndex = 0;

                const step = new HELPERS.Step(instance, invocation, async function (value) {
                    transformIndex += 1;

                    if (transformIndex === 1) {
                        value = Buffer.from(value.toString().replace(/(Hello World - \d+)'/, `[TRANSFORM:${transformIndex}] $1'`));
                    } else {
                        value = value.toString().replace(/(Hello World - \d+)'/, `[TRANSFORM:${transformIndex}] $1'`);
                    }

//console.error("value::::", invocation.mount.path, value.toString());                    

                    return value;
                });

                await step.forValue(invocation.value);

                return {
                    value: step.getValueProvider()
                };
            };
        } else
        if (/\/start_string\/v0$/.test(instance.kindId)) {

            return async function (invocation) {
                return {
                    value: invocation.value
                };
            };
        } else
        if (/\/start_buffer\/v0$/.test(instance.kindId)) {

            return async function (invocation) {
                return {
                    value: Buffer.from(invocation.value)
                };
            };
        } else
        if (/\/start_stream\/v0$/.test(instance.kindId)) {

            return async function (invocation) {

                const stream = new LIB.MEMORYSTREAM();

                setImmediate(function () {
                    stream.write(invocation.value);
                    stream.end();
                });

                return {
                    value: stream
                };
            };
        } else
        if (/\/start_value_provider_string\/v0$/.test(instance.kindId)) {

            return async function (invocation, HELPERS) {

                const valueProvider = new HELPERS.ValueProvider();

                valueProvider.setValue(invocation.value);

                return {
                    value: valueProvider
                };
            };
        } else
        if (/\/start_value_provider_buffer\/v0$/.test(instance.kindId)) {

            return async function (invocation, HELPERS) {

                const valueProvider = new HELPERS.ValueProvider();

                valueProvider.setValue(Buffer.from(invocation.value));

                return {
                    value: valueProvider
                };
            };
        } else
        if (/\/start_value_provider_stream\/v0$/.test(instance.kindId)) {

            return async function (invocation, HELPERS) {

                const valueProvider = new HELPERS.ValueProvider();

                const stream = new LIB.MEMORYSTREAM();

                valueProvider.setValue(stream);

                setImmediate(function () {
                    stream.write(invocation.value);
                    stream.end();
                });

                return {
                    value: valueProvider
                };
            };
        }
    };
}
