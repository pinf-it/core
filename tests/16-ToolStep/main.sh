#!/usr/bin/env bash

echo ">>>TEST_IGNORE_LINE:\\[pinf.it\\].+Writing to:<<<"
echo ">>>TEST_IGNORE_LINE:Run tool step for:<<<"
echo ">>>TEST_IGNORE_LINE:Resolving uri<<<"
echo ">>>TEST_IGNORE_LINE:Resolved uri<<<"

[ ! -e ".~" ] || rm -Rf .~

echo "TEST_MATCH_IGNORE>>>"

pinf.it . --verbose

echo "<<<TEST_MATCH_IGNORE"

echo "---"

find .tmp -type f

echo "---"

find .tmp -type f -exec cat {} +
