import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  @MinLength(1, { message: 'Mensagem vazia' })
  @MaxLength(1200, { message: 'Mensagem muito longa (máx. 1200)' })
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;
}

export type ChatProductHit = {
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  badge: string | null;
  inStock: boolean;
  path: string;
};

export type ChatReply = {
  conversationId: string;
  reply: string;
  handoff: boolean;
  whatsappUrl: string;
  llm: boolean;
  products: ChatProductHit[];
};
