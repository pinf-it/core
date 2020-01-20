#!/usr/bin/env bash

export PINF_IT_TEST_VERBOSE=1

echo "-- 1 --"

pinf.it "./full-filepaths/#!/#!inf.json"
echo -e "\n-- 2 --"
pinf.it "./full-filepaths/#!/#!"

echo -e "\n-- 3 --"

pinf.it "./filename-defaults/#!"

echo -e "\n-- 4 --"

pinf.it "./minimal"

echo -e "\n-- 5 --"
