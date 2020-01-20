
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace, LIB) {

    return async function (instance) {

        return async function (invocation) {

            const tplPath = LIB.PATH.join(invocation.pwd, invocation.config.templatePath.toString());

            const tpl = await LIB.FS.readFile(tplPath, 'utf8');
            
            return {
                value: tpl.replace(/%message%/, invocation.value.message)
            };
        }
    };
}
