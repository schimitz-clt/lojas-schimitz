import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MinLength(0)
  body?: string;
}
