#!/usr/bin/env bash
set -euo pipefail

# dependencies:
#   - curl
#   - jq
#   - unzip
#   - python3

version_url=https://developers.eveonline.com/static-data/tranquility/latest.jsonl
version_number=$(curl -s $version_url | jq .buildNumber)
[[ -n "$version_number" ]] || { echo "empty version_number" >&2; exit 1; }

sde_url=https://developers.eveonline.com/static-data/tranquility/eve-online-static-data-$version_number-jsonl.zip
sde_zip=/tmp/eve-online-static-data-$version_number-jsonl.zip
sde_path=/tmp/eve-online-static-data-$version_number-jsonl

rm -rf $sde_path
mkdir -p $sde_path
curl -s $sde_url > $sde_zip
unzip -q $sde_zip -d $sde_path
[[ -f "$sde_path/mapSolarSystems.jsonl" ]] || { echo "mapSolarSystems.jsonl is missing from SDE" >&2; exit 1; }
[[ -f "$sde_path/npcStations.jsonl" ]] || { echo "npcStations.jsonl is missing from SDE" >&2; exit 1; }

./build-systems.py \
  $sde_path/mapSolarSystems.jsonl \
  > ./systems.csv

./build-stations.py \
  $sde_path/mapSolarSystems.jsonl \
  $sde_path/npcStations.jsonl \
  > ./stations.csv

rm -r $sde_path
