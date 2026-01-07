#!/usr/bin/env python3

import sys
import json

assert len(sys.argv) == 2

thera_id = 31000005
jovian_ids = [10000004, 10000017, 10000019]
hub_ids = [10000002, 10000043, 10000030, 10000032, 10000042]
hub_data = []
non_hub_data = []

region_file = open(sys.argv[1], "r")
for line in region_file:
    region_data = json.loads(line)
    id = region_data["_key"]
    name = region_data["name"]["en"]
    if (id not in jovian_ids and id < 11000000) or id == thera_id:
        if id in hub_ids:
            hub_data.append({"id": id, "name": name})
        else:
            non_hub_data.append({"id": id, "name": name})
region_file.close()

hub_data_key = lambda x : hub_ids.index(x["id"])
hub_data = sorted(hub_data, key=hub_data_key)
non_hub_data_key = lambda x : x["name"]
non_hub_data = sorted(non_hub_data, key=non_hub_data_key)

out = hub_data + non_hub_data
json.dump(out, sys.stdout, separators=(',', ':'))
