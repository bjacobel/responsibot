#!/bin/bash

set -e

yarn

zip -ru function.zip ./*

aws lambda update-function-code \
  --region us-east-1 \
  --function-name responsibot \
  --zip-file fileb://`pwd`/function.zip
