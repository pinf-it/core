#!/usr/bin/env bash

echo '>>>TEST_IGNORE_LINE:\"fsid\"<<<'
echo '>>>TEST_IGNORE_LINE:\"hashid\"<<<'
echo '>>>TEST_IGNORE_LINE:\"fshashid\"<<<'

export PINF_IT_TEST_VERBOSE=1

pinf.it .

echo -e "\nOK"
