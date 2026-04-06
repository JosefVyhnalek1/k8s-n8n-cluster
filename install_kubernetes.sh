#!/bin/bash
# Based on: 
# - https://kubernetes.io/docs/setup/production-environment/container-runtimes/
# - https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/
# - https://medium.com/@sirtcp/deploying-a-three-node-kubernetes-cluster-on-debian-12-with-kubeadm-and-rook-ceph-for-persistent-eb080f31d3fc

sudo swapoff -a

cat <<EOF | sudo tee /etc/modules-load.d/containerd.conf 
overlay 
br_netfilter
EOF

sudo modprobe overlay 
sudo modprobe br_netfilter

# sysctl params required by setup, params persist across reboots
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.ipv4.ip_forward = 1
EOF

# Apply sysctl params without reboot
sudo sysctl --system

# Install containerd
# ref: https://docs.docker.com/engine/install/debian/
# Add Docker's official GPG key:
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install containerd

sudo apt-get update
# apt-transport-https may be a dummy package; if so, you can skip that package
sudo apt-get install -y apt-transport-https ca-certificates curl gpg


# If the directory `/etc/apt/keyrings` does not exist, it should be created before the curl command, read the note below.
# sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.35/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

# This overwrites any existing configuration in /etc/apt/sources.list.d/kubernetes.list
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.35/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl

sudo systemctl enable --now kubelet


# Generate default containerd config
sudo containerd config default | sudo tee /etc/containerd/config.toml

# Edit /etc/containerd
sudo sed -i 's|SystemdCgroup = false|SystemdCgroup = true|' /etc/containerd/config.toml
sudo sed -i 's|bin_dir = "/usr/lib/cni"|bin_dir = "/opt/cni/bin/"|' /etc/containerd/config.toml


sudo systemctl restart containerd.service
sudo systemctl restart kubelet.service