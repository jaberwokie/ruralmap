/**
 * Admin > Mapping > Verification Priority Queue.
 *
 * Wraps the existing VerificationPriorityPanel exactly — no scoring, queue,
 * or workflow logic is changed. Filters are passed empty since the queue
 * derivation handles its own data sourcing.
 */

import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import VerificationPriorityPanel from '@/components/map/VerificationPriorityPanel';
import type { Filters } from '@/types/filters';

const EMPTY_FILTERS: Filters = {} as Filters;

export default function AdminMappingVerificationQueue() {
  return (
    <AdminMappingLayout
      title="Verification Priority Queue"
      description="Outreach tracking, Apply Verification, and prioritized triage for unverified providers."
    >
      <div className="rounded border border-border bg-card p-4">
        <VerificationPriorityPanel filters={EMPTY_FILTERS} />
      </div>
    </AdminMappingLayout>
  );
}
