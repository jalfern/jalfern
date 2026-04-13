import React, { useState, useEffect, useCallback } from 'react';

const WEATHER_API_URL = "https://swd.weatherflow.com/swd/rest/observations/station/133073?token=ac625564-c9b4-4e95-b509-561ca11be10a";
const HISTORY_API_URL = "/api/weather-history.json";

const Weather = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stationName, setStationName] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [history, setHistory] = useState([]);

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

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(HISTORY_API_URL);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      
      // Convert object to sorted array
      const sorted = Object.entries(data)
        .map(([date, entry]) => ({ date, ...entry }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setHistory(sorted);
    } catch (err) {
      console.log('No history available:', err.message);
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    fetchHistory();
    const interval = setInterval(fetchWeather, 60000);
    return () => clearInterval(interval);
  }, [fetchWeather, fetchHistory]);

  if (loading && !data) return <div className="p-8 text-white font-mono">Loading weather...</div>;

  return (
    <div className="h-full bg-black text-white font-mono overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
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

        {history.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-bold mb-4 tracking-tight">Historical Data</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-400 font-normal">Date</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-normal">Temp (°F)</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-normal">Feels (°F)</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-normal">Humidity %</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-normal">Wind (mph)</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-normal">Gust (mph)</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-normal">Rain (in)</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-normal">UV</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 14).map((entry, idx) => (
                    <tr key={entry.date} className="border-b border-gray-800 hover:bg-zinc-900/30">
                      <td className="py-2 px-2">{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td className="text-right px-2">{entry.air_temperature ? (entry.air_temperature * 9/5 + 32).toFixed(1) : '-'}</td>
                      <td className="text-right px-2">{entry.feels_like ? (entry.feels_like * 9/5 + 32).toFixed(1) : '-'}</td>
                      <td className="text-right px-2">{entry.relative_humidity ?? '-'}</td>
                      <td className="text-right px-2">{entry.wind_avg ? (entry.wind_avg * 2.237).toFixed(1) : '-'}</td>
                      <td className="text-right px-2">{entry.wind_gust ? (entry.wind_gust * 2.237).toFixed(1) : '-'}</td>
                      <td className="text-right px-2">{entry.precip_accum_local_day !== undefined ? (entry.precip_accum_local_day / 25.4).toFixed(2) : '-'}</td>
                      <td className="text-right px-2">{entry.uv?.toFixed(1) ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {history.length > 14 && (
              <p className="text-xs text-gray-500 mt-2 text-right">Showing 14 of {history.length} days</p>
            )}
          </div>
        )}
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
