import { IsString, IsEnum, IsObject, IsArray, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SyncOperation } from '@prisma/client';

export class SyncEntryDto {
  @IsString()
  localId: string;

  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  @IsEnum(SyncOperation)
  operation: SyncOperation;

  @IsObject()
  payload: Record<string, any>;

  @IsNumber()
  version: number;

  @IsString()
  deviceId: string;

  @IsOptional()
  @IsString()
  clientTimestamp?: string;
}

export class SyncBatchDto {
  @IsString()
  deviceId: string;

  @IsString()
  deviceName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncEntryDto)
  entries: SyncEntryDto[];

  @IsOptional()
  @IsString()
  lastSyncTimestamp?: string;
}

export class SyncResultDto {
  results: SyncResultEntry[];
  changes: SyncChange[];
  serverTimestamp: string;
}

export class SyncResultEntry {
  localId: string;
  serverId: string | null;
  serverVersion: number | null;
  status: 'SYNCED' | 'CONFLICT' | 'ERROR';
  errorMessage?: string;
  conflictData?: any;
}

export class SyncChange {
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, any>;
  serverVersion: number;
  deviceId: string;
  updatedAt: string;
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