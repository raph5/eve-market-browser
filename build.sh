#!/bin/bash

emb_dir=/home/raph/code/eve-market-browser

cd $emb_dir/apps/store
go build &

cd $emb_dir/apps/website
npm run build &

wait
