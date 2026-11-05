#!/usr/bin/env python3

import sys
import json
import urllib.request

assert len(sys.argv) == 3

system_file = open(sys.argv[1], "r")
station_file = open(sys.argv[2], "r")

system_record = {}
for line in system_file:
    system_data = json.loads(line)
    id = system_data["_key"]
    security = system_data["securityStatus"]
    system_record[id] = security
system_file.close()

sys.stdout.write("stationID,security,solarSystemID,stationName\n")
for line in station_file:
    station_data = json.loads(line)
    id = station_data["_key"]
    system_id = station_data["solarSystemID"]
    security = system_record.get(system_id, 0)
    try:
        with urllib.request.urlopen(f"https://esi.evetech.net/universe/stations/{id}") as url:
            station_esi_data = json.loads(url.read().decode())
            name = station_esi_data["name"]
    except:
        name = ""
    sys.stdout.write(f"{id},{security},{system_id},{name}\n")
station_file.close()
