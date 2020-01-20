
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace, LIB) {

    return async function (instance) {

        return async function (invocation, HELPERS) {

            const valueProvider = new HELPERS.ValueProvider();

            const changedMonitor = new HELPERS.ValueChangedMonitor([
                invocation.config.templatePath
            ]);
            await changedMonitor.onInitialAndChanged(async function () {

                const tplPath = LIB.PATH.join(invocation.pwd, invocation.config.templatePath.getValue());

                LIB.console.debug("Loading template from path:", tplPath);

                const tpl = await LIB.FS.readFile(tplPath, 'utf8');
    
                valueProvider.setValue(tpl.replace(/%message%/, invocation.value.message));    
            });

            return {
                value: valueProvider
            };
        }
    };
}
