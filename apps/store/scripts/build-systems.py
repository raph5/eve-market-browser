#!/usr/bin/env python3

import sys
import json

assert len(sys.argv) == 2

system_file = open(sys.argv[1], "r")
sys.stdout.write("solarSystemID,solarSystemName,security\n")
for line in system_file:
    system_data = json.loads(line)
    id = system_data["_key"]
    name = system_data["name"]["en"]
    security = system_data["securityStatus"]
    sys.stdout.write(f"{id},{name},{security}\n")
system_file.close()
