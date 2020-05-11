#!/usr/bin/env bash.origin.script

echo ">>>TEST_IGNORE_LINE:\\[pinf.it\\].+Writing to:<<<"
echo ">>>TEST_IGNORE_LINE:Run tool step for:<<<"
echo ">>>TEST_IGNORE_LINE:Resolving uri<<<"
echo ">>>TEST_IGNORE_LINE:Resolved uri<<<"

[ ! -e ".~" ] || rm -Rf .~

depend {
    "runner": "gi0.PINF.it/core # runner/v0"
}

CALL_runner run {
    "#": {
        "/.tmp/builder": "../16-ToolStep/#!/builder.com/#!"
    },

    ":builder:": "/.tmp/builder @ builder/v0",

    "gi0.PINF.it/build/v0 @ # /": (inf () >>>
        {
            "gi0.PINF.it/build/v0 @ # :builder: build() /.tmp/script01.js": "console.log('[builder] Hello World - 01 - builder: %homePath%');\n"
        }
    <<<)
}

echo "---"

find .tmp -type f

echo "---"

find .tmp -type f -exec cat {} +
