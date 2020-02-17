#!/usr/bin/env bash

pinf.it .

echo "---"

cat .~/template.js

echo "---"

cat .~/app.js

echo "--- silent ---"

pinf.it . --silent

echo "--- verbose ---"

pinf.it . --verbose

echo "--- debug ---"

echo "TEST_MATCH_IGNORE>>>"

pinf.it . --debug

echo "<<<TEST_MATCH_IGNORE"

echo "OK"
