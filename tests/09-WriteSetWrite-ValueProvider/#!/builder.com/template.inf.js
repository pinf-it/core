
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace, LIB) {

    return async function (instance) {

        return async function (invocation, HELPERS) {

            const valueProvider = new HELPERS.ValueProvider();

            let count = 1;

            function updateValue () {

                LIB.console.info("Updated template");

                LIB.console.log("Template update count:", count);

                valueProvider.setValue(invocation.value.replace(/%count%/, count));
                count++;
            }

            // Set initial value.
            updateValue();

            // Update value a couple of times.
            let interval = setInterval(function () {
                updateValue();
                if (count === 4) {
                    clearInterval(interval);
                }
            }, 20);

            return {
                value: valueProvider
            };
        }
    };
}
