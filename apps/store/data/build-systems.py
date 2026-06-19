#!/usr/bin/env python3

import sys
import json
import csv

assert len(sys.argv) == 2

system_file = open(sys.argv[1], "r")
csv_writer = csv.writer(sys.stdout)
csv_writer.writerow(["regionID", "solarSystemID", "solarSystemName", "security"])
for line in system_file:
    system_data = json.loads(line)
    id = system_data["_key"]
    region_id = system_data["regionID"]
    security = system_data["securityStatus"]
    name = system_data["name"]["en"]
    csv_writer.writerow([region_id, id, name, security])
system_file.close()
