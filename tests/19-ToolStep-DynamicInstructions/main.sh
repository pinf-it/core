#!/usr/bin/env bash

echo ">>>TEST_IGNORE_LINE:\\[pinf.it\\].+Writing to:<<<"
echo ">>>TEST_IGNORE_LINE:Run tool step for:<<<"
echo ">>>TEST_IGNORE_LINE:Resolving uri<<<"
echo ">>>TEST_IGNORE_LINE:Resolved uri<<<"
echo ">>>TEST_IGNORE_LINE:Path changed:<<<"

[ ! -e ".~" ] || rm -Rf .~
[ ! -e ".tmp" ] || rm -Rf .tmp


pinf.it .

echo "---"
find .tmp -type f
echo "---"
find .tmp -type f -exec cat {} +
