import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentUploadField from '@/components/ui/DocumentUploadField';

vi.mock('@/lib/api', () => ({
  default: { post: vi.fn() },
}));

import api from '@/lib/api';

const post = api.post as unknown as ReturnType<typeof vi.fn>;

/** Builds a File of an exact byte length so the size guard can be exercised. */
function makeFile(name: string, bytes: number, type = 'application/pdf') {
  return new File([new Uint8Array(bytes)], name, { type });
}

function renderField(overrides: Partial<React.ComponentProps<typeof DocumentUploadField>> = {}) {
  const props = {
    value: '',
    onUploaded: vi.fn(),
    onClear: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
  const { container } = render(<DocumentUploadField {...props} />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  return { ...props, input };
}

beforeEach(() => {
  post.mockReset();
});

describe('DocumentUploadField', () => {
  it('offers a picker when nothing is attached', () => {
    renderField();
    expect(screen.getByText(/upload document/i)).toBeInTheDocument();
  });

  it('only accepts the types the server allows', () => {
    const { input } = renderField();
    expect(input.getAttribute('accept')).toBe('.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp');
  });

  it('shows the filename once a document is attached', () => {
    renderField({ value: 'https://res.cloudinary.com/x/raw/upload/minutes.pdf', fileName: 'minutes.pdf' });
    expect(screen.getByText('minutes.pdf')).toBeInTheDocument();
    expect(screen.queryByText(/upload document \(max/i)).toBeNull();
  });

  it('falls back to generic wording when the filename is unknown', () => {
    renderField({ value: 'https://res.cloudinary.com/x/raw/upload/a.pdf' });
    expect(screen.getByText(/document attached/i)).toBeInTheDocument();
  });

  it('clears the attachment on remove', () => {
    const { onClear } = renderField({ value: 'https://x/a.pdf', fileName: 'a.pdf' });
    fireEvent.click(screen.getByLabelText(/remove document/i));
    expect(onClear).toHaveBeenCalled();
  });

  it('uploads and reports back the url and server filename', async () => {
    post.mockResolvedValue({ data: { data: { url: 'https://res.cloudinary.com/x/report.pdf', originalName: 'report.pdf' } } });
    const { input, onUploaded } = renderField();

    fireEvent.change(input, { target: { files: [makeFile('report.pdf', 1024)] } });

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith('https://res.cloudinary.com/x/report.pdf', 'report.pdf'));
    expect(post).toHaveBeenCalledWith('/upload/document', expect.any(FormData), expect.anything());
  });

  it('rejects a file over 10MB without hitting the server', async () => {
    const { input, onError, onUploaded } = renderField();

    fireEvent.change(input, { target: { files: [makeFile('huge.pdf', 11 * 1024 * 1024)] } });

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringMatching(/exceeds the 10MB limit/i)));
    expect(post).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('surfaces the server message when the upload fails', async () => {
    post.mockRejectedValue({ response: { data: { message: 'File type not allowed' } } });
    const { input, onError } = renderField();

    fireEvent.change(input, { target: { files: [makeFile('bad.exe', 512)] } });

    await waitFor(() => expect(onError).toHaveBeenCalledWith('File type not allowed'));
  });
});
