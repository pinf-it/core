#!/usr/bin/env bash

echo ">>>TEST_IGNORE_LINE:\\[pinf.it\\].+Writing to:<<<"
echo ">>>TEST_IGNORE_LINE:Run tool step for:<<<"
echo ">>>TEST_IGNORE_LINE:Resolving uri<<<"
echo ">>>TEST_IGNORE_LINE:Resolved uri<<<"
echo ">>>TEST_IGNORE_LINE:Path changed:<<<"

[ ! -e ".~" ] || rm -Rf .~


pinf.it .

echo "---"
find .tmp -type f
echo "---"
find .tmp -type f -exec cat {} +


echo "---"

#pinf.it . --watch --debug --rebuild
pinf.it . --watch --rebuild

echo "---"
find .tmp -type f
echo "---"
find .tmp -type f -exec cat {} +
