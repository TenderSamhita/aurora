/**
 * aurora/frontend/src/components/ui/StatusBadge.tsx
 *
 * Inline status indicator. Used to show ComponentStatus semantics
 * with consistent color, label, and a discrete dot indicator.
 *
 * NO glow, NO gradient. Color only where it carries operational meaning.
 */

import React from 'react';
import type { ComponentStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: ComponentStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_STYLES: Record<
  ComponentStatus,
  { dot: string; text: string; label: string }
> = {
  normal:     { dot: 'var(--status-normal)',     text: 'var(--status-normal)',     label: 'NORMAL' },
  warning:    { dot: 'var(--status-warning)',    text: 'var(--status-warning)',    label: 'WARNING' },
  critical:   { dot: 'var(--status-critical)',   text: 'var(--status-critical)',   label: 'CRITICAL' },
  offline:    { dot: 'var(--status-offline)',    text: 'var(--status-offline)',    label: 'OFFLINE' },
  degraded:   { dot: 'var(--status-degraded)',   text: 'var(--status-degraded)',   label: 'DEGRADED' },
  recovering: { dot: 'var(--status-recovering)', text: 'var(--status-recovering)', label: 'RECOVERING' },
};

export default function StatusBadge({
  status,
  showLabel = true,
  size = 'md',
  className = '',
}: StatusBadgeProps) {
  const styles = STATUS_STYLES[status];
  const dotSize = size === 'sm' ? 6 : 8;
  const fontSize = size === 'sm' ? '10px' : '11px';

  return (
    <span
      className={`aurora-status-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontFamily: 'var(--font-mono)',
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: styles.text,
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: styles.dot,
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      {showLabel && styles.label}
    </span>
  );
}
