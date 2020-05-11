
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace, LIB) {

    return async function (instance) {

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
        }
    };
}
