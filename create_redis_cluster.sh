#!/bin/bash

REDIS_PASSWORD="redis123"

kubectl create secret generic redis-secret --from-literal=password="$REDIS_PASSWORD" -n ot-operators
helm install redis-cluster ot-helm/redis-cluster --set redisCluster.clusterSize=3 --namespace ot-operators
