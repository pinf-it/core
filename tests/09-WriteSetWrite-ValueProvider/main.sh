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

pinf.it . --debug
