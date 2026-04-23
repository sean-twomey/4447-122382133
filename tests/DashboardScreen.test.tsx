import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import DashboardScreen from '../app/(tabs)/index';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');

  return {
    useFocusEffect: (callback: () => void) => {
      React.useEffect(callback, []);
    },
    useRouter: () => ({ push: jest.fn() }),
  };
});

jest.mock('@/context/auth', () => ({
  useAuth: () => ({ user: { id: 1 } }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('../db/client', () => ({
  db: { select: jest.fn() },
}));

const { db } = jest.requireMock('../db/client') as { db: { select: jest.Mock } };

function makeSelectMock(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue(result),
        }),
      }),
      where: jest.fn().mockResolvedValue(result),
    }),
  };
}

const habits = [
  { habitId: 1, habitName: 'Morning Run', categoryName: 'Fitness', categoryColour: '#4CAF50', categoryIcon: '🏃' },
];

beforeEach(() => {
  jest.clearAllMocks();
  let call = 0;
  const responses = [habits, [], [], [], []];
  db.select.mockImplementation(() => makeSelectMock(responses[call++ % responses.length]));
});

describe('DashboardScreen', () => {
  it('renders the dashboard heading', async () => {
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Weekly progress')).toBeTruthy();
    });
  });

  it('shows a habit name', async () => {
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeTruthy();
    });
  });

  it("shows the Complete Today's Check-In button", async () => {
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText("Complete Today's Check-In")).toBeTruthy();
    });
  });
});
