import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import moment from 'moment-timezone';

@ValidatorConstraint({ name: 'DateAfter' })
export class DateAfterConstraint implements ValidatorConstraintInterface {
  public validate(value: Date, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints;
    const relatedValue: Date = (<any>args.object)[relatedPropertyName];

    return moment(value).isAfter(relatedValue || new Date());
  }

  public defaultMessage(args: ValidationArguments): string {
    const [relatedPropertyName] = args.constraints;
    return `${args.property} must be after ${relatedPropertyName || 'current time'}`;
  }
}

// eslint-disable-next-line arrow-body-style
export const DateAfter = (property?: string, validationOptions?: ValidationOptions): ReturnType<() => any> => {
  return (object: any, propertyName: string): void => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: DateAfterConstraint,
    });
  };
};
