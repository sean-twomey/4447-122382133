import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ProgressRow } from '../components/ui/progress-row';

jest.mock('../hooks/use-theme-color', () => ({
  useThemeColor: () => '#000',
}));

describe('ProgressRow', () => {
  it('renders the label', () => {
    render(<ProgressRow label="Daily steps" done={3} goal={7} colour="#4CAF50" scheme="light" />);
    expect(screen.getByText('Daily steps')).toBeTruthy();
  });

  it('shows the progress count', () => {
    render(<ProgressRow label="Daily steps" done={3} goal={7} colour="#4CAF50" scheme="light" />);
    expect(screen.getByText('3/7')).toBeTruthy();
  });
});
