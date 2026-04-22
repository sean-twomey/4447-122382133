import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Collapsible } from '../components/ui/collapsible';

describe('Collapsible', () => {
  it('shows and hides its content when pressed', () => {
    render(
      <Collapsible title="More details">
        <Text>Hidden content</Text>
      </Collapsible>
    );

    expect(screen.queryByText('Hidden content')).toBeNull();

    fireEvent.press(screen.getByText('More details'));
    expect(screen.getByText('Hidden content')).toBeTruthy();

    fireEvent.press(screen.getByText('More details'));
    expect(screen.queryByText('Hidden content')).toBeNull();
  });
});
