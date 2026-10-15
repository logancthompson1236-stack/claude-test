/** Tuning knobs. Keep gameplay numbers here so balancing doesn't mean hunting through code. */
export const BALANCE = {
  startCash: 150,
  dailyRent: 10,
  startRating: 1.5,
  /** How quickly the rating follows recent visits (exponential moving average weight). */
  ratingWeight: 0.06,

  openMinute: 6 * 60,
  lastEntryMinute: 21 * 60,
  closeMinute: 22 * 60,
  /** In-game minutes that pass per real second at 1x speed (8 real minutes per day). */
  gameMinutesPerSecond: 2,

  /** Expected arrivals per in-game hour before multipliers. */
  baseArrivalsPerHour: 0.6,
  /** Busy mornings and evenings, quiet afternoons. Indexed by hour. */
  hourCurve: [
    0, 0, 0, 0, 0, 0, 1.4, 1.4, 1.4, 0.7, 0.7, 0.7, 1, 1, 0.6, 0.6, 0.6, 1.6, 1.6, 1.6, 0.6, 0.6, 0, 0,
  ],
  /** Decor/amenity appeal stops helping past this total. */
  maxDecorAppeal: 1.5,

  baseVisitSatisfaction: 2.4,
  waitPenaltyPerMinute: 1 / 15,
  maxWaitPenalty: 1.5,
  gaveUpSatisfaction: 0.8,
  decorSatisfactionPerAppeal: 0.2,
  maxDecorSatisfaction: 0.8,
  patienceMinutes: [20, 40] as [number, number],
  coolerChance: 0.45,

  playerSpeed: 4.2, // tiles per real second
  customerSpeed: 2.4, // tiles per real second at 1x
};
