
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace) {

    return async function (instance) {

        let server = null;

        return async function (invocation) {

            if (invocation.method === 'run') {

                if (invocation.value === 'start') {

                    const CONNECT = require('connect');
                    const HTTP = require('http');
                    const STATIC = require('serve-static');

                    const router = CONNECT();

                    const apps = invocation.mounts.getMountsForPrefix(invocation.config.docRoot);
                    Object.keys(apps).forEach(function (route) {
                        router.use(route, apps[route]);
                    });
                    
                    router.use(STATIC(invocation.config.docRoot.substring(1), {
                        'index': ['index.html']
                    }));

                    server = HTTP.createServer(router)

                    await new Promise(function (resolve, reject) {
                        server.listen(invocation.config.port, function (err) {
                            if (err) return reject(err);
                            resolve();
                        });
                    });

                } else
                if (invocation.value === 'stop') {

                    await new Promise(function (resolve, reject) {
                        server.close(function (err) {
                            if (err) return reject(err);
                            resolve();
                        });
                    });
                }
            }

            return true;
        }
    };
}
