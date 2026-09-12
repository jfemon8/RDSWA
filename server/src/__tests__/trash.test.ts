import { stampDeletion } from '../models/plugins/softDelete';
import { trashPurgeFilter } from '../jobs/trashPurge';
import { TRASH_RESOURCES, findTrashResource } from '../config/trashResources';
import * as models from '../models';
import { Types } from 'mongoose';
import { describeRecord, humanize, readValue } from '../utils/describeRecord';

const NOW = new Date('2026-09-12T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

describe('soft-delete stamping', () => {
  it('stamps a top-level delete', () => {
    expect(stampDeletion({ isDeleted: true }, NOW)).toEqual({ isDeleted: true, deletedAt: NOW });
  });

  it('stamps a $set delete inside $set, not beside it', () => {
    expect(stampDeletion({ $set: { isDeleted: true } }, NOW)).toEqual({
      $set: { isDeleted: true, deletedAt: NOW },
    });
  });

  it('clears the stamp when a record is restored', () => {
    expect(stampDeletion({ $set: { isDeleted: false } }, NOW)).toEqual({
      $set: { isDeleted: false },
      $unset: { deletedAt: '' },
    });
  });

  it('leaves an unrelated update alone', () => {
    expect(stampDeletion({ $set: { title: 'Renamed' } }, NOW)).toEqual({
      $set: { title: 'Renamed' },
    });
  });

  it('keeps other $unset keys when clearing the stamp', () => {
    expect(stampDeletion({ $set: { isDeleted: false }, $unset: { archivedAt: '' } }, NOW).$unset).toEqual({
      archivedAt: '',
      deletedAt: '',
    });
  });
});

describe('trash purge filter', () => {
  const matchesAge = (filter: any, doc: any) =>
    filter.$or.some((clause: any) =>
      Object.entries(clause).every(([field, cond]: [string, any]) => {
        const value = doc[field];
        if (cond?.$exists === false) return value === undefined;
        if (cond?.$lte !== undefined) return value != null && value <= cond.$lte;
        return value === cond;
      }),
    );

  it('only looks at soft-deleted records', () => {
    expect(trashPurgeFilter(NOW).isDeleted).toBe(true);
  });

  it('purges a record deleted before the cutoff and spares a newer one', () => {
    const filter = trashPurgeFilter(NOW);
    expect(matchesAge(filter, { deletedAt: new Date(NOW.getTime() - DAY) })).toBe(true);
    expect(matchesAge(filter, { deletedAt: new Date(NOW.getTime() + DAY) })).toBe(false);
  });

  it('falls back to updatedAt when the stamp is missing or null', () => {
    const filter = trashPurgeFilter(NOW);
    const old = new Date(NOW.getTime() - DAY);
    expect(matchesAge(filter, { updatedAt: old })).toBe(true);
    expect(matchesAge(filter, { deletedAt: null, updatedAt: old })).toBe(true);
  });
});

describe('trash resource registry', () => {
  it('gives every resource a unique key', () => {
    const keys = TRASH_RESOURCES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers both the recoverable and the sweep-only collections', () => {
    expect(TRASH_RESOURCES.some((r) => r.recoverable)).toBe(true);
    expect(TRASH_RESOURCES.some((r) => !r.recoverable)).toBe(true);
  });

  it('selects deletedAt for every resource, which the listing and sweep both read', () => {
    for (const resource of TRASH_RESOURCES) {
      expect(resource.select).toContain('deletedAt');
    }
  });

  it('names a record without throwing on an empty document', () => {
    for (const resource of TRASH_RESOURCES) {
      expect(typeof resource.title({})).toBe('string');
      expect(resource.title({}).length).toBeGreaterThan(0);
    }
  });

  it('finds a resource by key and rejects an unknown one', () => {
    expect(findTrashResource('notices')?.label).toBe('Notices');
    expect(findTrashResource('nope')).toBeUndefined();
  });

  it('only registers models that carry the soft-delete flag', () => {
    for (const resource of TRASH_RESOURCES) {
      expect(resource.model.schema.path('isDeleted')).toBeDefined();
      expect(resource.model.schema.path('deletedAt')).toBeDefined();
    }
  });
});

describe('trash coverage', () => {
  it('registers every soft-deletable model except users, which the Users page owns', () => {
    const softDeletable = Object.values(models)
      .filter((m: any) => m?.schema?.path?.('isDeleted'))
      .map((m: any) => m.modelName);
    const registered = new Set(TRASH_RESOURCES.map((r) => r.model.modelName));
    const uncovered = [...new Set(softDeletable)].filter((name) => !registered.has(name));

    expect(uncovered).toEqual(['User']);
  });
});

describe('record description', () => {
  it('turns a field name into a readable label', () => {
    expect(humanize('applicationStartDate')).toBe('Application start date');
    expect(humanize('aUnit')).toBe('A unit');
    expect(humanize('tenure.startDate')).toBe('Tenure start date');
  });

  it('reads each kind of stored value as one line', () => {
    expect(readValue(true)).toBe('Yes');
    expect(readValue(false)).toBe('No');
    expect(readValue(0)).toBe('0');
    expect(readValue(new Date('2026-01-02T00:00:00.000Z'))).toBe('2026-01-02T00:00:00.000Z');
    expect(readValue(['a', 'b'])).toBe('a, b');
    expect(readValue([{ x: 1 }, { x: 2 }])).toBe('2 item(s)');
    expect(readValue({ name: 'Emon' })).toBe('Emon');
  });

  it('shows nothing for values there is nothing to show', () => {
    expect(readValue(null)).toBeNull();
    expect(readValue(undefined)).toBeNull();
    expect(readValue('')).toBeNull();
    expect(readValue('   ')).toBeNull();
    expect(readValue([])).toBeNull();
    expect(readValue({})).toBeNull();
  });

  it('takes markup out of prose and clips what is long', () => {
    expect(readValue('<p>Sit   for   the   exam</p>')).toBe('Sit for the exam');
    expect(readValue('x'.repeat(500))!.endsWith('…')).toBe(true);
    expect(readValue('x'.repeat(500))!.length).toBeLessThan(200);
  });

  it('describes a whole record, skipping bookkeeping and bare references', () => {
    const notice = TRASH_RESOURCES.find((r) => r.key === 'notices')!;
    const details = describeRecord(
      {
        title: 'Exam routine',
        category: 'academic',
        status: 'published',
        isHighlighted: true,
        content: '<p>Sit for the exam</p>',
        createdBy: new Types.ObjectId(),
        isDeleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
      },
      notice.model.schema,
    );
    const labels = details.map((d) => d.label);

    expect(labels).toEqual(expect.arrayContaining(['Title', 'Category', 'Status', 'Is highlighted', 'Content']));
    expect(labels).not.toContain('Created at');
    expect(labels).not.toContain('Is deleted');
    expect(labels).not.toContain('Deleted at');
    expect(labels).not.toContain('Created by');
  });

  it('names a reference once it is populated', () => {
    const notice = TRASH_RESOURCES.find((r) => r.key === 'notices')!;
    const details = describeRecord({ createdBy: { name: 'Emon' } }, notice.model.schema);
    expect(details).toContainEqual({ label: 'Created by', value: 'Emon' });
  });

  it('never exposes a secret-looking field', () => {
    const user = models.User;
    const details = describeRecord(
      { name: 'Emon', password: 'hunted', passwordResetToken: 'abc', otp: { code: '1' } },
      user.schema,
    );
    const labels = details.map((d) => d.label.toLowerCase()).join(' ');
    expect(labels).not.toMatch(/password|token|otp/);
  });

  it('gives every recoverable resource something to show for a filled-in record', () => {
    for (const resource of TRASH_RESOURCES.filter((r) => r.recoverable)) {
      const doc: Record<string, any> = {};
      for (const [path, type] of Object.entries(resource.model.schema.paths) as [string, any][]) {
        if (['isDeleted', 'deletedAt', 'createdAt', 'updatedAt', '_id', '__v'].includes(path)) continue;
        if (type.instance === 'String') doc[path] = 'value';
        else if (type.instance === 'Number') doc[path] = 1;
        else if (type.instance === 'Boolean') doc[path] = true;
        else if (type.instance === 'Date') doc[path] = new Date();
      }
      expect([resource.key, describeRecord(doc, resource.model.schema).length > 0]).toEqual([resource.key, true]);
    }
  });
});

describe('detail values the client renders specially', () => {
  const notice = () => TRASH_RESOURCES.find((r) => r.key === 'notices')!;

  it('marks a timestamp so the client formats it in Dhaka time', () => {
    const details = describeRecord(
      { publishedAt: new Date('2026-04-01T12:36:16.243Z') },
      notice().model.schema,
    );
    expect(details).toContainEqual({
      label: 'Published at',
      value: '2026-04-01T12:36:16.243Z',
      isDate: true,
    });
  });

  it('leaves a plain string unmarked, so a clock-time field is not mistaken for a date', () => {
    const schedule = TRASH_RESOURCES.find((r) => r.key === 'bus-schedules')!;
    const details = describeRecord({ departureTime: '08:30' }, schedule.model.schema);
    expect(details).toContainEqual({ label: 'Departure time', value: '08:30' });
  });

  it('carries the id of a person, so the client can link to their profile', () => {
    const id = new Types.ObjectId();
    const details = describeRecord(
      { createdBy: { _id: id, name: 'Md Jannatul Ferdhous Emon' } },
      notice().model.schema,
    );
    expect(details).toContainEqual({
      label: 'Created by',
      value: 'Md Jannatul Ferdhous Emon',
      userId: String(id),
    });
  });

  it('links every field that points at a person, whatever it is called', () => {
    const cases: Array<[string, string]> = [
      ['documents', 'uploadedBy'],
      ['photos', 'uploadedBy'],
      ['job-posts', 'postedBy'],
      ['forum-topics', 'author'],
      ['forms', 'submittedBy'],
      ['expenses', 'approvedBy'],
      ['contact-messages', 'repliedBy'],
    ];

    for (const [key, field] of cases) {
      const resource = TRASH_RESOURCES.find((r) => r.key === key)!;
      const id = new Types.ObjectId();
      const details = describeRecord({ [field]: { _id: id, name: 'Emon' } }, resource.model.schema);
      expect([key, details.find((d) => d.userId)?.userId]).toEqual([key, String(id)]);
    }
  });

  it('does not link a reference to something that is not a person', () => {
    const expense = TRASH_RESOURCES.find((r) => r.key === 'expenses')!;
    const details = describeRecord(
      { event: { _id: new Types.ObjectId(), title: 'Boat Trip' } },
      expense.model.schema,
    );
    expect(details).toContainEqual({ label: 'Event', value: 'Boat Trip' });
  });
});
