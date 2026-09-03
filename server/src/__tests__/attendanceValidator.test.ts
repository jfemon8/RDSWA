import {
  checkinSchema,
  manualAttendanceSchema,
  bulkAttendanceSchema,
  selfCheckinSchema,
} from '../validators/event.validator';

const ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f191e810c19729de860ea';

describe('checkinSchema', () => {
  it('accepts a QR scan with no backdate', () => {
    const parsed = checkinSchema.parse({ userId: ID, method: 'qr' });
    expect(parsed.userId).toBe(ID);
    expect(parsed.checkedInAt).toBeUndefined();
  });

  it('accepts a bare YYYY-MM-DD backdate', () => {
    expect(checkinSchema.parse({ userId: ID, checkedInAt: '2026-09-02' }).checkedInAt).toBe('2026-09-02');
  });

  it('accepts a full ISO instant', () => {
    const iso = '2026-09-02T06:00:00.000Z';
    expect(checkinSchema.parse({ userId: ID, checkedInAt: iso }).checkedInAt).toBe(iso);
  });

  it('rejects a malformed user id', () => {
    expect(() => checkinSchema.parse({ userId: 'not-an-id' })).toThrow();
  });

  it('rejects an unparseable date', () => {
    expect(() => checkinSchema.parse({ userId: ID, checkedInAt: 'yesterday' })).toThrow();
  });

  it('rejects an unknown check-in method', () => {
    expect(() => checkinSchema.parse({ userId: ID, method: 'telepathy' })).toThrow();
  });

  it('strips unknown keys so a client cannot smuggle fields through', () => {
    const parsed: any = checkinSchema.parse({ userId: ID, status: 'approved', verifiedBy: OTHER_ID });
    expect(parsed.status).toBeUndefined();
    expect(parsed.verifiedBy).toBeUndefined();
  });
});

describe('manualAttendanceSchema', () => {
  it('requires a user id', () => {
    expect(() => manualAttendanceSchema.parse({})).toThrow();
  });

  it('accepts a valid id with an optional date', () => {
    expect(manualAttendanceSchema.parse({ userId: ID, checkedInAt: '2026-09-02' }).userId).toBe(ID);
  });
});

describe('bulkAttendanceSchema', () => {
  it('accepts several ids', () => {
    expect(bulkAttendanceSchema.parse({ userIds: [ID, OTHER_ID] }).userIds).toHaveLength(2);
  });

  it('rejects an empty selection', () => {
    expect(() => bulkAttendanceSchema.parse({ userIds: [] })).toThrow();
  });

  it('rejects a batch containing one malformed id', () => {
    expect(() => bulkAttendanceSchema.parse({ userIds: [ID, 'nope'] })).toThrow();
  });
});

describe('selfCheckinSchema', () => {
  it('accepts an empty body', () => {
    expect(selfCheckinSchema.parse({})).toEqual({});
  });

  it('accepts a supplied date', () => {
    expect(selfCheckinSchema.parse({ checkedInAt: '2026-09-02' }).checkedInAt).toBe('2026-09-02');
  });

  it('rejects an unparseable date', () => {
    expect(() => selfCheckinSchema.parse({ checkedInAt: '2026-13-45' })).toThrow();
  });
});
