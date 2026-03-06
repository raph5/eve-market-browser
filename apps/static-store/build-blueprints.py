#!/usr/bin/env python3

import sys
import json

assert len(sys.argv) == 3

blueprint_file = open(sys.argv[1], "r")
market_group_file = open(sys.argv[2], "r")

market_group_list = json.load(market_group_file)
market_group_file.close()

used_type = set()
for group in market_group_list:
    for type_id in group["types"]:
        used_type.add(type_id)

blueprints = []
for line in blueprint_file: 
    bp = json.loads(line)
    activities = []
    if "invention" in bp["activities"]:
        activities.append(bp["activities"]["invention"])
    if "manufacturing" in bp["activities"]:
        activities.append(bp["activities"]["manufacturing"])
    if "reaction" in bp["activities"]:
        activities.append(bp["activities"]["reaction"])
    for a in activities:
        products = a.get("products", [])
        for p in products:
            if p["typeID"] in used_type:
                blueprints.append({
                    "product": {
                        "typeId": p["typeID"],
                        "quantity": p["quantity"],
                    },
                    "blueprint": bp["blueprintTypeID"],
                    "time": a["time"],
                    "materials": [
                        {
                            "typeId": m["typeID"],
                            "quantity": m["quantity"],
                        } for m in a.get("materials", [])
                    ]
                })
blueprint_file.close()

json.dump(blueprints, sys.stdout, separators=(',', ':'))
