#!/bin/bash
set -e

ICONS_EXPORT="https://web.ccpgamescdn.com/aws/developers/Uprising_V21.03_Icons.zip"
ICONS_PATH=./apps/website/public/icons

rm -r $ICONS_PATH
mkdir -p $ICONS_PATH

echo "downloading..."
curl $ICONS_EXPORT --silent -o ./icons-export.zip

echo "decompression..."
unzip -q ./icons-export.zip -d icons-export
cp -r icons-export/Icons/items/* $ICONS_PATH

echo "cleanup..."
rm ./icons-export.zip
rm -r ./icons-export

echo "icons downloaded successfully"
