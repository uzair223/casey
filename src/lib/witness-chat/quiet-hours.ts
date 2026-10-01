const LONDON = "Europe/London";

function londonParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
    second: read("second"),
  };
}

function timeZoneOffsetMs(date: Date) {
  const parts = londonParts(date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function londonWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  const offset = timeZoneOffsetMs(guess);
  const corrected = new Date(guess.getTime() - offset);
  const check = timeZoneOffsetMs(corrected);
  if (check !== offset) {
    return new Date(guess.getTime() - check);
  }
  return corrected;
}

/** SMS sends immediately between 08:00 and 20:00 Europe/London. Otherwise the next 08:00. */
export function smsReadyAt(now: Date) {
  const parts = londonParts(now);
  if (parts.hour >= 8 && parts.hour < 20) {
    return now;
  }

  if (parts.hour < 8) {
    return londonWallTimeToUtc(parts.year, parts.month, parts.day, 8);
  }

  const nextDay = new Date(
    londonWallTimeToUtc(parts.year, parts.month, parts.day, 8).getTime() +
      24 * 60 * 60 * 1000,
  );
  const nextParts = londonParts(nextDay);
  return londonWallTimeToUtc(nextParts.year, nextParts.month, nextParts.day, 8);
}
