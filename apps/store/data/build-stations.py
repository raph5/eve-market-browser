#!/usr/bin/env python3

import sys
import json
import csv

assert len(sys.argv) == 3

system_to_region = {}
system_file = open(sys.argv[1], "r")
for line in system_file:
    system_data = json.loads(line)
    id = system_data["_key"]
    region_id = system_data["regionID"]
    system_to_region[id] = region_id
system_file.close()

csv_writer = csv.writer(sys.stdout)
csv_writer.writerow(["regionID", "npcStationID"])
station_file = open(sys.argv[2], "r")
for line in station_file:
    station_data = json.loads(line)
    id = station_data["_key"]
    system_id = station_data["solarSystemID"]
    csv_writer.writerow([system_to_region[system_id], id])
station_file.close()
