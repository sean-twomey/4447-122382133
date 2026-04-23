import { useEffect, useState } from 'react';

const CORK_COORDS = {
  latitude: 51.8985,
  longitude: -8.4756,
};

type WeatherState = {
  temperature: number | null;
  condition: string;
  comment: string;
  loading: boolean;
  error: string | null;
};

// Open-Meteo API response types 
type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
};

export function getWeatherCondition(weatherCode: number): string {
  if (weatherCode === 0) return 'Clear';
  if ([1, 2, 3].includes(weatherCode)) return 'Cloudy';
  if ([45, 48].includes(weatherCode)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'Snow';
  if ([95, 96, 99].includes(weatherCode)) return 'Storm';
  return 'Unknown';
}

const DAILY_MESSAGES = [
  'Weather in Cork.',
];

export function getWeatherComment(_temperature: number, _weatherCode: number): string {
  const dayOfYear = Math.floor(Date.now() / 86400000);
  return DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length];
}

export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    temperature: null,
    condition: 'Loading weather...',
    comment: 'Weather in Cork.',
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      try {
        setState((current) => ({ ...current, loading: true, error: null }));

        // Construct the API URL with query parameters for current weather in Cork
        const params = new URLSearchParams({
          latitude: String(CORK_COORDS.latitude),
          longitude: String(CORK_COORDS.longitude),
          current: 'temperature_2m,weather_code',
          forecast_days: '1',
          timezone: 'auto',
        });

        // Fetch the weather data from Open-Meteo API
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Weather request failed with status ${response.status}`);
        }

        // Parse the JSON response and extract temperature and weather code
        const data = (await response.json()) as OpenMeteoResponse;
        const temperature = data.current?.temperature_2m;
        const weatherCode = data.current?.weather_code;

        if (typeof temperature !== 'number' || typeof weatherCode !== 'number') {
          throw new Error('Weather data was incomplete');
        }

        setState({
          temperature: Math.round(temperature),
          condition: getWeatherCondition(weatherCode),
          comment: getWeatherComment(temperature, weatherCode),
          loading: false,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          temperature: null,
          condition: 'Weather unavailable',
          comment: 'Forecast unavailable.',
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load weather',
        });
      }
    }

    loadWeather();

    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
