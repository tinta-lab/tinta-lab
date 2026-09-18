import { aggregateStatus } from './aggregate-status';
import { DiagnosticStatus } from './dto/diagnostic-status.enum';
import { DiagnosticCheckKey } from './dto/diagnostic-check-key.enum';
import { DiagnosticCheckDto } from './dto/diagnostic-check.dto';

function fakeCheck(status: DiagnosticStatus): DiagnosticCheckDto {
  return {
    key: DiagnosticCheckKey.CLIENT,
    status,
    code: 'FAKE',
    title: 'fake',
    message: 'fake',
    checkedAt: new Date('2026-09-18T00:00:00.000Z'),
    evidence: null,
  };
}

describe('aggregateStatus', () => {
  it('throws on an empty array rather than resolving to OK', () => {
    expect(() => aggregateStatus([])).toThrow(
      /checks\.length === 11|programmer error/,
    );
  });

  it.each<[DiagnosticStatus[], DiagnosticStatus]>([
    [[DiagnosticStatus.OK], DiagnosticStatus.OK],
    [[DiagnosticStatus.UNKNOWN], DiagnosticStatus.UNKNOWN],
    [[DiagnosticStatus.WARNING, DiagnosticStatus.UNKNOWN], DiagnosticStatus.WARNING],
    [
      [
        DiagnosticStatus.ERROR,
        DiagnosticStatus.UNKNOWN,
        DiagnosticStatus.UNKNOWN,
        DiagnosticStatus.UNKNOWN,
      ],
      DiagnosticStatus.ERROR,
    ],
    [[DiagnosticStatus.OK, DiagnosticStatus.OK, DiagnosticStatus.OK], DiagnosticStatus.OK],
    [[DiagnosticStatus.ERROR, DiagnosticStatus.WARNING], DiagnosticStatus.ERROR],
    [
      [DiagnosticStatus.OK, DiagnosticStatus.UNKNOWN, DiagnosticStatus.WARNING],
      DiagnosticStatus.WARNING,
    ],
  ])('aggregates %j to %s', (statuses, expected) => {
    expect(aggregateStatus(statuses.map(fakeCheck))).toBe(expected);
  });

  it('UNKNOWN never escalates to ERROR no matter how many UNKNOWN checks accompany it', () => {
    const checks = [
      DiagnosticStatus.WARNING,
      ...Array(10).fill(DiagnosticStatus.UNKNOWN),
    ].map(fakeCheck);
    expect(aggregateStatus(checks)).toBe(DiagnosticStatus.WARNING);
  });
});
