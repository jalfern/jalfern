import React, { useState, useEffect, useCallback } from 'react';

const WEATHER_API_URL = "https://swd.weatherflow.com/swd/rest/observations/station/133073?token=ac625564-c9b4-4e95-b509-561ca11be10a";

const Weather = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stationName, setStationName] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchWeather = useCallback(async () => {
    try {
      const response = await fetch(WEATHER_API_URL);
      if (!response.ok) throw new Error('Failed to fetch weather data');
      const json = await response.json();
      
      const station = json.station_name ? { name: json.station_name } : { name: "Unknown Station" };
      const obs = json.obs && json.obs.length > 0 ? json.obs[0] : null;
      
      setStationName(station.name);
      
      if (obs) {
        setData(obs);
        const timestamp = obs.timestamp ? new Date(obs.timestamp * 1000) : null;
        setLastUpdated(timestamp && !isNaN(timestamp) ? timestamp : null);
      } else {
        setData(null);
        setError("No recent observations available.");
      }
      
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 60000); // 60s as requested
    return () => clearInterval(interval);
  }, [fetchWeather]);

  if (loading && !data) return <div className="p-8 text-white font-mono">Loading weather...</div>;

  return (
    <div className="p-8 text-white font-mono min-h-screen bg-black">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold tracking-tighter">{stationName}</h1>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {lastUpdated.toLocaleString()}
            </p>
          )}
        </header>
        
        {error && (
          <div className="bg-red-900/20 border border-red-900 text-red-400 p-4 mb-8 text-sm">
            Error: {error}
            <button 
              onClick={fetchWeather}
              className="ml-4 underline hover:text-red-300"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard 
            label="Temperature" 
            value={data?.air_temperature ? `${(data.air_temperature * 9/5 + 32).toFixed(1)}°F` : 'N/A'} 
          />
          <StatCard 
            label="Feels Like" 
            value={data?.feels_like ? `${(data.feels_like * 9/5 + 32).toFixed(1)}°F` : 'N/A'} 
          />
          <StatCard 
            label="Humidity" 
            value={data?.relative_humidity ? `${data.relative_humidity}%` : 'N/A'} 
          />
          <StatCard 
            label="Wind Speed" 
            value={data?.wind_avg ? `${(data.wind_avg * 2.237).toFixed(1)} mph` : 'N/A'} 
          />
          <StatCard 
            label="Wind Gust" 
            value={data?.wind_gust ? `${(data.wind_gust * 2.237).toFixed(1)} mph` : 'N/A'} 
          />
          <StatCard 
            label="Pressure" 
            value={data?.barometric_pressure ? `${data.barometric_pressure.toFixed(1)} mb` : 'N/A'} 
          />
          <StatCard 
            label="UV Index" 
            value={data?.uv ? data.uv.toFixed(1) : 'N/A'} 
          />
          <StatCard 
            label="Rain Today" 
            value={data?.precip_accum_local_day ? `${(data.precip_accum_local_day / 25.4).toFixed(2)} in` : '0.00 in'} 
          />
          <StatCard 
            label="Rain Last Hour" 
            value={data?.precip_accum_last_1hr ? `${(data.precip_accum_last_1hr / 25.4).toFixed(2)} in` : '0.00 in'} 
          />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm">
    <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">{label}</p>
    <p className="text-xl font-medium text-zinc-100">{value}</p>
  </div>
);

export default Weather;