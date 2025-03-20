#!/usr/bin/env bash

prom_dir=/etc/promtheus
prom_bin=https://github.com/prometheus/prometheus/releases/download/v2.54.0/prometheus-2.54.0.linux-amd64.tar.gz
prom_user=raph

# create dir
mkdir -p $prom_dir
chown $prom_user:$prom_user $prom_dir

# download
curl -L $prom_bin -o prometheus-bin.tar.gz
tar xvfz prometheus-bin.tar.gz prometheus-bin/prometheus
cp prometheus-bin/prometheus $prom_dir
rm -r prometheus-bin.tar.gz prometheus-bin

# config
cp prometheus.yml $prom_dir

# systemd
cp prometheus.service $prom_dir
ln -s $prom_dir/prometheus.service /etc/systemd/system/prometheus.service
systemctl daemon-reload
