// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Card, ScreenHero } from './index';

afterEach(cleanup);

describe('Gate 6B visual foundation component contracts', () => {
  it('keeps existing Button behavior while exposing calm semantic variants', () => {
    render(
      <div>
        <Button>Secondary</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="quiet">Quiet</Button>
        <Button variant="danger">Danger</Button>
      </div>,
    );

    expect(screen.getByRole('button', { name: 'Secondary' }).classList.contains('button--secondary')).toBe(true);
    expect(screen.getByRole('button', { name: 'Primary' }).classList.contains('button--primary')).toBe(true);
    expect(screen.getByRole('button', { name: 'Quiet' }).classList.contains('button--quiet')).toBe(true);
    expect(screen.getByRole('button', { name: 'Danger' }).classList.contains('button--danger')).toBe(true);
    expect(screen.getByRole('button', { name: 'Secondary' }).getAttribute('type')).toBe('button');
  });

  it('adds explicit Card hierarchy without changing the default section contract', () => {
    render(
      <div>
        <Card aria-label="Default surface" title="Default">Body</Card>
        <Card aria-label="Primary surface" title="Primary" variant="primary">Body</Card>
        <Card aria-label="Quiet surface" className="extra-class" variant="quiet">Body</Card>
      </div>,
    );

    const defaultCard = screen.getByLabelText('Default surface');
    const primaryCard = screen.getByLabelText('Primary surface');
    const quietCard = screen.getByLabelText('Quiet surface');

    expect(defaultCard.tagName).toBe('SECTION');
    expect(defaultCard.classList.contains('card--default')).toBe(true);
    expect(primaryCard.classList.contains('card--primary')).toBe(true);
    expect(quietCard.classList.contains('card--quiet')).toBe(true);
    expect(quietCard.classList.contains('extra-class')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Primary', level: 2 })).toBeTruthy();
  });

  it('keeps one semantic h1 on the shared screen heading', () => {
    render(
      <ScreenHero
        className="today-heading"
        eyebrow="Today"
        tagline="One calm sentence."
        title="Current day"
        titleId="current-day-title"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Current day', level: 1 })).toBeTruthy();
    expect(screen.getByText('One calm sentence.')).toBeTruthy();
  });
});
