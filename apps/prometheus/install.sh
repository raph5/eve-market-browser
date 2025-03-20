#!/usr/bin/env bash
set -e

prom_dir=/etc/prometheus
prom_bin=https://github.com/prometheus/prometheus/releases/download/v2.54.0/prometheus-2.54.0.linux-amd64.tar.gz
prom_user=raph

# create dir
mkdir -p $prom_dir
chown $prom_user:$prom_user $prom_dir

# download
curl -L $prom_bin -o prometheus-2.54.0.linux-amd64.tar.gz
tar xvfz prometheus-2.54.0.linux-amd64.tar.gz prometheus-2.54.0.linux-amd64/prometheus
cp prometheus-2.54.0.linux-amd64/prometheus $prom_dir
rm -r prometheus-2.54.0.linux-amd64.tar.gz prometheus-2.54.0.linux-amd64

# config
cp prometheus.yml $prom_dir

# systemd
cp prometheus.service $prom_dir
ln -s $prom_dir/prometheus.service /etc/systemd/system/prometheus.service
systemctl daemon-reload
