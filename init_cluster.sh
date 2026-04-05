#!/bin/bash
# (optional) remove old config
# sudo kubeadm reset


sudo kubeadm init --pod-network-cidr=192.168.0.0/16

mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Install Calico networking
# ref: https://docs.tigera.io/calico/latest/getting-started/kubernetes/quickstart, https://docs.tigera.io/calico/latest/getting-started/kubernetes/self-managed-onprem/onpremises
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.31.4/manifests/operator-crds.yaml
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.31.4/manifests/tigera-operator.yaml
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.31.4/manifests/custom-resources.yaml

# Install Flannel networking
# kubectl apply -f https://github.com/flannel-io/flannel/raw/master/Documentation/kube-flannel.yml