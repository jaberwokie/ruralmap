/**
 * Admin > Mapping > Verification Audit History.
 *
 * Wraps the existing VerificationAuditHistoryPanel exactly. No logic change.
 */

import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import { VerificationAuditHistoryPanel } from '@/components/map/VerificationPriorityPanel';

export default function AdminMappingAuditHistory() {
  return (
    <AdminMappingLayout
      title="Verification Audit History"
      description="Complete history of verification actions and entity changes."
    >
      <div className="rounded border border-border bg-card p-4">
        <VerificationAuditHistoryPanel />
      </div>
    </AdminMappingLayout>
  );
}
