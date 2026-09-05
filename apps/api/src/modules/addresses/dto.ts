import { IsBoolean, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @Length(8, 9)
  cep!: string;

  @IsString()
  @MinLength(2)
  street!: string;

  @IsString()
  number!: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsString()
  @MinLength(2)
  district!: string;

  @IsString()
  @MinLength(2)
  city!: string;

  @IsString()
  @Length(2, 2)
  uf!: string;

  @IsOptional()
  @IsString()
  ibge?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  @Length(8, 9)
  cep?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  street?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  district?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @IsOptional()
  @IsString()
  ibge?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
