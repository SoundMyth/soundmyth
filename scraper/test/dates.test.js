import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  todayISO, addDaysISO, addMonthsISO, daysBetween, localDate, isUtcInstant, inferYearISO,
  parseNamedDate, resolveLDDate, cleanEventTitle, checkEventDate, isLegacyWebsiteRow, weekdayName,
} from '../normalize.js';

const TODAY = '2026-10-18';

test('todayISO: local calendar date, zero-padded', () => {
  assert.equal(todayISO(new Date(2026, 9, 18, 23, 30)), '2026-10-18');
  assert.equal(todayISO(new Date(2026, 0, 5, 1, 0)), '2026-01-05');
});

test('date arithmetic is calendar-only (no timezone shift)', () => {
  assert.equal(addDaysISO('2026-10-31', 1), '2026-11-01');
  assert.equal(addDaysISO('2026-03-01', -1), '2026-02-28');
  assert.equal(addMonthsISO('2026-10-18', 15), '2028-01-18');
  assert.equal(addMonthsISO('2026-01-31', 1), '2026-02-28');   // clamps to month end
  assert.equal(daysBetween('2026-11-06', '2026-11-08'), 2);
  assert.equal(weekdayName('2026-11-20'), 'friday');
});

test('localDate: takes the written calendar date, never converts', () => {
  assert.equal(localDate('2026-11-20T23:00:00-05:00'), '2026-11-20');
  assert.equal(localDate('2026-11-21T02:00:00Z'), '2026-11-21');   // literal; isUtcInstant guards it
  assert.equal(localDate('2026-02-30'), '');                       // impossible date
  assert.equal(localDate(''), '');
});

test('isUtcInstant: Z and +00:00 are UTC; local offsets are not', () => {
  assert.equal(isUtcInstant('2026-11-21T02:00:00Z'), true);
  assert.equal(isUtcInstant('2026-11-21T00:00:00+00:00'), true);
  assert.equal(isUtcInstant('2026-11-20T23:00:00-05:00'), false);
  assert.equal(isUtcInstant('2026-11-20'), false);
});

test('inferYearISO: yearless dates belong to next year only when >30 days past', () => {
  assert.equal(inferYearISO(10, 1, TODAY), '2026-10-01');   // 17 days ago → still this year
  assert.equal(inferYearISO(9, 1, TODAY), '2027-09-01');    // 47 days ago → next year
  assert.equal(inferYearISO(1, 5, TODAY), '2027-01-05');    // Jan 2026 is long past → 2027
  assert.equal(inferYearISO(11, 20, TODAY), '2026-11-20');
});

test('parseNamedDate: explicit year, weekday check, yearless', () => {
  const p = parseNamedDate('Friday November 20th 2026 - Dreamstate SoCal 2026', TODAY);
  assert.equal(p.date, '2026-11-20');
  assert.equal(p.weekdayOk, true);
  assert.equal(parseNamedDate('Saturday October 17th 2026 - WORSHIP', TODAY).date, '2026-10-17');
  assert.equal(parseNamedDate('Nov 20 Sunday show', TODAY).date, '2026-11-20');   // yearless
  assert.equal(parseNamedDate('20 November 2026', TODAY).date, '2026-11-20');     // day-first
  assert.equal(parseNamedDate('Friday November 21st 2026', TODAY).weekdayOk, false); // Saturday
  assert.equal(parseNamedDate('EDC Las Vegas 2027', TODAY), null);
});

test('resolveLDDate: the +1-day website bug — name date wins over a UTC timestamp', () => {
  const r = resolveLDDate({ name: 'Friday November 20th 2026 - Dreamstate SoCal 2026', startDate: '2026-11-21T02:00:00Z' }, TODAY);
  assert.equal(r.date, '2026-11-20');
});

test('resolveLDDate: UTC timestamp with no date in the name is not trusted', () => {
  assert.equal(resolveLDDate({ name: 'Set at the club', startDate: '2026-11-21T02:00:00Z' }, TODAY).date, '');
});

test('resolveLDDate: local-offset and date-only strings are taken literally', () => {
  assert.equal(resolveLDDate({ name: 'x', startDate: '2026-11-20T20:00:00-08:00' }, TODAY).date, '2026-11-20');
  assert.equal(resolveLDDate({ name: 'x', startDate: '2026-12-04' }, TODAY).date, '2026-12-04');
});

test('cleanEventTitle: strips the date prefix from website titles', () => {
  assert.equal(cleanEventTitle('Saturday October 17th 2026 - WORSHIP NA TOUR - New York'), 'WORSHIP NA TOUR - New York');
  assert.equal(cleanEventTitle('Friday November 20th 2026 - Dreamstate SoCal 2026'), 'Dreamstate SoCal 2026');
  assert.equal(cleanEventTitle('Dreamstate SoCal 2026'), 'Dreamstate SoCal 2026');
});

test('isLegacyWebsiteRow: only pre-fix date-prefixed website rows', () => {
  assert.equal(isLegacyWebsiteRow({ source: 'website', name: 'Saturday October 17th 2026 - WORSHIP NA TOUR - New York' }), true);
  assert.equal(isLegacyWebsiteRow({ source: 'website', name: 'Sub Focus @ WORSHIP NA TOUR' }), false);
  assert.equal(isLegacyWebsiteRow({ source: 'songkick', name: 'Saturday October 17th 2026 - X' }), false);
});

test('checkEventDate: 15-month horizon and invalid dates', () => {
  assert.equal(checkEventDate('2030-11-04', TODAY), 'too-far');   // Dillon Francis snapshot row
  assert.equal(checkEventDate('2028-05-12', TODAY), 'too-far');   // EDC Las Vegas snapshot row
  assert.equal(checkEventDate('2028-01-18', TODAY), 'ok');        // exactly 15 months
  assert.equal(checkEventDate('2027-05-01', TODAY), 'ok');
  assert.equal(checkEventDate('2026-10-17', TODAY), 'past');
  assert.equal(checkEventDate('2026-13-01', TODAY), 'invalid');
});
