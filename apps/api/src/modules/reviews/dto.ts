import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}

export class AdminUpdateReviewStatusDto {
  @IsIn(['published', 'hidden'])
  status!: 'published' | 'hidden';
}
