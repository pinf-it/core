#!/usr/bin/env bash

echo ">>>TEST_IGNORE_LINE:\\[pinf.it\\].+Writing to:<<<"
echo ">>>TEST_IGNORE_LINE:Run tool step for:<<<"

[ ! -e ".~" ] || rm -Rf .~

pinf.it .

echo "---"

find .tmp -type f -exec cat {} +