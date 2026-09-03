import {
  registerSchema,
  addRegistrationSchema,
  updateRegistrationSchema,
  createEventSchema,
  updateEventSchema,
} from '../validators/event.validator';
import { nextRegistrationStatus } from '../services/event.service';

const ID = '507f1f77bcf86cd799439011';
const baseEvent = { title: 'Iftar', description: 'Annual iftar', startDate: '2026-03-20T12:00:00.000Z' };

describe('registerSchema', () => {
  it('accepts a registration with no answers', () => {
    expect(registerSchema.parse({})).toEqual({});
  });

  it('accepts answers to the custom questions', () => {
    const parsed = registerSchema.parse({ responses: { tshirt: 'L', guests: '2' } });
    expect(parsed.responses).toEqual({ tshirt: 'L', guests: '2' });
  });

  it('rejects non-string answers so the stored shape stays predictable', () => {
    expect(() => registerSchema.parse({ responses: { guests: 2 } })).toThrow();
  });
});

describe('addRegistrationSchema', () => {
  it('requires a user id', () => {
    expect(() => addRegistrationSchema.parse({})).toThrow();
    expect(() => addRegistrationSchema.parse({ userId: 'nope' })).toThrow();
  });

  it('defaults to no status so the service decides seat or waitlist', () => {
    expect(addRegistrationSchema.parse({ userId: ID }).status).toBeUndefined();
  });

  it.each(['confirmed', 'waitlisted', 'interested', 'cancelled'])('accepts the %s status', (status) => {
    expect(addRegistrationSchema.parse({ userId: ID, status }).status).toBe(status);
  });

  it('rejects an unknown status', () => {
    expect(() => addRegistrationSchema.parse({ userId: ID, status: 'attending' })).toThrow();
  });
});

describe('updateRegistrationSchema', () => {
  it('allows changing only the status', () => {
    expect(updateRegistrationSchema.parse({ status: 'confirmed' })).toEqual({ status: 'confirmed' });
  });

  it('allows attaching an organiser note', () => {
    expect(updateRegistrationSchema.parse({ note: 'Paid in cash' }).note).toBe('Paid in cash');
  });
});

describe('event registrationFields', () => {
  it('accepts an event with no questions', () => {
    expect(createEventSchema.parse(baseEvent).registrationFields).toBeUndefined();
  });

  it('accepts a select question with options', () => {
    const parsed = createEventSchema.parse({
      ...baseEvent,
      registrationFields: [
        { key: 'tshirt', label: 'T-shirt size', type: 'select', options: ['M', 'L'], required: true },
      ],
    });
    expect(parsed.registrationFields![0].options).toEqual(['M', 'L']);
  });

  it('requires both a key and a label on every question', () => {
    expect(() => createEventSchema.parse({ ...baseEvent, registrationFields: [{ key: 'a' }] })).toThrow();
    expect(() => createEventSchema.parse({ ...baseEvent, registrationFields: [{ label: 'A' }] })).toThrow();
  });

  it('rejects an unsupported question type', () => {
    expect(() =>
      createEventSchema.parse({
        ...baseEvent,
        registrationFields: [{ key: 'k', label: 'L', type: 'checkbox' }],
      })
    ).toThrow();
  });

  it('caps the number of questions so a form stays usable', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ key: `k${i}`, label: `L${i}` }));
    expect(() => createEventSchema.parse({ ...baseEvent, registrationFields: many })).toThrow();
  });
});

describe('registration question guards', () => {
  const withFields = (registrationFields: any[]) => ({ ...baseEvent, registrationFields });

  it('rejects two questions that resolve to the same key', () => {
    // Otherwise one question's answer silently overwrites the other's.
    expect(() =>
      createEventSchema.parse(
        withFields([
          { key: 'size', label: 'Size', type: 'text' },
          { key: 'size', label: 'Size', type: 'text' },
        ])
      )
    ).toThrow(/different name/i);
  });

  it('accepts two distinct questions', () => {
    const parsed = createEventSchema.parse(
      withFields([
        { key: 'size', label: 'Size', type: 'text' },
        { key: 'meal', label: 'Meal', type: 'text' },
      ])
    );
    expect(parsed.registrationFields).toHaveLength(2);
  });

  it('rejects a dropdown with no options', () => {
    // A required one would make registration impossible for everybody.
    expect(() =>
      createEventSchema.parse(withFields([{ key: 'size', label: 'Size', type: 'select', required: true }]))
    ).toThrow(/at least one option/i);
  });

  it('rejects a dropdown whose options list is empty', () => {
    expect(() =>
      createEventSchema.parse(withFields([{ key: 'size', label: 'Size', type: 'select', options: [] }]))
    ).toThrow(/at least one option/i);
  });

  it('accepts a dropdown that has options', () => {
    const parsed = createEventSchema.parse(
      withFields([{ key: 'size', label: 'Size', type: 'select', options: ['M', 'L'], required: true }])
    );
    expect(parsed.registrationFields![0].options).toEqual(['M', 'L']);
  });

  it('applies the same guards on update', () => {
    expect(() =>
      updateEventSchema.parse({
        registrationFields: [{ key: 'a', label: 'A', type: 'select' }],
      })
    ).toThrow(/at least one option/i);
  });
});

describe('nextRegistrationStatus', () => {
  const seats = (n: number) => Array.from({ length: n }, () => ({ status: 'confirmed' }));

  it('records interest when the event does not require registration', () => {
    // This is what makes an "interested" list reachable without a formal sign-up.
    expect(nextRegistrationStatus({ registrationRequired: false, registrations: [] })).toBe('interested');
  });

  it('still records interest even if a seat cap was left behind', () => {
    expect(
      nextRegistrationStatus({ registrationRequired: false, maxParticipants: 1, registrations: seats(5) })
    ).toBe('interested');
  });

  it('confirms a seat when registration is required and there is room', () => {
    expect(
      nextRegistrationStatus({ registrationRequired: true, maxParticipants: 3, registrations: seats(2) })
    ).toBe('confirmed');
  });

  it('confirms without limit when no cap is set', () => {
    expect(
      nextRegistrationStatus({ registrationRequired: true, registrations: seats(500) })
    ).toBe('confirmed');
  });

  it('waitlists once the seats are gone', () => {
    expect(
      nextRegistrationStatus({ registrationRequired: true, maxParticipants: 2, registrations: seats(2) })
    ).toBe('waitlisted');
  });

  it('counts only confirmed rows against the cap', () => {
    const registrations = [
      { status: 'confirmed' },
      { status: 'cancelled' },
      { status: 'waitlisted' },
      { status: 'interested' },
    ];
    expect(nextRegistrationStatus({ registrationRequired: true, maxParticipants: 2, registrations })).toBe(
      'confirmed'
    );
  });
});
