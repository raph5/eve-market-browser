#!/bin/bash

# CONFIGURATION
emb_dir=/home/raph/code/eve-market-browser
node_bin=/home/raph/.nvm/versions/node/v22.2.0/bin/node


export ESI_CACHE=$emb_dir/apps/website/esi-cache
export NODE_ENV=production

cd $emb_dir/apps/prometheus
./prometheus --config.file=./prometheus.yml &>> $emb_dir/prometheus.log &

cd $emb_dir/apps/store
./store &>> $emb_dir/store.log &

cd $emb_dir/apps/website
$node_bin ./server.js &>> $emb_dir/remix.log &

wait -n
kill $(jobs -p)
