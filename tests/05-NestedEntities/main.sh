#!/usr/bin/env bash


# DEPRECATED: This test broken and will not be fixed as the pinf.it/core/v0 protocol is deprecated.
# TODO: Port to use ToolStep interface.
echo ">>>SKIP_TEST<<<"
exit 0


export PINF_IT_TEST_VERBOSE=1

pinf.it "./#!"

echo -e "\nOK"
