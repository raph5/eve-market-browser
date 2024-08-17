#!/usr/bin/env bash

emb_dir=/home/raph/code/eve-market-browser

export ESI_CACHE=/home/raph/code/eve-market-browser/apps/website/esi-cache
export NODE_ENV=production
export PATH=$PATH:/home/raph/.nvm/versions/node/v22.2.0/bin

cd $emb_dir/apps/prometheus
./prometheus --config.file=./prometheus.yml &>> $emb_dir/prometheus.log &

cd $emb_dir/apps/store
./store &>> $emb_dir/store.log &

cd $emb_dir/apps/website
node ./server.js &>> $emb_dir/remix.log &

wait -n
kill $(jobs -p)
