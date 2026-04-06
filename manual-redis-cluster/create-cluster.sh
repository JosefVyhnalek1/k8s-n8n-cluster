#!/bin/bash

kubectl create namespace redis-cluster

kubectl create -f ./config.yaml

# After kubectl get pods -n redis-cluster is Running run:
# kubectl run redis-client --namespace redis-cluster -it --rm --image=redis:8.6 -- bash
# redis-cli --cluster create redis-0.redis.redis.svc.cluster.local:6379 redis-1.redis.redis.svc.cluster.local:6379 redis-2.redis.redis.svc.cluster.local:6379 redis-3.redis.redis.svc.cluster.local:6379 redis-4.redis.redis.svc.cluster.local:6379 redis-5.redis.redis.svc.cluster.local:6379 --cluster-replicas 1