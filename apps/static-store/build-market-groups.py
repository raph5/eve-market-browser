#!/usr/bin/env python3

import sys
import json

assert len(sys.argv) == 4

out = []

type_file = open(sys.argv[1], "r")
group_file = open(sys.argv[2], "r")
icon_alt_file = open(sys.argv[3], "r")

icon_alt_record = json.load(icon_alt_file)
icon_alt_file.close()

group_record = {}
for line in group_file:
    group_data = json.loads(line)
    id = group_data["_key"]
    icon_id = str(group_data.get("iconID", 0))  # I could remove str here
    icon_alt = icon_alt_record.get(icon_id, "")
    group_record[id] = {
        "id": id,
        "parentId": group_data.get("parentGroupID", None),
        "childsId": [],
        "types": [],
        "name": group_data["name"]["en"],  # Lets hope market_groups have at least a name..
        "description": group_data.get("description", {}).get("en", ""),
        "iconId": icon_id,
        "iconAlt": icon_alt,
    }
group_file.close()

type_record = {}
for line in type_file:
    type_data = json.loads(line)
    id = type_data["_key"]
    type_record[id] = type_data["name"]["en"]
    group_id = type_data.get("marketGroupID", None)
    if group_id != None:
        group_record[group_id]["types"].append(id)
type_file.close()

for id in group_record:
    parent_id = group_record[id]["parentId"]
    if parent_id != None:
        group_record[parent_id]["childsId"].append(id)

for id in group_record:
    types_key = lambda x : type_record[x]
    group_record[id]["types"] = sorted(group_record[id]["types"], key=types_key)
    childs_id_key = lambda x : group_record[x]["name"]
    group_record[id]["childsId"] = sorted(group_record[id]["childsId"], key=childs_id_key)

out = list(group_record.values())
json.dump(out, sys.stdout, separators=(',', ':'))
