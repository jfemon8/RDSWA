import { submitFormSchema } from '../validators/form.validator';

const file = (name: string) => ({ name, url: `https://example.com/${name}.jpg` });

const body = (type: string, attachments = [file('nid'), file('student-id')]) => ({
  type,
  data: { reason: 'I would like to join.' },
  attachments,
});

describe('form submission types', () => {
  it('accepts a membership application with its two documents', () => {
    expect(submitFormSchema.parse(body('membership')).type).toBe('membership');
  });

  it('accepts an alumni registration with its proof of work', () => {
    expect(submitFormSchema.parse(body('alumni', [file('trade-licence')])).type).toBe('alumni');
  });

  it('refuses a construction fund submission, which is retired', () => {
    expect(() => submitFormSchema.parse(body('construction_fund'))).toThrow();
  });

  it('refuses a type nobody defined', () => {
    expect(() => submitFormSchema.parse(body('anything-else'))).toThrow();
  });

  it('still holds each surviving type to its document requirement', () => {
    expect(() => submitFormSchema.parse(body('membership', [file('nid')]))).toThrow();
    expect(() => submitFormSchema.parse(body('alumni', []))).toThrow();
  });
});
