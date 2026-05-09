import type { ReactNode } from 'react';
import { Card } from '../../components/ui/Card';
import { StatusDot } from '../../components/ui/StatusDot';

interface SectionProps {
  title: string;
  description: string;
  status?: Parameters<typeof StatusDot>[0]['status'];
  statusLabel?: string;
  children: ReactNode;
}

export function Section({ title, description, status, statusLabel, children }: SectionProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
        {status && <StatusDot status={status} label={statusLabel} />}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}
