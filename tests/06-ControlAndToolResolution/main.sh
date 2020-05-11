#!/usr/bin/env bash


# DEPRECATED: This test broken and will not be fixed as the pinf.it/core/v0 protocol is deprecated.
# TODO: Port to use ToolStep interface.
echo ">>>SKIP_TEST<<<"
exit 0


export PINF_IT_TEST_VERBOSE=1

echo "-- 1 --"

pinf.it ./project1

echo -e "\n-- 2 --"

pinf.it ./project2

echo -e "\n-- 3 --"

pinf.it ./project3

echo -e "\n-- 4 --"

pinf.it ./project4

echo -e "\n-- 5 --"
