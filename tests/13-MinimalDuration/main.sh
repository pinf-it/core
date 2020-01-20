#!/usr/bin/env bash.origin.script

echo ">>>TEST_IGNORE_LINE:\\ds$<<<"

echo "-- node --"

time node --eval 'console.log("Hello World!");'

echo "-- inf -- (first) --"
rm -Rf .~* */.~* */*/.~*

time inf ./hello.inf.json

echo "-- inf -- (second) --"

time inf ./hello.inf.json

echo "-- pinf.it -- (first) --"
rm -Rf .~* */.~* */*/.~*

time pinf.it .

echo "-- pinf.it -- (second) --"

time pinf.it .

echo "---"

cat .~/result.txt
