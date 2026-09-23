/**
 * Marker that a session arrived through a link emailed to the account holder.
 *
 * /reset-password lets someone set a new password WITHOUT knowing the old one,
 * which is the point of a reset and also why it cannot be open to anyone
 * merely holding a session — an unattended signed-in browser would be enough
 * to take an account over. The Account screen's change-password form proves
 * intent by demanding the current password; this flow cannot, so it proves it
 * with a live token from the account's own inbox instead.
 *
 * Set by /auth/confirm on a successful recovery, required by the action that
 * writes the password, and deleted the moment it is used.
 */
export const RECOVERY_COOKIE = "pw_recovery_ok";

/** Ten minutes: long enough to choose a password, short enough to be useless later. */
export const RECOVERY_WINDOW_SECONDS = 600;
