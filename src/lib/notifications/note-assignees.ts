export function assigneesToNotify(input: {
  assignedUserIds: string[];
  mentionedUserIds: string[];
  authorUserId: string;
}) {
  const mentioned = new Set(input.mentionedUserIds.filter(Boolean));
  return Array.from(new Set(input.assignedUserIds.filter(Boolean))).filter(
    (userId) => userId !== input.authorUserId && !mentioned.has(userId),
  );
}
