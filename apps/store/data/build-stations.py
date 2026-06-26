#!/usr/bin/env python3

import sys
import json
import csv
import http.client

assert len(sys.argv) == 3

system_info_by_id = {}
system_file = open(sys.argv[1], "r")
for line in system_file:
    system_data = json.loads(line)
    id = system_data["_key"]
    region_id = system_data["regionID"]
    security = system_data["securityStatus"]
    system_info_by_id[id] = (region_id, security)
system_file.close()

station_info_list = []
station_file = open(sys.argv[2], "r")
for line in station_file:
    station_data = json.loads(line)
    id = station_data["_key"]
    system_id = station_data["solarSystemID"]
    system_info = system_info_by_id.get(system_id)
    if not system_info:
        sys.stderr.write(f"unknown system {system_id}")
        sys.exit(1)
    region_id, security = system_info
    station_info_list.append((id, system_id, region_id, security))
station_file.close()

csv_writer = csv.writer(sys.stdout)
csv_writer.writerow(["npcStationID", "systemID", "regionID", "securityStatus", "npcStationName"])
conn = http.client.HTTPSConnection("esi.evetech.net")
for id, system_id, region_id, security in station_info_list:
    conn.request("GET", f"/universe/stations/{id}")
    response = conn.getresponse()
    name = "Unknown NPC Station"
    if response.status == 200:
        api_response = json.load(response)
        name = api_response.get("name", "Unknown NPC Station")
    csv_writer.writerow([id, system_id, region_id, security, name])
