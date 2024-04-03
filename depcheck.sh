#!/bin/bash

# Run depcheck in all workspaces defined in the monorepo
# make sure depcheck is actually installed with `npm install -g depcheck`

# Define the location of the package.json file
PACKAGE_JSON="./package.json"

# Extract workspace directories from package.json
# This assumes workspaces are defined under "workspaces" and are in a simple list format
WORKSPACES=$(jq -r '.workspaces[]' $PACKAGE_JSON)

# Loop through each workspace directory and run depcheck
for WORKSPACE in $WORKSPACES; do
  echo "Running depcheck in workspace: $WORKSPACE"
  (cd $WORKSPACE && npx depcheck --skip-missing)
done
