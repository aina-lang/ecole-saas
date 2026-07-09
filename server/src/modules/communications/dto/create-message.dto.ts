import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsUUID } from 'class-validator';
import { MessagePriority } from '@prisma/client';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsEnum(MessagePriority)
  @IsOptional()
  priority?: MessagePriority;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty({ each: true })
  recipientIds: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  documentIds?: string[];
}