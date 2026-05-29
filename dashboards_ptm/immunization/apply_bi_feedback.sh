#!/usr/bin/env bash
# Apply BI feedback to immunization dashboards in a running Superset pod.
#
# Copies bootstrap specs + runs patch_bi_feedback_inpod.py (ORM, no HTTP auth).
#
# Usage:
#   ./apply_bi_feedback.sh [namespace] [bq_gold_schema]

set -euo pipefail

NAMESPACE="${1:-superset}"
SCHEMA="${2:-dbt_gold}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

POD="$(kubectl -n "${NAMESPACE}" get pod -l app=superset -o jsonpath='{.items[0].metadata.name}')"
echo "Using pod: ${POD} (namespace=${NAMESPACE}, schema=${SCHEMA})"

kubectl -n "${NAMESPACE}" exec "${POD}" -- mkdir -p /tmp/imm-bootstrap
kubectl -n "${NAMESPACE}" cp "${SCRIPT_DIR}/." "${POD}:/tmp/imm-bootstrap/"

kubectl -n "${NAMESPACE}" exec "${POD}" -- \
  python /tmp/imm-bootstrap/patch_bi_feedback_inpod.py \
    --schema "${SCHEMA}" \
    --bq-project ptm-data-prod \
    --registry-env prod

echo "Done. Verify:"
echo "  https://superset.sosportal.com.br/superset/dashboard/gestao-imunizacao-operacional-v2/"
echo "  https://superset.sosportal.com.br/superset/dashboard/gestao-imunizacao-estado-pi/"
echo "  https://superset.sosportal.com.br/superset/dashboard/gestao-imunizacao-municipio-220270/"

