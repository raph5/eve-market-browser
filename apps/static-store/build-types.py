#!/usr/bin/env python3

import sys
import json

assert len(sys.argv) == 3

type_file = open(sys.argv[1], "r")
market_group_file = open(sys.argv[2], "r")

market_group_list = json.load(market_group_file)
market_group_file.close()

used_type = set()
for group in market_group_list:
    for type_id in group["types"]:
        used_type.add(type_id)

type_list = []
for line in type_file: 
    type_data = json.loads(line)
    id = type_data["_key"]
    name = type_data["name"]["en"]
    meta = type_data.get("metaGroupID", 1)
    if id in used_type:
        type_list.append({
            "id": id,
            "name": name,
            "meta": meta,
        })
type_file.close()

type_list_key = lambda x : x["name"]
out = sorted(type_list, key=type_list_key)
json.dump(out, sys.stdout, separators=(',', ':'))
