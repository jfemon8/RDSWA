import { Schema } from 'mongoose';

/** Stamps `deletedAt` however a record is soft-deleted, so no delete handler has to remember to record it. */
/** Adds the stamp to an update that flips `isDeleted`, and clears it on one that restores. */
export function stampDeletion(update: Record<string, any>, now = new Date()): Record<string, any> {
  // An update may set the flag at the top level or inside `$set`, and the stamp has to follow it there.
  const target = update.$set && 'isDeleted' in update.$set ? update.$set : update;

  if (target.isDeleted === true) {
    target.deletedAt = now;
  } else if (target.isDeleted === false) {
    update.$unset = { ...(update.$unset || {}), deletedAt: '' };
  }

  return update;
}

export function softDeletePlugin(schema: Schema): void {
  if (!schema.path('isDeleted')) return;
  if (!schema.path('deletedAt')) schema.add({ deletedAt: { type: Date } });

  schema.pre('save', function (next) {
    if (this.isModified('isDeleted')) {
      (this as any).deletedAt = (this as any).isDeleted ? new Date() : undefined;
    }
    next();
  });

  schema.pre(
    ['findOneAndUpdate', 'updateOne', 'updateMany'],
    function (this: any, next: (err?: Error) => void) {
      const update = this.getUpdate();
      if (!update || Array.isArray(update)) return next();

      this.setUpdate(stampDeletion(update));
      next();
    }
  );
}
