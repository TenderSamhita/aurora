'use client';

/**
 * aurora/frontend/src/components/layout/Sidebar.tsx
 *
 * Left navigation rail for the station dashboard.
 *
 * Contains:
 * - Navigation links to dashboard sections
 * - Station switcher
 * - Scenario engine entry point (Phase 5)
 *
 * Kept narrow (220px). No icons as primary content — text-first navigation.
 */

import React from 'react';
import Link from 'next/link';
import type { StationID } from '@/lib/types';
import { STATIONS } from '@/lib/constants';

interface NavItem {
  label: string;
  href: string;
  section: string;
}

interface SidebarProps {
  activeStation: StationID;
  activeSection?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview',        href: '',            section: 'overview' },
  { label: 'Environment',     href: '#environment', section: 'environment' },
  { label: 'Energy & Power',  href: '#power',       section: 'power' },
  { label: 'Logistics',       href: '#logistics',   section: 'logistics' },
  { label: 'Risk Assessment', href: '#risk',        section: 'risk' },
  { label: 'Scenario Engine', href: '#scenarios',   section: 'scenarios' },
];

export default function Sidebar({ activeStation, activeSection = 'overview' }: SidebarProps) {
  const meta = STATIONS[activeStation];

  return (
    <nav
      style={{
        width: '200px',
        flexShrink: 0,
        backgroundColor: 'var(--surface-elevated)',
        borderRight: '1px solid var(--surface-border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Station switcher */}
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--surface-border)',
        }}
      >
        <div
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            marginBottom: '8px',
          }}
        >
          STATION SELECT
        </div>
        {(Object.values(STATIONS) as typeof STATIONS[StationID][]).map((s) => {
          const isActive = s.id === activeStation;
          return (
            <Link
              key={s.id}
              href={`/station/${s.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '7px 9px',
                marginBottom: '2px',
                backgroundColor: isActive ? 'var(--surface-panel)' : 'transparent',
                borderLeft: isActive
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  letterSpacing: '0.04em',
                }}
              >
                {s.name.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-muted)',
                  marginTop: '1px',
                }}
              >
                {s.shortName} · {s.yearEstablished}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Navigation */}
      <div style={{ padding: '8px 0', flex: 1 }}>
        <div
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            padding: '8px 12px 4px',
          }}
        >
          MODULES
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.section;
          return (
            <a
              key={item.section}
              href={`/station/${activeStation}${item.href}`}
              style={{
                display: 'block',
                padding: '7px 12px',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--surface-panel)' : 'transparent',
                borderLeft: isActive
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
                textDecoration: 'none',
                letterSpacing: '0.01em',
              }}
            >
              {item.label}
            </a>
          );
        })}
      </div>

      {/* Station info footer */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--surface-border)',
        }}
      >
        <div
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            lineHeight: 1.7,
          }}
        >
          <div>{meta.location}</div>
          <div>
            {Math.abs(meta.coordinates.lat).toFixed(4)}°{meta.coordinates.lat < 0 ? 'S' : 'N'}{' '}
            {Math.abs(meta.coordinates.lon).toFixed(4)}°{meta.coordinates.lon < 0 ? 'W' : 'E'}
          </div>
          <div>{meta.altitude_m} m ASL</div>
          <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
            {meta.isWinterized ? 'WINTERIZED' : 'SUMMER ONLY'}
          </div>
        </div>
      </div>
    </nav>
  );
}
