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
cp victoria-metrics-prod $victoria_dir/victoria
rm victoria-metrics-prod victoria-bin.tar.gz

# config
cp prometheus.yml $victoria_dir

# systemd
cp victoria.service $victoria_dir
ln -s $victoria_dir/victoria.service /etc/systemd/system/victoria.service
systemctl daemon-reload
