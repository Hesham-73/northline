.PHONY: test image up down smoke kustomize

test:
	npm test

image:
	docker build -t northline:local .

up:
	docker compose up --build -d

down:
	docker compose down

smoke:
	node -e "fetch('http://127.0.0.1:8080/health').then(async r=>{if(!r.ok) process.exit(1); console.log(await r.text())})"

kustomize:
	kubectl kustomize deploy/k8s/overlays/dev
	kubectl kustomize deploy/k8s/overlays/prod
