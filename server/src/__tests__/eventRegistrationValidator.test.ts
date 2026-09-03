import {
  registerSchema,
  addRegistrationSchema,
  updateRegistrationSchema,
  createEventSchema,
  updateEventSchema,
} from '../validators/event.validator';
import { nextRegistrationStatus, needsApproval, validateResponses } from '../services/event.service';

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

  it.each(['pending', 'confirmed', 'waitlisted', 'interested', 'cancelled'])('accepts the %s status', (status) => {
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

describe('needsApproval', () => {
  const required = [{ key: 'why', label: 'Why?', type: 'text', required: true }];
  const optional = [{ key: 'why', label: 'Why?', type: 'text', required: false }];

  it('holds a sign-up for review when a question must be answered', () => {
    expect(needsApproval({ registrationRequired: true, registrationFields: required })).toBe(true);
  });

  it('lets a sign-up through when every question is optional', () => {
    expect(needsApproval({ registrationRequired: true, registrationFields: optional })).toBe(false);
  });

  it('lets a sign-up through when the event asks nothing', () => {
    expect(needsApproval({ registrationRequired: true, registrationFields: [] })).toBe(false);
    expect(needsApproval({ registrationRequired: true })).toBe(false);
  });

  it('never reviews an interest-only event, whatever it asks', () => {
    expect(needsApproval({ registrationRequired: false, registrationFields: required })).toBe(false);
  });
});

describe('nextRegistrationStatus with required questions', () => {
  const required = [{ key: 'why', label: 'Why?', type: 'text', required: true }];

  it('parks a sign-up as pending until an organiser reads the answers', () => {
    expect(
      nextRegistrationStatus({ registrationRequired: true, registrationFields: required, registrations: [] })
    ).toBe('pending');
  });

  it('stays pending even when seats are gone, so approval decides the outcome', () => {
    expect(
      nextRegistrationStatus({
        registrationRequired: true,
        registrationFields: required,
        maxParticipants: 1,
        registrations: [{ status: 'confirmed' }],
      })
    ).toBe('pending');
  });

  it('leaves an interest-only event unreviewed despite required questions', () => {
    expect(
      nextRegistrationStatus({ registrationRequired: false, registrationFields: required, registrations: [] })
    ).toBe('interested');
  });

  it('does not count pending rows against the seat cap', () => {
    const registrations = [{ status: 'pending' }, { status: 'pending' }, { status: 'confirmed' }];
    expect(nextRegistrationStatus({ registrationRequired: true, maxParticipants: 2, registrations })).toBe(
      'confirmed'
    );
  });
});

describe('validateResponses field-level errors', () => {
  const event = (fields: any[]) => ({ registrationFields: fields }) as any;
  const shirt = { key: 'shirt', label: 'T-shirt size', type: 'select', options: ['S', 'L'], required: true };
  const guests = { key: 'guests', label: 'Guests', type: 'number' };

  const errorsFrom = (fn: () => unknown): Record<string, string[]> => {
    try {
      fn();
    } catch (err: any) {
      return err.errors;
    }
    throw new Error('expected a validation error');
  };

  it('keys a missing required answer by its field, so the client can print it under that input', () => {
    expect(errorsFrom(() => validateResponses(event([shirt]), {}))).toEqual({
      shirt: ['T-shirt size is required'],
    });
  });

  it('keys an off-list select answer by its field', () => {
    expect(errorsFrom(() => validateResponses(event([shirt]), { shirt: 'XXL' }))).toEqual({
      shirt: ['T-shirt size must be one of: S, L'],
    });
  });

  it('keys a non-numeric answer by its field', () => {
    expect(errorsFrom(() => validateResponses(event([guests]), { guests: 'two' }))).toEqual({
      guests: ['Guests must be a number'],
    });
  });

  it('keeps the message and the field entry in step', () => {
    try {
      validateResponses(event([shirt]), {});
    } catch (err: any) {
      expect(err.errors.shirt[0]).toBe(err.message);
    }
  });

  it('accepts answers that satisfy every question', () => {
    expect(validateResponses(event([shirt, guests]), { shirt: 'L', guests: '2' })).toEqual({
      shirt: 'L',
      guests: '2',
    });
  });

  it('lets an organiser save a blank required answer, since only self-registration enforces it', () => {
    expect(validateResponses(event([shirt]), {}, false)).toEqual({});
  });
});
