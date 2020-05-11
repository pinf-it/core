
exports['gi0.PINF.it/build/v0'] = async function (LIB, CLASSES) {

    class BuildStep extends CLASSES.BuildStep {

        async onBuild (result, build, target, instance, home, workspace) {

//console.log("BUILD", build, target, instance, home);

            LIB.console.info(`Writing to:`, target.path);

            await LIB.FS.outputFile(target.path, `Value: ${JSON.stringify(build.config)}`);

            return {
                "path": function () {
                    return target.path;
                },
                "router": function () {
                    return function (req, res, next) {
                        res.end(`Value: ${JSON.stringify(build.config)}`);
                    }
                }
            }
        }
    }

    return BuildStep;    
}
