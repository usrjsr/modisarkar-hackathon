#!/bin/bash

# Switch to root
sudo su -

# Create the deployment file
cat << 'EOF' > deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: modisarkar-deployment
  labels:
    app: modisarkar-web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: modisarkar-web
  template:
    metadata:
      labels:
        app: modisarkar-web
    spec:
      containers:
      - name: modisarkar-nextjs
        image: adarsh28082006/modisarkar-nextjs-prod:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
---
apiVersion: v1
kind: Service
metadata:
  name: modisarkar-service
spec:
  type: NodePort
  selector:
    app: modisarkar-web
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
      nodePort: 30080
EOF

# Apply the deployment
k3s kubectl apply -f deployment.yaml

# Show the status
echo ""
echo "==== DEPLOYMENT STATUS ===="
k3s kubectl get pods
echo ""
echo "==== SERVICE STATUS ===="
k3s kubectl get svc
