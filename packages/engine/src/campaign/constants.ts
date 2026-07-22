/** Star-score points awarded per unused launch (efficiency half of the rating). */
export const LAUNCH_BONUS = 5;

/** Ticks in one full board cycle; every orbit is periodic with this. 480 = 8s @ 60Hz. */
export const BOARD_PERIOD = 480;

/** Steps a just-teleported probe ignores portals, so it can't instantly re-enter. */
export const PORTAL_COOLDOWN = 6;

/** Extra units past the exit mouth a probe is placed on teleport. */
export const PORTAL_EXIT_MARGIN = 2;
