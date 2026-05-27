import { Link } from 'react-router-dom';
import OpsLayout from '@/components/ops/OpsLayout';
import { ClipboardList, History } from 'lucide-react';

const CARDS = [
  {
    to: '/ops/data-capture',
    title: 'Field Data Entry',
    description: 'Log CHW notes and attempted contacts from the field.',
    Icon: ClipboardList,
  },
  {
    to: '/ops/activity',
    title: 'My Activity',
    description: 'Review your own recent field entries.',
    Icon: History,
  },
];

export default function OpsHome() {
  return (
    <OpsLayout
      title="Field Ops"
      description="Standalone data entry surface for Ops users. No map navigation required."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARDS.map(({ to, title, description, Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-[hsl(var(--brand-health)/0.08)] p-2 text-[hsl(var(--brand-health))]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{description}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </OpsLayout>
  );
}
