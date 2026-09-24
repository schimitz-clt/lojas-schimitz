import { ValidateBy, type ValidationArguments } from 'class-validator';
import { birthDateError } from './birth-date';
import { CPF_INVALID_MESSAGE, cpfError } from './cpf';
import { fullNameError } from './full-name';
import { phoneError } from './phone';

export function IsBrazilianCpf(): PropertyDecorator {
  return ValidateBy({
    name: 'isBrazilianCpf',
    validator: {
      validate: (value: unknown) => cpfError(value) == null,
      defaultMessage: (args?: ValidationArguments) => cpfError(args?.value) || CPF_INVALID_MESSAGE,
    },
  });
}

export function IsFullName(): PropertyDecorator {
  return ValidateBy({
    name: 'isFullName',
    validator: {
      validate: (value: unknown) => fullNameError(value) == null,
      defaultMessage: (args?: ValidationArguments) =>
        fullNameError(args?.value) || 'Informe seu nome completo.',
    },
  });
}

export function IsBrazilianMobile(): PropertyDecorator {
  return ValidateBy({
    name: 'isBrazilianMobile',
    validator: {
      validate: (value: unknown) => phoneError(value) == null,
      defaultMessage: (args?: ValidationArguments) =>
        phoneError(args?.value) || 'Informe um WhatsApp válido com DDD, como (51) 99999-0000.',
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
