export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type EntryType = string | { [key: string]: JsonValue } | JsonValue[] | null;

export type NoulQuestion = {
  type: "noul";
  instructions?: EntryType;
  criteria?: { true?: EntryType; false?: EntryType } | null;
};

export type ChoiceQuestion = {
  type: "choice";
  instructions?: EntryType;
  criteria: Record<string, EntryType>;
};

export type ScoreQuestion = {
  type: "score";
  instructions?: EntryType;
  criteria: readonly [EntryType, EntryType, ...EntryType[]];
};

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;
export type Questions = Record<string, Question>;

export function noul(
  instructions?: EntryType,
  criteria?: NoulQuestion["criteria"],
): NoulQuestion {
  return {
    type: "noul",
    ...(instructions !== undefined ? { instructions } : {}),
    ...(criteria !== undefined ? { criteria } : {}),
  };
}

export function choice(
  instructions: EntryType,
  criteria: Record<string, EntryType>,
): ChoiceQuestion {
  return {
    type: "choice",
    instructions,
    criteria,
  };
}

export function score(
  instructions: EntryType,
  criteria: readonly [EntryType, EntryType, ...EntryType[]],
): ScoreQuestion {
  return {
    type: "score",
    instructions,
    criteria,
  };
}
