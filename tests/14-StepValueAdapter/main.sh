#!/usr/bin/env bash

echo ">>>TEST_IGNORE_LINE:\\[pinf.it\\].+Writing to:<<<"
echo ">>>TEST_IGNORE_LINE:Run tool step for:<<<"

[ ! -e ".~" ] || rm -Rf .~

pinf.it .

echo "---"

cat .~/script*

echo "---"

pinf.it . --watch

echo "---"

cat .~/script*

echo "---"

pinf.it . --watch

echo "---"

cat .~/script*
