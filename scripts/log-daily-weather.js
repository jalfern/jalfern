#!/usr/bin/env node

/**
 * Fetches current weather from WeatherFlow and logs it to a daily JSON file.
 * Usage: node scripts/log-daily-weather.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATION_ID = 133073;
const TOKEN = process.env.WEATHERFLOW_TOKEN || 'ac625564-c9b4-4e95-b509-561ca11be10a';
const API_URL = `https://swd.weatherflow.com/swd/rest/observations/station/${STATION_ID}?token=${TOKEN}`;
const DATA_DIR = path.join(__dirname, '..', 'data');
const DAILY_FILE = path.join(DATA_DIR, 'weather-history.json');

async function fetchWeather() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch weather:', err.message);
    process.exit(1);
  }
}

function getTodayKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().split('T')[0]; // YYYY-MM-DD in local time
}

function loadHistory() {
  if (!fs.existsSync(DAILY_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(DAILY_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveHistory(history) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DAILY_FILE, JSON.stringify(history, null, 2), 'utf8');
}

function normalize(obs) {
  if (!obs) return null;
  return {
    timestamp: obs.timestamp,
    datetime: new Date(obs.timestamp * 1000).toISOString(),
    air_temperature: obs.air_temperature,
    feels_like: obs.feels_like,
    relative_humidity: obs.relative_humidity,
    wind_avg: obs.wind_avg,
    wind_gust: obs.wind_gust,
    barometric_pressure: obs.barometric_pressure,
    sea_level_pressure: obs.sea_level_pressure,
    precip: obs.precip,
    precip_accum_local_day: obs.precip_accum_local_day,
    precip_accum_last_1hr: obs.precip_accum_last_1hr,
    precip_minutes_local_day: obs.precip_minutes_local_day,
    uv: obs.uv,
    dew_point: obs.dew_point,
    wind_direction: obs.wind_direction,
    pressure_trend: obs.pressure_trend,
  };
}

async function main() {
  const todayKey = getTodayKey();
  const history = loadHistory();
  
  if (history[todayKey]) {
    console.log(`Weather already logged for ${todayKey}`);
    process.exit(0);
  }

  const json = await fetchWeather();
  const obs = json.obs && json.obs.length > 0 ? json.obs[0] : null;
  
  if (!obs) {
    console.error('No observation data available');
    process.exit(1);
  }

  const entry = {
    ...normalize(obs),
    station_name: json.station_name,
    logged_at: new Date().toISOString(),
  };

  history[todayKey] = entry;
  saveHistory(history);
  
  console.log(`Logged weather for ${todayKey}: ${entry.air_temperature}°C, ${entry.precip_accum_local_day}mm rain`);
}

main();
