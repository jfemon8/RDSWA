import { CHAT_MEDIA_RETENTION_DAYS, chatMediaExpiry } from '../config/retention';

const DAY = 24 * 60 * 60 * 1000;
const FROM = new Date('2026-09-12T00:00:00.000Z');

describe('chat media retention policy', () => {
  it('keeps a video for a month', () => {
    expect(CHAT_MEDIA_RETENTION_DAYS.video).toBe(30);
    expect(chatMediaExpiry('video', FROM).getTime() - FROM.getTime()).toBe(30 * DAY);
  });

  it('keeps images, documents and other files for a year', () => {
    for (const kind of ['image', 'pdf', 'file', 'audio']) {
      expect([kind, CHAT_MEDIA_RETENTION_DAYS[kind]]).toEqual([kind, 365]);
      expect([kind, chatMediaExpiry(kind, FROM).getTime() - FROM.getTime()]).toEqual([kind, 365 * DAY]);
    }
  });

  it('falls back to a year for a kind the policy does not name', () => {
    expect(chatMediaExpiry('something-new', FROM).getTime() - FROM.getTime()).toBe(365 * DAY);
  });

  it('gives video the shortest window of all', () => {
    const others = Object.entries(CHAT_MEDIA_RETENTION_DAYS)
      .filter(([kind]) => kind !== 'video')
      .map(([, days]) => days);
    expect(Math.min(...others)).toBeGreaterThan(CHAT_MEDIA_RETENTION_DAYS.video!);
  });
});
