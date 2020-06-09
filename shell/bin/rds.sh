#!/bin/sh
#
# rds - open psql connected to an rds db
# $1: optional, service name of rds instance (ex. postgres-erc20)
# $2: optional, db name (ex. jsondb)
# ex: rds postgres-erc20 jsondb

set -e -o pipefail

if [ "$1" ]; then
    service=$1
    url=$(kubectl describe services $1 | grep "External Name" | awk '{print $3}')
else 
    s=$(kubectl get services | awk '{print $1 "\t" $4}' | grep postgres | grep -v '<none>' | fzf)
    service="$(echo $s | awk '{print $1}')"
    url=$(echo $s | awk '{print $2}')
fi

js=$(kubectl get secret $service-user -o json | jq .data)
user=$(echo $js | jq .username -r | base64 --decode)
password=$(echo $js | jq .password -r | base64 --decode)

if [ "$2" ]; then
    db=$2
else
    db=$(psql postgres://$user:$password@$url/postgres -l | grep "UTF-8" | awk '{print $1}' | fzf)
fi

psql postgres://$user:$password@$url/$db
