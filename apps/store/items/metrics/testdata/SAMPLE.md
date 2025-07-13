
# Order Sample

And order sample can be generated using this command
```
sqlite3 data.db > order-sample.json << CMD
.mode json
SELECT * FROM 'Order'
WHERE (TypeId = 40519 OR TypeId = 34133)
AND (RegionId = 10000002 OR RegionId = 10000043)
ORDER BY RegionId;
CMD
```

Then the 1 by true and 0 by false to get proper typing
`sed -e 's/Order":1/Order":true/' -e 's/Order":0/Ordecr":false/'`
