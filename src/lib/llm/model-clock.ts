const LONDON = "Europe/London";

export function modelToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("weekday")} ${read("day")} ${read("month")} ${read("year")}`;
}

export function modelTemporalAwareness(now = new Date()) {
  return `Today is ${modelToday(now)}. A date before today has already passed. Do not describe a fit note, time off, treatment, or other period as still in place, ongoing, or due to end when its end date is before today. Say that it ended on that date, unless the person said it was extended or is still continuing.`;
}
