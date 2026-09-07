import { describe, it, expect } from 'vitest';
import { departmentShortName } from '@/lib/departmentCodes';

describe('departmentShortName', () => {
  it('uses the codes the university publishes', () => {
    expect(departmentShortName('Computer Science and Engineering')).toBe('CSE');
    expect(departmentShortName('Mass Communication and Journalism')).toBe('MCJ');
    expect(departmentShortName('Accounting and Information Systems')).toBe('AIS');
    expect(departmentShortName('Coastal Studies and Disaster Management')).toBe('CDM');
    expect(departmentShortName('Biochemistry and Biotechnology')).toBe('BIO');
  });

  it('matches an ampersand the same as the word "and"', () => {
    expect(departmentShortName('Computer Science & Engineering')).toBe('CSE');
    expect(departmentShortName('Geology & Mining')).toBe('GLM');
    expect(departmentShortName('Soil, Water & Environment')).toBe('SWE');
  });

  it('ignores a "Department of" prefix', () => {
    expect(departmentShortName('Department of Political Science')).toBe('POL');
    expect(departmentShortName('Dept. of Public Administration')).toBe('PAD');
  });

  it('keeps a short single-word department readable rather than coding it away', () => {
    // These stay whole because the code is no clearer than the name at this length.
    expect(departmentShortName('Physics')).toBe('PHY');
    expect(departmentShortName('Law')).toBe('LAW');
  });

  it('points an older department name at its current code', () => {
    expect(departmentShortName('Soil Science')).toBe('SWE');
    expect(departmentShortName('Statistics')).toBe('SDS');
    expect(departmentShortName('History & Civilization')).toBe('HIS');
  });

  it('falls back to initials for a department the map has never seen', () => {
    expect(departmentShortName('Marine Fisheries and Aquaculture')).toBe('MFA');
  });

  it('leaves a short unknown department alone', () => {
    expect(departmentShortName('Nursing')).toBe('Nursing');
  });

  it('handles an empty value', () => {
    expect(departmentShortName('')).toBe('');
  });
});
