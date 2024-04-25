import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment-timezone';
import { TimeslotDto } from '../dto/timeslot.dto';

import { TimeslotHelper } from './timeslotHelper';

function generateDummyTimeslot(count: number = 5): TimeslotDto[] {
  return [...Array(count).keys()].map((idx: number) => ({
    startTime: moment().add(idx, 'd').toDate(),
    endTime: moment().add(idx, 'd').add(30, 'm').toDate(),
  }));
}

describe('Timeslot Helper', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [TimeslotHelper],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('grouping timeslots', () => {
    const timeslots = generateDummyTimeslot().concat(generateDummyTimeslot());
    const results = TimeslotHelper.groupTimeslotsByDate(timeslots);

    expect(Array.isArray(results)).toBeTruthy();
    expect(results.length).toBe(timeslots.length / 2);
  });
});
