#!/usr/bin/env python3

import sys
import json

assert len(sys.argv) == 4

type_file = open(sys.argv[1], "r")
blueprint_file = open(sys.argv[2], "r")
market_group_file = open(sys.argv[3], "r")

market_group_list = json.load(market_group_file)
market_group_file.close()

used_type = set()
for group in market_group_list:
    for type_id in group["types"]:
        used_type.add(type_id)

type_record = {}
for line in type_file:
    type_data = json.loads(line)
    id = type_data["_key"]
    type_record[id] = type_data["name"]["en"]
type_file.close()

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
                        "name": type_record[p["typeID"]],
                    },
                    "blueprint": bp["blueprintTypeID"],
                    "blueprintName": type_record[bp["blueprintTypeID"]],
                    "time": a["time"],
                    "materials": [
                        {
                            "typeId": m["typeID"],
                            "quantity": m["quantity"],
                            "name": type_record[m["typeID"]],
                        } for m in a.get("materials", [])
                    ]
                })
blueprint_file.close()

json.dump(blueprints, sys.stdout, separators=(',', ':'))
