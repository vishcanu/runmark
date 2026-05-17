import { useState, useEffect } from 'react';

export interface WeatherData {
  temp: number;
  condition: string;
  isRain: boolean;
  isSnow: boolean;
  isThunder: boolean;
  isCloudy: boolean;
  isClear: boolean;
}

const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

export function useWeather(): WeatherData | null {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const url =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${coords.latitude.toFixed(4)}` +
            `&longitude=${coords.longitude.toFixed(4)}` +
            `&current=temperature_2m,weather_code&timezone=auto&forecast_days=1`;

          const res = await fetch(url);
          if (!res.ok) return;
          const json = await res.json();

          const code: number = json.current?.weather_code ?? 0;
          const temp = Math.round(json.current?.temperature_2m ?? 20);

          setWeather({
            temp,
            condition: WMO[code] ?? 'Clear',
            isRain:    (code >= 51 && code <= 67) || (code >= 80 && code <= 82),
            isSnow:    (code >= 71 && code <= 77) || code === 85 || code === 86,
            isThunder: code >= 95,
            isCloudy:  code >= 2,
            isClear:   code <= 1,
          });
        } catch { /* non-critical — weather is decorative */ }
      },
      () => { /* geolocation denied — fail silently */ },
      { timeout: 6000, maximumAge: 600_000 },
    );
  }, []);

  return weather;
}
