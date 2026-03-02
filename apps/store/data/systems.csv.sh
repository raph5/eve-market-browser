#!/usr/bin/env bash
set -e

curl https://www.fuzzwork.co.uk/dump/latest/mapSolarSystems.csv |
  mlr --csv cut -f solarSystemID,solarSystemName,regionID,security \
  > systems.csv
