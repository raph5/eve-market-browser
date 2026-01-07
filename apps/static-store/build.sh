#!/usr/bin/env bash
set -euo pipefail

# dependencies:
#   - curl
#   - jq
#   - unzip
#   - python3

out_dir=${ESI_CACHE:?ESI_CACHE must be set and non-empty}
[[ -d "$out_dir" ]] || { echo "ESI_CACHE must be set to an existing directory" >&2; exit 1; }

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
[[ -f "$sde_path/types.jsonl" ]] || { echo "types.jsonl is missing from SDE" >&2; exit 1; }
[[ -f "$sde_path/marketGroups.jsonl" ]] || { echo "marketGroups.jsonl is missing from SDE" >&2; exit 1; }
[[ -f "$sde_path/mapRegions.jsonl" ]] || { echo "mapRegions.jsonl is missing from SDE" >&2; exit 1; }

./build-regions.py \
  $sde_path/mapRegions.jsonl \
  > $out_dir/regions.json

./build-market-groups.py \
  $sde_path/types.jsonl \
  $sde_path/marketGroups.jsonl \
  icon_alt.json \
  > $out_dir/market-group.json

./build-types.py \
  $sde_path/types.jsonl \
  $out_dir/market-group.json \
  > $out_dir/types.json

rm -r $sde_path
