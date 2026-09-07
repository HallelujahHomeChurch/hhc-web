import {describe,expect,it} from 'vitest';
import {taipeiDay, statementIsActive} from './visibility';
describe('statement visibility',()=>{
 it('uses Taipei midnight and half-open periods',()=>{
  expect(taipeiDay(Date.parse('2026-09-07T15:59:59Z'))).toBe('2026-09-07');
  expect(taipeiDay(Date.parse('2026-09-07T16:00:00Z'))).toBe('2026-09-08');
  const statement={popupStartsAt:'2026-09-07T10:00:00Z',popupEndsAt:'2026-09-21T10:00:00Z'};
  expect(statementIsActive(statement,Date.parse(statement.popupStartsAt))).toBe(true);
  expect(statementIsActive(statement,Date.parse(statement.popupEndsAt))).toBe(false);
  expect(statementIsActive({},Date.now())).toBe(false);
 });
});
