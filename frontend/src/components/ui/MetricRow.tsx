/**
 * aurora/frontend/src/components/ui/MetricRow.tsx
 *
 * Single-line metric display: label | value | unit | optional status.
 * The workhorse of the compact information density model.
 *
 * Design: monospaced values, tabular alignment, no decorative borders.
 */

import React from 'react';
import type { ComponentStatus } from '@/lib/types';
import StatusBadge from './StatusBadge';

interface MetricRowProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: ComponentStatus;
  /** Whether the value should use accent color (attention-worthy normal reading) */
  accent?: boolean;
  /** Optional secondary annotation after the value */
  annotation?: string;
  className?: string;
}

export default function MetricRow({
  label,
  value,
  unit,
  status,
  accent = false,
  annotation,
  className = '',
}: MetricRowProps) {
  const valueColor = status
    ? `var(--status-${status})`
    : accent
    ? 'var(--text-primary)'
    : 'var(--text-primary)';

  return (
    <div
      className={`aurora-metric-row ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'baseline',
        gap: '8px',
        padding: '4px 0',
        borderBottom: '1px solid var(--surface-border)',
        minHeight: '28px',
      }}
    >
      {/* Label */}
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 400,
          letterSpacing: '0.02em',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>

      {/* Value group */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        {status && <StatusBadge status={status} showLabel={false} size="sm" />}
        <span
          style={{
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            color: valueColor,
            tabularNums: true,
          } as React.CSSProperties}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              fontWeight: 400,
            }}
          >
            {unit}
          </span>
        )}
        {annotation && (
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            {annotation}
          </span>
        )}
      </div>
    </div>
  );
}
