import moment from 'moment-timezone';
import { GroupedTimeslotsDto, TimeslotDto } from '../dto/timeslot.dto';

export class TimeslotHelper {
  /**
   * Group timeslots by date with specified timezone.
   * Since start of dates are different in different timezones, timezone is needed to group timeslots.
   *
   * @param timeslots Array of TimeslotDto
   * @param tz Timezone name, ref: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
   * @returns Array of GroupedTimeslotsDto
   */
  public static groupTimeslotsByDate(timeslots: TimeslotDto[], tz: string = 'UTC'): Array<GroupedTimeslotsDto> {
    return timeslots.reduce((container: Array<GroupedTimeslotsDto>, timeslot: TimeslotDto) => {
      const groupedTimeslot = container.find((dto: GroupedTimeslotsDto) => moment(dto.date).tz(tz).isSame(moment(timeslot.startTime).tz(tz), 'D'));

      if (groupedTimeslot) {
        groupedTimeslot.timeslots.push(timeslot);
      } else {
        container.push({
          date: moment(timeslot.startTime).tz(tz).startOf('D').toDate(),
          timeslots: [timeslot],
        });
      }

      return container;
    }, []);
  }
}
