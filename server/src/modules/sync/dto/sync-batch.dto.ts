import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';

export enum SyncOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export class ResolveConflictDto {
  @IsEnum(['USE_SERVER', 'USE_CLIENT', 'USE_MERGE'])
  resolution: string;

  @IsOptional()
  @IsObject()
  mergedPayload?: Record<string, any>;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}
