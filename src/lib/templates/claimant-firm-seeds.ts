import type { CaseConfig, StatementConfig, StatementPhaseConfig, StatementSectionConfig } from "@/types";

type Field = NonNullable<CaseConfig["dynamicFields"]>[number];

const witnessMetadataFields: StatementConfig["witnessMetadataFields"] = [
  {
    id: "address",
    label: "Address",
    description: "The witness's residential address.",
    requiredOnIntake: true,
    requiredOnCreate: false,
  },
  {
    id: "occupation",
    label: "Occupation",
    description: "The witness's occupation.",
    requiredOnIntake: false,
    requiredOnCreate: false,
  },
];

function field(
  id: string,
  label: string,
  description: string,
  type: Field["type"] = "text",
): Field {
  return { id, label, type, description };
}

function phase(
  id: string,
  title: string,
  objective: string,
  questioningMode: StatementPhaseConfig["questioningMode"],
  completionCriteria: string[],
): StatementPhaseConfig {
  return {
    id,
    title,
    objective,
    allowedTopics: null,
    forbiddenTopics: null,
    completionCriteria,
    questioningMode,
  };
}

function section(
  id: string,
  title: string,
  description: string,
): StatementSectionConfig {
  return { id, title, description };
}

function statementConfig(params: {
  modelIdentity: string;
  phases: StatementPhaseConfig[];
  sections: StatementSectionConfig[];
  caseMetadataDeps: string[];
}): StatementConfig {
  return {
    schemaVersion: 4,
    modelIdentity: params.modelIdentity,
    phases: params.phases,
    sections: params.sections,
    witnessMetadataFields,
    caseMetadataDeps: params.caseMetadataDeps,
  };
}

function parties(defendantLabel: string, defendantDescription: string): Field[] {
  return [
    field("court", "Court", "The court where the claim is issued."),
    field("claimNumber", "Claim number", "The court claim number."),
    field("claimant", "Claimant", "The person bringing the claim."),
    field("defendant", defendantLabel, defendantDescription),
  ];
}

const roadTrafficFields = [
  ...parties(
    "Defendant",
    "The other driver or the person alleged to be responsible.",
  ),
  field("accidentDate", "Accident date", "The date of the collision.", "date"),
  field(
    "accidentLocation",
    "Accident location",
    "The road, junction, or place where the collision happened.",
  ),
];

const workFields = [
  ...parties(
    "Defendant employer",
    "The employer alleged to be responsible for the workplace accident.",
  ),
  field("accidentDate", "Accident date", "The date of the accident at work.", "date"),
  field(
    "workplace",
    "Workplace",
    "The site, yard, or premises where the accident happened.",
  ),
];

const publicLiabilityFields = [
  ...parties(
    "Defendant occupier",
    "The occupier alleged to be responsible for the premises.",
  ),
  field("accidentDate", "Accident date", "The date of the accident.", "date"),
  field(
    "premises",
    "Premises",
    "The shop, pavement, or other place where the accident happened.",
  ),
];

const clinicalFields = [
  ...parties(
    "Defendant provider",
    "The hospital, clinic, or clinician alleged to be responsible.",
  ),
  field(
    "treatmentDate",
    "Treatment date",
    "The date of the treatment the statement is about.",
    "date",
  ),
  field(
    "hospitalOrClinic",
    "Hospital or clinic",
    "Where the treatment was given.",
  ),
];

export type SeededStatementTemplate = {
  id: string;
  name: string;
  config: StatementConfig;
};

export type SeededCaseTemplate = {
  id: string;
  name: string;
  titleTemplate: string;
  config: CaseConfig;
  statements: Array<{
    template: SeededStatementTemplate;
    isDefault: boolean;
  }>;
};

const roadTrafficClaimant = statementConfig({
  modelIdentity:
    "You are interviewing the claimant in a road traffic collision. Take their account of how the collision happened and what happened afterwards.",
  caseMetadataDeps: roadTrafficFields.map((item) => item.id),
  phases: [
    phase(
      "beforeTheCollision",
      "Before the collision",
      "Where the claimant was going, who was with them, and the conditions immediately before impact.",
      "narrative",
      ["Journey and destination", "Who was in the vehicle", "Road and weather conditions"],
    ),
    phase(
      "theCollision",
      "The collision",
      "How the vehicles came into contact and what the claimant saw and did.",
      "narrative",
      ["What the claimant saw", "What the claimant did", "Point of impact"],
    ),
    phase(
      "atTheScene",
      "At the scene",
      "What happened in the minutes after impact, including who was there and who attended.",
      "mixed",
      ["People present", "Police, ambulance, or recovery attendance", "Exchanges of details"],
    ),
    phase(
      "injuriesAndTreatment",
      "Injuries and treatment",
      "The injuries the claimant suffered and the treatment they have had.",
      "structured",
      ["Injuries noticed", "Treatment received", "Whether treatment is ongoing"],
    ),
    phase(
      "lifeSince",
      "Life since the collision",
      "How the injuries have affected work, travel, and ordinary activities.",
      "narrative",
      ["Time off work or study", "Activities the claimant can no longer do as before"],
    ),
  ],
  sections: [
    section("introduction", "Introduction", "Who the claimant is and their connection to the claim."),
    section("beforeTheCollision", "Before the collision", "The journey and conditions immediately before impact."),
    section("theCollision", "The collision", "The claimant's account of how the collision happened."),
    section("atTheScene", "At the scene", "What happened immediately after impact."),
    section("injuriesAndTreatment", "Injuries and treatment", "Injuries and the treatment received."),
    section("lifeSince", "Life since the collision", "The effect on work and daily life."),
  ],
});

const roadTrafficWitness = statementConfig({
  modelIdentity:
    "You are interviewing an independent witness to a road traffic collision. Take their account of what they saw and heard.",
  caseMetadataDeps: roadTrafficFields.map((item) => item.id),
  phases: [
    phase(
      "whereTheyWere",
      "Where they were",
      "Where the witness was and what they could see of the road.",
      "structured",
      ["Where the witness was standing or sitting", "What they could see"],
    ),
    phase(
      "whatTheySaw",
      "What they saw",
      "The movements of the vehicles and how they came into contact.",
      "narrative",
      ["Vehicles involved", "How the collision happened", "What the witness heard"],
    ),
    phase(
      "peopleInvolved",
      "The people involved",
      "Who the witness saw and what condition those people appeared to be in.",
      "mixed",
      ["Drivers or passengers seen", "Any injury the witness observed"],
    ),
    phase(
      "afterwards",
      "Afterwards",
      "What the witness did and saw after the collision.",
      "narrative",
      ["What the witness did", "Who attended the scene"],
    ),
  ],
  sections: [
    section("introduction", "Introduction", "Who the witness is and why they saw the collision."),
    section("whatTheySaw", "What I saw", "The witness's account of the collision."),
    section("peopleInvolved", "The people involved", "The people and vehicles the witness observed."),
    section("afterwards", "Afterwards", "What happened after the collision."),
  ],
});

const injuredWorker = statementConfig({
  modelIdentity:
    "You are interviewing the injured worker in an accident at work. Take their account of the job they were doing, how they were hurt, and what happened afterwards.",
  caseMetadataDeps: workFields.map((item) => item.id),
  phases: [
    phase(
      "theJob",
      "The job",
      "The work the claimant was doing and the instructions or training they had been given.",
      "narrative",
      ["Role and duties", "The task at the time", "Training or instructions given"],
    ),
    phase(
      "theAccident",
      "The accident",
      "How the accident happened and what equipment or conditions were involved.",
      "narrative",
      ["What the claimant was doing", "How they were hurt", "Equipment or conditions involved"],
    ),
    phase(
      "immediatelyAfterwards",
      "Immediately afterwards",
      "What happened at the workplace in the minutes after the accident.",
      "mixed",
      ["Who was told", "First aid or medical attendance", "Whether the accident was recorded"],
    ),
    phase(
      "injuriesAndTreatment",
      "Injuries and treatment",
      "The injuries and the treatment the claimant has had.",
      "structured",
      ["Injuries", "Treatment", "Whether treatment is ongoing"],
    ),
    phase(
      "workSince",
      "Work since the accident",
      "Whether the claimant has returned to work and what they can no longer do.",
      "narrative",
      ["Time off work", "Current duties compared with before"],
    ),
  ],
  sections: [
    section("introduction", "Introduction", "Who the claimant is and their job."),
    section("theJob", "The job", "The task and any training or instructions."),
    section("theAccident", "The accident", "How the accident happened."),
    section("immediatelyAfterwards", "Immediately afterwards", "What happened at work after the accident."),
    section("injuriesAndTreatment", "Injuries and treatment", "Injuries and treatment."),
    section("workSince", "Work since the accident", "The effect on work."),
  ],
});

const workColleague = statementConfig({
  modelIdentity:
    "You are interviewing a colleague who saw an accident at work. Take their account of what they saw and what they did.",
  caseMetadataDeps: workFields.map((item) => item.id),
  phases: [
    phase(
      "theirRole",
      "Their role",
      "The colleague's job and where they were when the accident happened.",
      "structured",
      ["Their job", "Where they were"],
    ),
    phase(
      "whatTheySaw",
      "What they saw",
      "What the colleague saw of the task and the accident.",
      "narrative",
      ["The task they saw", "How the accident happened"],
    ),
    phase(
      "conditions",
      "Workplace conditions",
      "The equipment, housekeeping, or conditions the colleague observed.",
      "mixed",
      ["Equipment or conditions seen", "Any warning or instruction the colleague heard"],
    ),
    phase(
      "whatTheyDid",
      "What they did",
      "What the colleague did after the accident.",
      "narrative",
      ["Help given", "Who they told"],
    ),
  ],
  sections: [
    section("introduction", "Introduction", "Who the colleague is and their job."),
    section("whatTheySaw", "What I saw", "The colleague's account of the accident."),
    section("conditions", "Workplace conditions", "Conditions and equipment the colleague observed."),
    section("whatTheyDid", "What I did", "What the colleague did afterwards."),
  ],
});

const injuredPerson = statementConfig({
  modelIdentity:
    "You are interviewing the injured person in a public liability claim. Take their account of why they were there, how the accident happened, and what happened afterwards.",
  caseMetadataDeps: publicLiabilityFields.map((item) => item.id),
  phases: [
    phase(
      "whyTheyWereThere",
      "Why they were there",
      "Why the claimant was at the premises and what they were doing.",
      "narrative",
      ["Reason for being there", "What they were doing"],
    ),
    phase(
      "theHazard",
      "The hazard",
      "The condition of the place and what the claimant says caused the accident.",
      "mixed",
      ["What the hazard was", "Whether any warning was visible"],
    ),
    phase(
      "theAccident",
      "The accident",
      "How the claimant came to be injured.",
      "narrative",
      ["How the accident happened", "What the claimant was looking at"],
    ),
    phase(
      "afterwards",
      "Afterwards",
      "What happened immediately after, including who was told.",
      "mixed",
      ["Who was told", "Any attendance or report"],
    ),
    phase(
      "injuriesAndTreatment",
      "Injuries and treatment",
      "The injuries and the treatment the claimant has had.",
      "structured",
      ["Injuries", "Treatment", "Effect on ordinary activities"],
    ),
  ],
  sections: [
    section("introduction", "Introduction", "Who the claimant is."),
    section("whyTheyWereThere", "Why I was there", "Why the claimant was at the premises."),
    section("theAccident", "The accident", "How the accident happened."),
    section("afterwards", "Afterwards", "What happened immediately afterwards."),
    section("injuriesAndTreatment", "Injuries and treatment", "Injuries, treatment, and the effect on daily life."),
  ],
});

const publicWitness = statementConfig({
  modelIdentity:
    "You are interviewing an independent witness to an accident on premises. Take their account of what they saw of the place and the accident.",
  caseMetadataDeps: publicLiabilityFields.map((item) => item.id),
  phases: [
    phase(
      "whyTheyWereThere",
      "Why they were there",
      "Why the witness was at the premises and where they were standing.",
      "structured",
      ["Why they were there", "Where they were"],
    ),
    phase(
      "whatTheySaw",
      "What they saw",
      "What the witness saw of the accident.",
      "narrative",
      ["What the injured person was doing", "How the accident happened"],
    ),
    phase(
      "thePlace",
      "The place",
      "The condition of the premises the witness observed.",
      "mixed",
      ["Condition of the place", "Any warning the witness saw"],
    ),
    phase(
      "afterwards",
      "Afterwards",
      "What the witness did and saw after the accident.",
      "narrative",
      ["Help given", "Who attended"],
    ),
  ],
  sections: [
    section("introduction", "Introduction", "Who the witness is and why they were there."),
    section("whatTheySaw", "What I saw", "The witness's account of the accident."),
    section("thePlace", "The place", "The condition of the premises."),
    section("afterwards", "Afterwards", "What happened after the accident."),
  ],
});

const patient = statementConfig({
  modelIdentity:
    "You are interviewing the patient in a clinical negligence claim. Take their account of the treatment, what they were told, and what happened afterwards.",
  caseMetadataDeps: clinicalFields.map((item) => item.id),
  phases: [
    phase(
      "whyTheyAttended",
      "Why they attended",
      "Why the patient sought treatment and the symptoms they had.",
      "narrative",
      ["Symptoms", "Why they attended"],
    ),
    phase(
      "theTreatment",
      "The treatment",
      "What treatment or examination the patient says took place.",
      "narrative",
      ["Who saw them", "What was done"],
    ),
    phase(
      "whatTheyWereTold",
      "What they were told",
      "The advice, warnings, and choices the patient remembers being given.",
      "structured",
      ["Advice or warnings remembered", "Whether they were offered a choice"],
    ),
    phase(
      "whatHappenedNext",
      "What happened next",
      "How the patient says their condition changed after the treatment.",
      "narrative",
      ["Change in symptoms", "Further attendances"],
    ),
    phase(
      "effectSince",
      "Effect since",
      "How the patient says their health and daily life have been affected.",
      "narrative",
      ["Current symptoms", "Effect on daily life"],
    ),
  ],
  sections: [
    section("introduction", "Introduction", "Who the patient is."),
    section("whyTheyAttended", "Why I attended", "The symptoms and the reason for attending."),
    section("theTreatment", "The treatment", "The patient's account of the treatment."),
    section("whatTheyWereTold", "What I was told", "Advice, warnings, and choices the patient remembers."),
    section("whatHappenedNext", "What happened next", "How things changed afterwards."),
    section("effectSince", "Effect since", "The effect on health and daily life."),
  ],
});

const familyMember = statementConfig({
  modelIdentity:
    "You are interviewing a family member who was present during treatment. Take their account of what they saw and heard.",
  caseMetadataDeps: clinicalFields.map((item) => item.id),
  phases: [
    phase(
      "whyTheyWerePresent",
      "Why they were present",
      "The family member's relationship to the patient and why they were there.",
      "structured",
      ["Relationship to the patient", "Why they were present"],
    ),
    phase(
      "whatTheySawAndHeard",
      "What they saw and heard",
      "What the family member saw of the treatment and heard said.",
      "narrative",
      ["What they saw", "What they heard said"],
    ),
    phase(
      "thePatientsCondition",
      "The patient's condition",
      "How the patient appeared before, during, and after the treatment.",
      "mixed",
      ["Condition before", "Condition afterwards"],
    ),
    phase(
      "afterwards",
      "Afterwards",
      "What the family member saw of the patient's recovery or further treatment.",
      "narrative",
      ["Further treatment they witnessed", "Effect they have observed"],
    ),
  ],
  sections: [
    section("introduction", "Introduction", "Who the family member is and their relationship to the patient."),
    section("whatTheySawAndHeard", "What I saw and heard", "The family member's account of the treatment."),
    section("thePatientsCondition", "The patient's condition", "How the patient appeared."),
    section("afterwards", "Afterwards", "What the family member observed afterwards."),
  ],
});

function statement(
  id: string,
  name: string,
  config: StatementConfig,
): SeededStatementTemplate {
  return { id, name, config };
}

export const SEEDED_CASE_TEMPLATES: SeededCaseTemplate[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    name: "Road traffic collision",
    titleTemplate: "{claimant} v {defendant}",
    config: {
      matterBrief:
        "A road traffic collision. The review should follow how the collision happened, who was involved, and the injuries and losses that followed.",
      dynamicFields: roadTrafficFields,
    },
    statements: [
      {
        isDefault: true,
        template: statement(
          "22222222-2222-4222-8222-222222222201",
          "Claimant driver or passenger",
          roadTrafficClaimant,
        ),
      },
      {
        isDefault: false,
        template: statement(
          "22222222-2222-4222-8222-222222222202",
          "Independent witness to a road traffic collision",
          roadTrafficWitness,
        ),
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    name: "Accident at work",
    titleTemplate: "{claimant} v {defendant}",
    config: {
      matterBrief:
        "An accident at work. The review should follow the task being done, how the worker was hurt, and the effect on their work.",
      dynamicFields: workFields,
    },
    statements: [
      {
        isDefault: true,
        template: statement(
          "22222222-2222-4222-8222-222222222203",
          "Injured worker",
          injuredWorker,
        ),
      },
      {
        isDefault: false,
        template: statement(
          "22222222-2222-4222-8222-222222222204",
          "Colleague who saw an accident at work",
          workColleague,
        ),
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    name: "Public liability",
    titleTemplate: "{claimant} v {defendant}",
    config: {
      matterBrief:
        "An accident on premises. The review should follow why the injured person was there, the condition of the place, and how they were hurt.",
      dynamicFields: publicLiabilityFields,
    },
    statements: [
      {
        isDefault: true,
        template: statement(
          "22222222-2222-4222-8222-222222222205",
          "Injured person",
          injuredPerson,
        ),
      },
      {
        isDefault: false,
        template: statement(
          "22222222-2222-4222-8222-222222222206",
          "Independent witness to an accident on premises",
          publicWitness,
        ),
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    name: "Clinical negligence",
    titleTemplate: "{claimant} v {defendant}",
    config: {
      matterBrief:
        "A clinical negligence claim. The review should follow the treatment the patient describes, what they were told, and how their condition changed.",
      dynamicFields: clinicalFields,
    },
    statements: [
      {
        isDefault: true,
        template: statement(
          "22222222-2222-4222-8222-222222222207",
          "Patient",
          patient,
        ),
      },
      {
        isDefault: false,
        template: statement(
          "22222222-2222-4222-8222-222222222208",
          "Family member who was present",
          familyMember,
        ),
      },
    ],
  },
];

export const SEEDED_CASE_TEMPLATE_IDS = SEEDED_CASE_TEMPLATES.map(
  (template) => template.id,
);

export const SEEDED_STATEMENT_TEMPLATES = SEEDED_CASE_TEMPLATES.flatMap(
  (template) => template.statements.map((link) => link.template),
);

export const SEEDED_STATEMENT_TEMPLATE_IDS = SEEDED_STATEMENT_TEMPLATES.map(
  (template) => template.id,
);

export const APP_ADMIN_EMAIL = "uzair@caseyhq.co.uk";
