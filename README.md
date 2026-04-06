### 1) Node setup
On every cluster node:
```sh
# Install containerd, kubectl, kubeadm...
sudo ./install_kubernetes.sh
```

### 2) Control node setup
On control node:
```sh
sudo ./init_cluster.sh
sudo ./install_helm.sh
```

### 3) Redis cluster setup
On control node:
```sh
# Install
sudo ./create_redis_cluster.sh

# Connect to cluster using CLI
kubectl exec -it redis-cluster-leader-0 -n ot-operators -- redis-cli -c -a <REDIS_PASSWORD> 
```


### 4) Deploy app
On control node:
```sh
kubectl apply -f ./proxy/config.yaml
```