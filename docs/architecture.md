# Architecture

A client calls the API. The process writes shipments and status events to SQLite, emits one JSON log line per request, and exposes Prometheus text on `/metrics`.

Prometheus scrapes the API. Alert rules watch `northline_up` and the rate of HTTP 5xx responses. Grafana loads one dashboard from files provisioned at startup.

The same image is what Compose, the Kustomize overlays, and the Helm chart run. Dev and prod overlays differ by image tag only. The container runs as uid 1000 with a read-only root filesystem. Writable space is limited to `/data` and `/tmp`.

Terraform describes an ECR repository, an ECS cluster with Container Insights, and a 14-day CloudWatch log group. It is an example of the registry and runtime around the image. It is not wired to apply from CI.
