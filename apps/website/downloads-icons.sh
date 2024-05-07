#!/bin/bash
set -e

icons_export="https://web.ccpgamescdn.com/aws/developers/Uprising_V21.03_Icons.zip"
icons_path=./public/icons

rm -r $icons_path
mkdir -p $icons_path

echo "downloading..."
curl $icons_export --silent -o ./icons-export.zip

echo "decompression..."
unzip -q ./icons-export.zip -d icons-export
cp -r icons-export/Icons/items/* $icons_path

echo "cleanup..."
rm ./icons-export.zip
rm -r ./icons-export

echo "icons downloaded successfully"
