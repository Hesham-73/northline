# Runbook

## Healthy

`GET /health` returns 200 when the process is serving. `GET /ready` returns 200 when SQLite answers `SELECT 1`. Prometheus should show `northline_up` as 1.

## NorthlineDown

The process metric stayed at 0 for two minutes, or the target stopped being scraped. Check the container logs for the last JSON `request` or `listening` line, then `kubectl rollout status` or `docker compose ps`. Restart the workload. Do not delete the data volume unless the shipment file itself is the fault.

## NorthlineHttpErrors

The 5xx rate stayed above 0.1 requests per second for five minutes. Read the matching JSON logs. A 500 is an internal failure. 400 and 409 are caller errors and do not fire this alert.

## Rollback

For Kubernetes, return the deployment to the previous image tag and wait for the readiness probe. The SQLite file on the pod volume remains. A bad release that already wrote rows is a data change, not something a rollout undo erases.

For Compose, check out the previous commit and run `docker compose up --build -d`.

## Status path

`booked` can become `in_transit` or `exception`. `in_transit` can become `delivered` or `exception`. `exception` can return to `in_transit` or finish as `delivered`. `delivered` does not move. Any other move returns 409.
