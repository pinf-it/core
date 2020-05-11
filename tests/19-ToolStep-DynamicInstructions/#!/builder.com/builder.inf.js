
let runHomeInstructions = null;

exports['gi0.PINF.it/build/v0'] = async function (LIB, CLASSES) {

    class BuildStep extends CLASSES.BuildStep {

        async onHome (result, home, workspace) {

            await runHomeInstructions({
                filepaths: {
                    "script01": "/common-builder-script01.js"
                }
            });

            const path = LIB.PATH.join(home.path, 'common-builder-resource.txt');

            LIB.console.info(`Writing to:`, path);

            result.outputPaths[path] = true;

            await LIB.FS.outputFile(path, `Hello World - Common Builder - ${home.path}\n`);
        }
        async onBuild (result, build, target, instance, home, workspace) {

            LIB.console.info(`Writing to:`, target.path);

            result.outputPaths[target.path] = true;

            await LIB.FS.outputFile(target.path, build.config.replace(/%homePath%/, home.path));
        }
    }

    return BuildStep;    
}


exports.inf = async function (INF, NS) {
    return {
        invoke: async function (pointer, value, options) {
            if (pointer === 'onHome()') {
                runHomeInstructions = async function (variables) {
                    return INF.load(value, {
                        variables: variables
                    });
                }
                return true;
            }
        }
    };
}
