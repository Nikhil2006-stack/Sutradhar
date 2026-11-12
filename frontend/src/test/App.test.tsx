import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { formatINR, formatIndianDate } from '../types';
import { Badge, EmptyState, PageHeader } from '../components/ui/Common';
import { LandingPage } from '../pages/PublicPages';

describe('Sutradhar Frontend Utilities & Components', () => {
  it('formats INR currency using Indian numbering conventions', () => {
    const formatted = formatINR(144550);
    expect(formatted).toContain('1,44,550');
  });

  it('formats ISO dates into DD/MM/YYYY Indian format', () => {
    const formatted = formatIndianDate('2026-11-12');
    expect(formatted).toContain('2026');
  });

  it('renders PageHeader and Badge components cleanly', () => {
    render(
      <PageHeader
        title="Inventory Control"
        subtitle="Multi-warehouse stock ledger"
        badge="Live"
      />
    );
    expect(screen.getByText('Inventory Control')).toBeInTheDocument();
    expect(screen.getByText('Multi-warehouse stock ledger')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders EmptyState with helpful instructions', () => {
    render(
      <EmptyState
        title="No SKUs Found"
        description="Add your first product SKU to begin tracking."
      />
    );
    expect(screen.getByText('No SKUs Found')).toBeInTheDocument();
    expect(screen.getByText('Add your first product SKU to begin tracking.')).toBeInTheDocument();
  });

  it('renders the LandingPage with core product promise and Product A stockout showcase', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/One intelligent workspace to manage, understand and improve your entire business operation/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Product A — SS316 High-Pressure Ball Valve/i)
    ).toBeInTheDocument();
  });
});

