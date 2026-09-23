/**
 * aurora/frontend/src/components/ui/SectionPanel.tsx
 *
 * Named section container. Provides consistent heading treatment,
 * optional status badge, and a subtle top-border accent line.
 *
 * NOT a card — no shadow, no heavy border, no rounded corners.
 * Structure is created through spacing and typography, not decoration.
 */

import React from 'react';
import type { ComponentStatus } from '@/lib/types';
import StatusBadge from './StatusBadge';

interface SectionPanelProps {
  title: string;
  subtitle?: string;
  status?: ComponentStatus;
  children: React.ReactNode;
  /** Compact mode: reduces padding for dense layouts */
  compact?: boolean;
  className?: string;
  /** Optional top-border accent color override */
  accentColor?: string;
  /** Optional action element rendered in the header right slot */
  headerAction?: React.ReactNode;
  /** Data trust provenance */
  provenance?: 'live' | 'sim' | 'calc' | 'cached' | 'baseline';
}

export default function SectionPanel({
  title,
  subtitle,
  status,
  children,
  compact = false,
  className = '',
  accentColor,
  headerAction,
  provenance,
}: SectionPanelProps) {
  const topBorderColor = status
    ? `var(--status-${status})`
    : accentColor ?? 'var(--surface-border)';

  return (
    <section
      className={`aurora-section-panel ${className}`}
      style={{
        backgroundColor: 'var(--surface-panel)',
        borderTop: `2px solid ${topBorderColor}`,
        borderLeft: '1px solid var(--surface-border)',
        borderRight: '1px solid var(--surface-border)',
        borderBottom: '1px solid var(--surface-border)',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: compact ? '8px 12px' : '10px 14px',
          borderBottom: '1px solid var(--surface-border)',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <h2
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              margin: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </span>
          )}
          {status && <StatusBadge status={status} size="sm" />}
          {provenance && (
            <span className={`provenance provenance-${provenance}`} style={{ marginLeft: '4px' }}>
              {provenance}
            </span>
          )}
        </div>

        {headerAction && (
          <div style={{ flexShrink: 0 }}>{headerAction}</div>
        )}
      </div>

      {/* Panel body */}
      <div style={{ padding: compact ? '8px 12px' : '12px 14px' }}>
        {children}
      </div>
    </section>
  );
}
