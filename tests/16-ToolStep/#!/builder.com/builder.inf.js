
exports['gi0.PINF.it/build/v0'] = async function (LIB, CLASSES) {

    class BuildStep extends CLASSES.BuildStep {

        async onWorkspace (result, workspace) {
        }
        async onHome (result, home, workspace) {

            const path = LIB.PATH.join(home.path, 'common-builder-resource.txt');

            LIB.console.info(`Writing to:`, path);

            await LIB.FS.outputFile(path, `Hello World - Common Builder - ${home.path}\n`);
        }
        async onInstance (result, instance, home, workspace) {
        }
        async onBuild (result, build, target, instance, home, workspace) {

            LIB.console.info(`Writing to:`, target.path);

            await LIB.FS.outputFile(target.path, build.config.replace(/%homePath%/, home.path));
        }
        async onDone (result, instance, home, workspace) {
        }
    }

    return BuildStep;    
}
