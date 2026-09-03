import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { getAttendanceWindow, UserRole } from '@rdswa/shared';
import AttendanceDateField, {
  AttendanceWindowClosedNotice,
} from '@/components/ui/AttendanceDateField';

/** Starts 14:00 Dhaka on 2 Sep 2026, no explicit end. */
const EVENT = { startDate: '2026-09-02T08:00:00.000Z' };

const DURING = new Date('2026-09-02T10:00:00.000Z');
const NEXT_DAY = new Date('2026-09-03T10:00:00.000Z');
const LONG_AFTER = new Date('2026-12-31T10:00:00.000Z');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NEXT_DAY);
});

afterAll(() => {
  vi.useRealTimers();
});

describe('AttendanceDateField', () => {
  const renderField = (now: Date, role?: string, onChange = vi.fn()) => {
    const attendanceWindow = getAttendanceWindow(EVENT, { role, now });
    render(
      <AttendanceDateField
        id="test-date"
        attendanceWindow={attendanceWindow}
        event={EVENT}
        value=""
        onChange={onChange}
      />
    );
    return onChange;
  };

  it('stays hidden while the event is still running', () => {
    renderField(DURING);
    expect(screen.queryByLabelText(/attendance date/i)).toBeNull();
  });

  it('appears once the event has ended', () => {
    renderField(NEXT_DAY);
    expect(screen.getByLabelText(/attendance date/i)).toBeInTheDocument();
  });

  it('leaves the input empty so a blank submit means today', () => {
    renderField(NEXT_DAY);
    expect(screen.getByLabelText(/attendance date/i)).toHaveValue('');
  });

  it("bounds the picker to the event's own day through today", () => {
    renderField(NEXT_DAY);
    const input = screen.getByLabelText(/attendance date/i);
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveAttribute('min', '2026-09-02');
    expect(input).toHaveAttribute('max', '2026-09-03');
  });

  it('reports the picked date to its parent', () => {
    const onChange = renderField(NEXT_DAY);
    fireEvent.change(screen.getByLabelText(/attendance date/i), {
      target: { value: '2026-09-02' },
    });
    expect(onChange).toHaveBeenCalledWith('2026-09-02');
  });

  it('disappears once the actor window has closed', () => {
    renderField(LONG_AFTER, UserRole.MODERATOR); // 30-day window, long expired
    expect(screen.queryByLabelText(/attendance date/i)).toBeNull();
  });

  it('is still offered to an admin after the moderator window has closed', () => {
    renderField(LONG_AFTER, UserRole.ADMIN); // 365-day window
    expect(screen.getByLabelText(/attendance date/i)).toBeInTheDocument();
  });
});

describe('AttendanceWindowClosedNotice', () => {
  it('renders nothing while the window is open', () => {
    const { container } = render(
      <AttendanceWindowClosedNotice
        attendanceWindow={getAttendanceWindow(EVENT, { role: UserRole.ADMIN, now: NEXT_DAY })}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names the expired window so the reason is visible', () => {
    render(
      <AttendanceWindowClosedNotice
        attendanceWindow={getAttendanceWindow(EVENT, {
          role: UserRole.MODERATOR,
          now: LONG_AFTER,
        })}
      />
    );
    expect(screen.getByText(/closed 30 days after this event ended/i)).toBeInTheDocument();
  });

  it('uses self check-in wording for a member', () => {
    render(
      <AttendanceWindowClosedNotice
        attendanceWindow={getAttendanceWindow(EVENT, { isSelfCheckin: true, now: LONG_AFTER })}
      />
    );
    expect(screen.getByText(/self check-in closed 7 days/i)).toBeInTheDocument();
  });
});
