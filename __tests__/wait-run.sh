#!/bin/sh
set -e
num=${NUM_GUARDIANS:-1} # default value for NUM_GUARDIANS = 1
for ((i=0; i<num; i++)); do
    while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' guardian-$i.guardian:6060/readyz)" != "200" ]]; do sleep 5; echo "waiting for guardian $i"; done
done
CI=true npm --prefix ../wormhole-sdk-ts run test:tilt