#!/usr/bin/env bash

# This is the installation prometheus
# See https://prometheus.io/docs/introduction/first_steps/ and
# https://grafana.com/oss/prometheus/exporters/go-exporter/?tab=installation
# for the docs

curl -L https://github.com/prometheus/prometheus/releases/download/v2.54.0/prometheus-2.54.0.linux-amd64.tar.gz \
  -o prometheus-2.54.0.linux-amd64.tar.gz
tar xvfz prometheus-2.54.0.linux-amd64.tar.gz prometheus-2.54.0.linux-amd64/prometheus
cp prometheus-2.54.0.linux-amd64/prometheus .

rm prometheus-2.54.0.linux-amd64.tar.gz
rm -r prometheus-2.54.0.linux-amd64
