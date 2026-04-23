``` kubectl get pods ```  - show running k8s pods

``` kubectl get service ``` - show services  - service is network rule exporting ports from pod

``` kubectl delete service <service name> ``` - delete service

``` kubectl get all ```

``` kubectl get deployment ``` - deployment says what should run - if you want to stop pod proper way to do it is shut down deployment

``` kubectl delete <deployment name > ```

``` kubectl apply -f <deployment> ``` - apply deployment from file

correctly we should call deployment manifest, deployment is part in manifest with pods

``` kubectl  logs <pod name> ```

``` kubectl describe <pod name> ``` - get info about pod while it is still creating