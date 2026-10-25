import {describe,expect,it} from 'vitest';
import {statementIsActive} from './visibility';
describe('statement visibility',()=>{
 it('uses half-open publication periods',()=>{
  const statement={popupStartsAt:'2026-09-07T10:00:00Z',popupEndsAt:'2026-09-21T10:00:00Z'};
  expect(statementIsActive(statement,Date.parse(statement.popupStartsAt))).toBe(true);
  expect(statementIsActive(statement,Date.parse(statement.popupEndsAt))).toBe(false);
  expect(statementIsActive({},Date.now())).toBe(false);
 });
});
