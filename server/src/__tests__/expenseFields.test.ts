import { resolveExpenseLinks } from '../services/expense.service';
import { createExpenseSchema, updateExpenseSchema } from '../validators/expense.validator';

const CURRENT = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const EVENT = 'cccccccccccccccccccccccc';

const onCreate = (input: any, current: string | null = CURRENT) =>
  resolveExpenseLinks(input, current, { isCreate: true });

const onUpdate = (input: any, current: string | null = CURRENT) =>
  resolveExpenseLinks(input, current, { isCreate: false });

describe('resolveExpenseLinks on create', () => {
  it('stamps today when no date is given', () => {
    const before = Date.now();
    const { expenseDate } = onCreate({});
    expect(expenseDate!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('keeps a date the user picked', () => {
    expect(onCreate({ expenseDate: '2026-04-02' }).expenseDate).toEqual(new Date('2026-04-02'));
  });

  it('falls back to the current committee when none is chosen', () => {
    expect(onCreate({ committee: '' }).committee).toBe(CURRENT);
    expect(onCreate({}).committee).toBe(CURRENT);
  });

  it('keeps a committee the user chose over the current one', () => {
    expect(onCreate({ committee: OTHER }).committee).toBe(OTHER);
  });

  it('leaves the committee empty when no committee is marked current', () => {
    expect(onCreate({}, null).committee).toBeNull();
  });

  it('leaves the event empty rather than guessing one', () => {
    // An expense belongs to no event unless someone says so.
    expect(onCreate({}).event).toBeNull();
    expect(onCreate({ event: '' }).event).toBeNull();
  });

  it('keeps an event the user linked', () => {
    expect(onCreate({ event: EVENT }).event).toBe(EVENT);
  });
});

describe('resolveExpenseLinks on update', () => {
  it('leaves an untouched field alone', () => {
    expect(onUpdate({})).toEqual({});
  });

  it('applies only the field that was sent', () => {
    expect(onUpdate({ event: EVENT })).toEqual({ event: EVENT });
  });

  it('clears the event when it is sent empty', () => {
    expect(onUpdate({ event: '' }).event).toBeNull();
  });

  it('falls back to the current committee when it is sent empty', () => {
    expect(onUpdate({ committee: '' }).committee).toBe(CURRENT);
  });

  it('does not re-stamp the date just because other fields changed', () => {
    expect(onUpdate({ event: EVENT }).expenseDate).toBeUndefined();
  });

  it('accepts a corrected date', () => {
    expect(onUpdate({ expenseDate: '2026-01-09' }).expenseDate).toEqual(new Date('2026-01-09'));
  });
});

describe('expense schemas', () => {
  const base = { title: 'Banner printing', amount: 1200 };

  it('accepts a submission with no date or links, leaving the server to fill them', () => {
    const parsed = createExpenseSchema.parse(base);
    expect(parsed.expenseDate).toBeUndefined();
    expect(parsed.event).toBeUndefined();
    expect(parsed.committee).toBeUndefined();
  });

  it('accepts empty links, which is how a form says "use the default"', () => {
    expect(createExpenseSchema.parse({ ...base, event: '', committee: '' }).event).toBe('');
  });

  it('rejects an unparseable expense date', () => {
    expect(() => createExpenseSchema.parse({ ...base, expenseDate: 'last friday' })).toThrow();
  });

  it('rejects a malformed committee id', () => {
    expect(() => createExpenseSchema.parse({ ...base, committee: 'not-an-id' })).toThrow();
  });

  it('still requires a title and a positive amount', () => {
    expect(() => createExpenseSchema.parse({ ...base, title: '   ' })).toThrow();
    expect(() => createExpenseSchema.parse({ ...base, amount: 0 })).toThrow();
  });

  it('lets an update send one field on its own', () => {
    expect(updateExpenseSchema.parse({ amount: 300 })).toEqual({ amount: 300 });
    expect(updateExpenseSchema.parse({ committee: OTHER })).toEqual({ committee: OTHER });
  });

  it('still validates the fields an update does send', () => {
    expect(() => updateExpenseSchema.parse({ amount: -1 })).toThrow();
    expect(() => updateExpenseSchema.parse({ expenseDate: 'nope' })).toThrow();
  });
});
