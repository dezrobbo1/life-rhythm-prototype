#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="life-rhythm-c1-${RANDOM}-${RANDOM}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
# No network, no port, no durable volume, no persistent password.
docker run -d --rm --network none --name "$container" --tmpfs /var/lib/postgresql/data -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
{ cat supabase/tests/bootstrap.sql; cat supabase/migrations/*account_boundary.sql; cat supabase/tests/fixtures.sql; cat supabase/tests/isolation.sql; } | docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1
