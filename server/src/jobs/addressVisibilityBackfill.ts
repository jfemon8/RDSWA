import { User } from '../models';

/**
 * Both addresses defaulted to private while no form ever offered a way to change that, so the stored
 * `false` was never anyone's decision and is lifted once.
 */
export async function backfillAddressVisibility(): Promise<void> {
  try {
    const result = await User.updateMany(
      {
        isDeleted: false,
        $or: [
          { 'profileVisibility.presentAddress': false },
          { 'profileVisibility.permanentAddress': false },
        ],
      },
      {
        $set: {
          'profileVisibility.presentAddress': true,
          'profileVisibility.permanentAddress': true,
        },
      },
    );
    if (result.modifiedCount > 0) {
      console.log(`[AddressVisibility] Made addresses visible on ${result.modifiedCount} profile(s)`);
    }
  } catch (err) {
    console.error('[AddressVisibility] Failed to backfill address visibility:', err);
  }
}
