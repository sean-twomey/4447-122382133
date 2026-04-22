import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { BarChart } from '../components/bar-chart';

describe('BarChart', () => {
  it('renders labels and percentage values for supplied data', () => {
    render(
      <BarChart
        data={[
          { label: 'Sleep', value: 0.5 },
          { label: 'Water', value: 0.8 },
        ]}
        muted="#666"
      />
    );

    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByText('Water')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByLabelText('Sleep: 50%')).toBeTruthy();
    expect(screen.getByLabelText('Water: 80%')).toBeTruthy();
  });
});
