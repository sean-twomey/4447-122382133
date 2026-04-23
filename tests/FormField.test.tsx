import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { FormField } from '../components/FormField';

function renderField() {
  const onChangeText = jest.fn();
  render(
    <FormField
      label="Habit name"
      placeholder="e.g. Morning run"
      value=""
      onChangeText={onChangeText}
    />
  );
  return { onChangeText };
}

describe('FormField', () => {
  it('renders the label', () => {
    renderField();
    expect(screen.getByText('Habit name')).toBeTruthy();
  });

  it('renders the placeholder', () => {
    renderField();
    expect(screen.getByPlaceholderText('e.g. Morning run')).toBeTruthy();
  });

  it('calls onChangeText when the user types', () => {
    const { onChangeText } = renderField();
    fireEvent.changeText(screen.getByLabelText('Habit name'), 'Drink water');
    expect(onChangeText).toHaveBeenCalledWith('Drink water');
  });
});
