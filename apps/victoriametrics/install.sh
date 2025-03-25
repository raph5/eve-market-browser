#!/usr/bin/env bash
set -e

victoria_dir=/etc/victoria
victoria_bin=https://github.com/VictoriaMetrics/VictoriaMetrics/releases/download/v1.114.0/victoria-metrics-linux-386-v1.114.0.tar.gz
victoria_user=raph

# create dir
mkdir -p $victoria_dir
chown $victoria_user:$victoria_user $victoria_dir

# download
curl -L $victoria_bin -o victoria-bin.tar.gz
tar xvfz victoria-bin.tar.gz
mv victoria-metrics-prod $victoria_dir/victoria

# config
cp prometheus.yml $prom_dir

# systemd
cp victoria.service $prom_dir
ln -s $prom_dir/victoria.service /etc/systemd/system/victoria.service
systemctl daemon-reload
