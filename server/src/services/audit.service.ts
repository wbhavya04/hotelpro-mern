import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.model';

export async function recordAuditLog(params: {
  actorId: mongoose.Types.ObjectId | string;
  actorRole: string;
  action: string;
  affectedResource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await AuditLog.create({
      actor: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      affectedResource: params.affectedResource,
      resourceId: params.resourceId,
      metadata: params.metadata || {},
      ipAddress: params.ipAddress
    });
  } catch (err) {
    console.error('[HotelPro AuditLog Error]:', err);
  }
}
