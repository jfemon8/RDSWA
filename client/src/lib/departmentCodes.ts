import { shortenLabel } from './shortenLabel';

/** Official department codes published by University of Barishal at bu.ac.bd/departments. */
const OFFICIAL: Record<string, string> = {
  mathematics: 'MTH',
  chemistry: 'CHE',
  physics: 'PHY',
  'geology and mining': 'GLM',
  'statistics and data science': 'SDS',
  'computer science and engineering': 'CSE',
  'soil water and environment': 'SWE',
  botany: 'BOT',
  'coastal studies and disaster management': 'CDM',
  'biochemistry and biotechnology': 'BIO',
  marketing: 'MKT',
  'management studies': 'MGT',
  'accounting and information systems': 'AIS',
  'finance and banking': 'FIN',
  economics: 'ECO',
  sociology: 'SOC',
  'public administration': 'PAD',
  'political science': 'POL',
  'mass communication and journalism': 'MCJ',
  'social work': 'SOW',
  english: 'ENG',
  bangla: 'BAN',
  philosophy: 'PHL',
  history: 'HIS',
  law: 'LAW',
};

/** Older names still sitting in member records, pointed at the department's current code. */
const LEGACY: Record<string, string> = {
  'soil science': 'SWE',
  statistics: 'SDS',
  'history and civilization': 'HIS',
  'islamic studies': 'ISL',
};

/** Strips the wording that varies between records so "Soil, Water & Environment" matches its official entry. */
function normalise(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\bdept\.?\b|\bdepartment\b|\bof\b/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Short code for a department, preferring the university's own and falling back to initials for anything new. */
export function departmentShortName(name: string): string {
  const key = normalise(name);
  return OFFICIAL[key] || LEGACY[key] || shortenLabel(name);
}
