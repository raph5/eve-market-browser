#!/usr/bin/env python3

import sys
import json
import csv
import http.client

assert len(sys.argv) == 3

system_to_region = {}
system_file = open(sys.argv[1], "r")
for line in system_file:
    system_data = json.loads(line)
    id = system_data["_key"]
    region_id = system_data["regionID"]
    system_to_region[id] = region_id
system_file.close()

station_id_and_region_id = []
station_file = open(sys.argv[2], "r")
for line in station_file:
    station_data = json.loads(line)
    id = station_data["_key"]
    system_id = station_data["solarSystemID"]
    region_id = system_to_region.get(system_id)
    if not region_id:
        sys.stderr.write(f"unknown system {system_id}")
        sys.exit(1)
    station_id_and_region_id.append((id, region_id))
station_file.close()

csv_writer = csv.writer(sys.stdout)
csv_writer.writerow(["npcStationID", "npcStationName", "regionID"])
conn = http.client.HTTPSConnection("esi.evetech.net")
for (id, region_id) in station_id_and_region_id:
    conn.request("GET", f"/universe/stations/{id}")
    response = conn.getresponse()
    name = "Unknown NPC Station"
    if response.status == 200:
        api_response = json.load(response)
        name = api_response.get("name", "Unknown NPC Station")
    csv_writer.writerow([id, name, region_id])
