import { StatementUseCaseConfig } from ".";

// Personal Injury / Motor Accident Configuration
export const PERSONAL_INJURY_CONFIG: StatementUseCaseConfig = {
  id: "personal_injury",
  name: "Personal Injury Statement",
  agents: {
    chat: "You are a live intake interviewer assisting a solicitor in England for a personal injury claim.",
    formalize:
      "You are a legal assistant in England specializing in witness statement preparation. Your task is to convert informal witness responses into formal sections suitable for inclusion in an official witness statement template.",
  },
  includeStatementOfTruth: true,
  phases: [
    {
      id: "details",
      title: "DETAILS",
      description:
        "Witness's full address (house number, street, postcode) and occupation if not provided",
      order: 0,
    },
    {
      id: "incident",
      title: "INCIDENT",
      description: "What happened, where, when, and who was involved",
      order: 1,
    },
    {
      id: "vehicle_damage",
      title: "VEHICLE DAMAGE",
      description:
        "Details about damage to witness vehicle and third-party vehicles involved. Witness's vehicle detail must include make/model/reg.",
      order: 2,
    },
    {
      id: "recovery_storage",
      title: "RECOVERY & STORAGE",
      description: "Vehicle recovery and storage information",
      order: 3,
    },
    {
      id: "credit_hire",
      title: "CREDIT HIRE",
      description: "Vehicle hire costs and arrangements",
      order: 4,
    },
    {
      id: "injuries_medical",
      title: "INJURIES & MEDICAL",
      description: "Injuries sustained and medical treatment",
      order: 5,
    },
    {
      id: "financial_losses",
      title: "FINANCIAL LOSSES",
      description: "Financial impact and expenses",
      order: 6,
    },
    {
      id: "evidence",
      title: "EVIDENCE",
      description: "Witnesses, photos, documents, or other evidence",
      order: 7,
    },
  ],
  sections: [
    {
      field: "incident_details",
      title: "INCIDENT DETAILS",
      description: "What happened, where, when, and who was involved",
      placeholder:
        "Describe the incident in detail, including date, time, location, and parties involved...",
    },
    {
      field: "vehicle_damage",
      title: "VEHICLE DAMAGE",
      description: "Details about damage to vehicles involved",
      placeholder:
        "Describe the damage to vehicles, including location of damage and extent of injury...",
    },
    {
      field: "recovery_storage",
      title: "RECOVERY & STORAGE",
      description: "Vehicle recovery and storage information",
      placeholder:
        "Describe vehicle recovery, storage location, and associated costs...",
    },
    {
      field: "credit_hire",
      title: "CREDIT HIRE",
      description: "Vehicle hire costs and arrangements",
      placeholder:
        "Describe any vehicle hire arrangements and associated costs...",
    },
    {
      field: "injuries_medical",
      title: "INJURIES & MEDICAL",
      description: "Injuries sustained and medical treatment",
      placeholder:
        "Describe injuries sustained and medical treatment sought or received...",
    },
    {
      field: "financial_losses",
      title: "FINANCIAL LOSSES",
      description: "Financial impact and expenses",
      placeholder:
        "Describe financial losses, expenses incurred, and economic impact...",
    },
    {
      field: "evidence",
      title: "EVIDENCE",
      description: "Witnesses, photos, documents, or other evidence",
      placeholder:
        "List witnesses, photographs, documents, or other evidence available...",
    },
  ],
};
