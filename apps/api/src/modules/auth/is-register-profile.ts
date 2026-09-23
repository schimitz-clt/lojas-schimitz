import { ValidateBy, type ValidationArguments } from 'class-validator';
import { birthDateError } from './birth-date';
import { cpfError } from './cpf';

export function IsBrazilianCpf(): PropertyDecorator {
  return ValidateBy({
    name: 'isBrazilianCpf',
    validator: {
      validate: (value: unknown) => cpfError(value) == null,
      defaultMessage: (args?: ValidationArguments) => cpfError(args?.value) || 'CPF inválido',
    },
  });
}

export function IsAdultBirthDate(): PropertyDecorator {
  return ValidateBy({
    name: 'isAdultBirthDate',
    validator: {
      validate: (value: unknown) => birthDateError(value) == null,
      defaultMessage: (args?: ValidationArguments) =>
        birthDateError(args?.value) || 'Informe a data de nascimento.',
    },
  });
}
