# Northline

Northline is a small shipment control plane with the delivery path attached: API, tests, container image, metrics, dashboards, Kubernetes manifests, a Helm chart, and a Terraform example.

Nothing in this repository creates cloud resources by itself. Terraform is validated, not applied.

## Run it

```bash
npm test
docker compose up --build
```

- API: http://127.0.0.1:8080/health
- Metrics: http://127.0.0.1:8080/metrics
- Prometheus: http://127.0.0.1:9090
- Grafana: http://127.0.0.1:3000

Create a shipment:

```bash
curl -s -X POST http://127.0.0.1:8080/v1/shipments \
  -H 'content-type: application/json' \
  -d '{"origin":"Cairo","destination":"Alexandria","reference":"NL-1001"}'
```

Move it with `POST /v1/shipments/{id}/events` and a status of `in_transit`, `delivered`, or `exception`. A status can only move forward along the allowed path.

## What is included

| Path | Role |
|---|---|
| `src/` | HTTP API, SQLite store, Prometheus metrics, JSON logs |
| `test/` | API behavior against a temporary database |
| `Dockerfile`, `compose.yaml` | Local image plus Prometheus and Grafana |
| `observability/` | Scrape config, alert rules, dashboard |
| `deploy/k8s` | Kustomize base and dev/prod image overlays |
| `deploy/helm/northline` | Chart for the same API |
| `deploy/terraform` | ECR repository, ECS cluster, and log group |
| `.github/workflows/delivery.yml` | Test, image smoke, manifest render, Terraform validate |

## Limits

SQLite lives on the pod or the Compose volume. The deployment stays at one replica because two pods would not share that file. Kubernetes requests and limits are set so a later shared database can add scaling without rewriting the probe and security settings.

The Terraform root uses the AWS provider and a local default region. Running `terraform apply` needs your own credentials and will create billable resources. This project does not run apply.

The image names under `ghcr.io/hesham-73/northline` are the intended registry names. The workflow builds and smokes the image. It does not push it.
