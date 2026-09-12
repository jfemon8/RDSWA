import {
  ANNOUNCEMENT_LIFETIME_DAYS,
  announcementCutoff,
} from '../jobs/announcementRetention';
import {
  NOTICE_ARCHIVE_DAYS,
  NOTICE_DELETE_DAYS,
  noticeCutoff,
} from '../jobs/noticeRetention';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-12T00:00:00.000Z');

describe('announcement retention', () => {
  it('retires an announcement a year after it was posted', () => {
    expect(ANNOUNCEMENT_LIFETIME_DAYS).toBe(365);
    expect(announcementCutoff(NOW).toISOString()).toBe('2025-09-12T00:00:00.000Z');
  });

  it('counts from the posting date, so a day-old announcement stays', () => {
    const cutoff = announcementCutoff(NOW);
    expect(new Date(NOW.getTime() - DAY) > cutoff).toBe(true);
    expect(new Date(NOW.getTime() - 366 * DAY) <= cutoff).toBe(true);
  });
});

describe('notice retention', () => {
  it('archives at one year and deletes at three', () => {
    expect(NOTICE_ARCHIVE_DAYS).toBe(365);
    expect(NOTICE_DELETE_DAYS).toBe(1095);
  });

  it('puts the delete cutoff two years behind the archive cutoff', () => {
    const archive = noticeCutoff(NOTICE_ARCHIVE_DAYS, NOW);
    const remove = noticeCutoff(NOTICE_DELETE_DAYS, NOW);
    expect(archive.toISOString()).toBe('2025-09-12T00:00:00.000Z');
    expect(remove.toISOString()).toBe('2023-09-13T00:00:00.000Z');
    expect(archive.getTime() - remove.getTime()).toBe(730 * DAY);
  });

  it('leaves a notice younger than a year alone at both stages', () => {
    const age = new Date(NOW.getTime() - 200 * DAY);
    expect(age > noticeCutoff(NOTICE_ARCHIVE_DAYS, NOW)).toBe(true);
    expect(age > noticeCutoff(NOTICE_DELETE_DAYS, NOW)).toBe(true);
  });

  it('archives but does not delete a two-year-old notice', () => {
    const age = new Date(NOW.getTime() - 2 * 365 * DAY);
    expect(age <= noticeCutoff(NOTICE_ARCHIVE_DAYS, NOW)).toBe(true);
    expect(age <= noticeCutoff(NOTICE_DELETE_DAYS, NOW)).toBe(false);
  });
});
