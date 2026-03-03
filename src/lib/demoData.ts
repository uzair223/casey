import { StatementDataResponse } from "./supabase/queries";
import { Message } from "./types";

const DEMO_REFERENCE = "REF-29387";
export const DEMO_CONVERSATION: Message[] = [
  {
    role: "assistant",
    content: `Hello Jane Doe, Im here to help you prepare your witness statement for Doe vs. Company (Reference: ${DEMO_REFERENCE}).\nIll guide you through the information collection process to ensure we capture all the important details accurately.`,
  },
  {
    role: "assistant",
    content:
      "To begin, could you please provide your full home address and occupation?",
    meta: {
      evidence: { record: [] },
      progress: {
        currentPhase: 0,
        readyToPrepare: false,
        completedPhases: [],
        overallCompletion: 0,
        phaseCompleteness: {
          phase0: 0,
          phase1: 0,
          phase2: 0,
          phase3: 0,
          phase4: 0,
          phase5: 0,
          phase6: 0,
          phase7: 0,
        },
      },
      witnessDetails: {},
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content: "I live at 123 Street Road, PR1 2AB. I am a full-time student.",
  },
  {
    role: "assistant",
    content:
      "Thank you. Could you describe what happened, including where and when the incident occurred?",

    meta: {
      evidence: { record: [], currentAsk: null },
      progress: {
        currentPhase: 1,
        readyToPrepare: false,
        completedPhases: [0],
        overallCompletion: 12.5,
        phaseCompleteness: {
          phase0: 100,
          phase1: 0,
          phase2: 0,
          phase3: 0,
          phase4: 0,
          phase5: 0,
          phase6: 0,
          phase7: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "The accident happened on 12 February 2026 at around 5:30pm on Blackpool Road near the junction with Moor Lane. I was stopped in traffic when the vehicle behind failed to brake and hit the rear of my car.",
  },
  {
    role: "assistant",
    content:
      "Could you provide the other vehicle's make, model and registration, and any details you have about the driver involved?",

    meta: {
      evidence: { record: [], currentAsk: null },
      progress: {
        currentPhase: 1,
        readyToPrepare: false,
        completedPhases: [0],
        overallCompletion: 25,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 0,
          phase3: 0,
          phase4: 0,
          phase5: 0,
          phase6: 0,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "The other vehicle was a 2018 BMW 3 Series, registration AB18 CDE. I exchanged details with the other driver.",
  },
  {
    role: "assistant",
    content:
      "Could you provide the make, model and registration of your own vehicle, and describe the damage it sustained?",

    meta: {
      evidence: { record: [], currentAsk: null },
      progress: {
        currentPhase: 2,
        readyToPrepare: false,
        completedPhases: [0, 1],
        overallCompletion: 35,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 30,
          phase3: 0,
          phase4: 0,
          phase5: 0,
          phase6: 0,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "My vehicle is a 2016 Volkswagen Golf, registration YK16 XYZ.\nThe rear bumper was cracked, the boot lid was dented, and the rear lights were damaged. The impact also caused alignment issues with the rear sensors.",
  },
  {
    role: "assistant",
    content:
      "Could you tell me what damage, if any, was caused to the other vehicle involved in the collision?",

    meta: {
      evidence: { record: [], currentAsk: null },
      progress: {
        currentPhase: 2,
        readyToPrepare: false,
        completedPhases: [0, 1],
        overallCompletion: 45,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 70,
          phase3: 0,
          phase4: 0,
          phase5: 0,
          phase6: 0,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "I dont remember exactly the damage of the other vehicle but I have pictures of the incident",
  },
  {
    role: "assistant",
    content: "Can you describe any visible damage to the other vehicle?",

    meta: {
      evidence: {
        record: [{ name: "Incident Photos", type: "image/*" }],
        currentAsk: null,
      },
      progress: {
        currentPhase: 2,
        readyToPrepare: false,
        completedPhases: [0, 1],
        overallCompletion: 55,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 80,
          phase3: 0,
          phase4: 0,
          phase5: 0,
          phase6: 0,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content: "The front of the car was completely dented and scratched",
  },
  {
    role: "assistant",
    content:
      "The front of the other vehicle was completely dented and scratched, noted.\n\nCould you tell me how your car was recovered after the collision and where it was stored?",

    meta: {
      evidence: {
        record: [{ name: "Incident Photos", type: "image/*" }],
        currentAsk: null,
      },
      progress: {
        currentPhase: 3,
        readyToPrepare: false,
        completedPhases: [0, 1, 2],
        overallCompletion: 65,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 100,
          phase3: 0,
          phase4: 0,
          phase5: 0,
          phase6: 0,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "My car was recovered by a local recovery service arranged through my insurer.\nIt was taken to Preston Auto Repairs for inspection and storage.\nIt remained there pending the repair estimate.\n",
  },
  {
    role: "assistant",
    content:
      "Did you arrange a hire vehicle after the accident, and if so, what were the daily or total hire costs and the hire company involved?",

    meta: {
      evidence: {
        record: [
          { name: "Incident Photos", type: "image/*" },
          { name: "Other Vehicle Damage Photo", type: "image/*" },
        ],
        currentAsk: null,
      },
      progress: {
        currentPhase: 4,
        readyToPrepare: false,
        completedPhases: [0, 1, 2, 3],
        overallCompletion: 80,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 100,
          phase3: 100,
          phase4: 0,
          phase5: 0,
          phase6: 0,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "Yes, I arranged a hire car myself through Enterprise Rent-A-Car.\nThe daily hire cost was £35, and I hired it for 7 days, totaling £245.\nI paid for this out-of-pocket as it wasn't covered by my insurance.\n",
  },
  {
    role: "assistant",
    content:
      "Did you sustain any injuries and receive medical treatment as a result of the collision?",

    meta: {
      evidence: {
        record: [{ name: "Incident Photographs", type: "image/*" }],
        currentAsk: null,
      },
      progress: {
        currentPhase: 5,
        readyToPrepare: false,
        completedPhases: [0, 1, 2, 3, 4],
        overallCompletion: 90,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 100,
          phase3: 100,
          phase4: 100,
          phase5: 0,
          phase6: 0,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "Yes, I suffered a stiff neck and mild whiplash. I visited my GP the following day.\nI was advised to rest and prescribed physiotherapy sessions.\n",
  },
  {
    role: "assistant",
    content:
      "Could you tell me the date you saw your GP, any diagnosis or prescription you received, and the details of the physiotherapy (provider, number of sessions, and dates)?",

    meta: {
      evidence: {
        record: [
          { name: "Photographs of Accident Scene", type: "image/*" },
          { name: "Photographs of Vehicle Damage", type: "image/*" },
        ],
        currentAsk: { name: "Medical Report", type: "application/pdf" },
      },
      progress: {
        currentPhase: 5,
        readyToPrepare: false,
        completedPhases: [0, 1, 2, 3, 4],
        overallCompletion: 95,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 100,
          phase3: 100,
          phase4: 100,
          phase5: 50,
          phase6: 0,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "I saw my GP on 13 February 2026.\nThe diagnosis was whiplash, and I was prescribed pain relief and referred for physiotherapy.\nPhysiotherapy was with Preston Physio Clinic, for six sessions between 15 February and 28 February 2026.",
  },
  {
    role: "assistant",
    content:
      "Could you let me know whether you have any medical receipts, invoices, or reports for the GP consultation, medication, or physiotherapy sessions, and what their approximate amounts are?",

    meta: {
      evidence: {
        record: [
          { name: "Photographs of Accident Scene", type: "image/*" },
          { name: "Photographs of Vehicle Damage", type: "image/*" },
        ],
        currentAsk: {
          name: "Medical Receipts and Reports",
          type: "application/pdf,image/*",
        },
      },
      progress: {
        currentPhase: 5,
        readyToPrepare: false,
        completedPhases: [0, 1, 2, 3, 4],
        overallCompletion: 95,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 100,
          phase3: 100,
          phase4: 100,
          phase5: 50,
          phase6: 0,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "Yes, I have receipts and invoices for all treatments.\nThe GP was free under NHS, the prescribed medication was £12, and the six physiotherapy sessions totaled £180.\nI also have the physiotherapy progress reports and the GP's medical note",
  },
  {
    role: "assistant",
    content:
      "Did you incur any other out-of-pocket expenses such as loss of earnings, travel, parking or additional vehicle-hire costs beyond what you have already mentioned?",

    meta: {
      evidence: {
        record: [
          { name: "GP Medical Note", type: "application/pdf" },
          { name: "Physiotherapy Progress Reports", type: "application/pdf" },
          { name: "Medical Receipts & Invoices", type: "application/pdf" },
        ],
        currentAsk: null,
      },
      progress: {
        currentPhase: 6,
        readyToPrepare: false,
        completedPhases: [0, 1, 2, 3, 4, 5],
        overallCompletion: 95,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 100,
          phase3: 100,
          phase4: 100,
          phase5: 100,
          phase6: 0,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content: "No",
  },
  {
    role: "assistant",
    content:
      "Do you have any photographs, videos, dash-cam footage, police reports, or other documents that relate to the accident?",

    meta: {
      evidence: {
        record: [
          { name: "GP medical note", type: "application/pdf" },
          { name: "Physiotherapy progress reports", type: "application/pdf" },
          { name: "Photographs of accident scene", type: "image/*" },
        ],
        currentAsk: {
          name: "Accident Photographs/Videos/Dash-cam Footage/Police Report",
          type: "image/*,video/*,application/pdf",
        },
      },
      progress: {
        currentPhase: 7,
        readyToPrepare: false,
        completedPhases: [0, 1, 2, 3, 4, 5, 6],
        overallCompletion: 88,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 100,
          phase3: 100,
          phase4: 100,
          phase5: 100,
          phase6: 100,
          phase7: 0,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "I have photos of both vehicles showing the damage. I also have dash-cam footage from my car capturing the moment of impact. The police werent called",
  },
  {
    role: "assistant",
    content:
      "Do you have any other evidence such as witness statements, medical reports, or insurance correspondence?",

    meta: {
      evidence: {
        record: [
          { name: "Vehicle Damage Photos", type: "image/*" },
          { name: "Dashcam Footage", type: "video/*" },
        ],
        currentAsk: null,
      },
      progress: {
        currentPhase: 7,
        readyToPrepare: false,
        completedPhases: [0, 1, 2, 3, 4, 5, 6],
        overallCompletion: 94,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 100,
          phase3: 100,
          phase4: 100,
          phase5: 100,
          phase6: 100,
          phase7: 50,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content:
      "I have email correspondence with my insurer and Whatsapp messages with the other driver",
  },
  {
    role: "assistant",
    content:
      "Do you have any additional evidence such as CCTV footage of the junction or a written police report?",

    meta: {
      evidence: {
        record: [
          { name: "Insurer Email Correspondence", type: "application/pdf" },
          { name: "WhatsApp Messages with Other Driver", type: "text/plain" },
        ],
        currentAsk: {
          name: "CCTV footage or police report",
          type: "video/*,application/pdf",
        },
      },
      progress: {
        currentPhase: 7,
        readyToPrepare: false,
        completedPhases: [0, 1, 2, 3, 4, 5, 6],
        overallCompletion: 70,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 100,
          phase3: 100,
          phase4: 100,
          phase5: 100,
          phase6: 100,
          phase7: 70,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content: "No",
  },
  {
    role: "assistant",
    content:
      "Do you have any other evidence or information you would like to add before we finish?",

    meta: {
      evidence: {
        record: [
          { name: "Vehicle Damage Photos", type: "image/*" },
          { name: "Dashcam Footage", type: "video/*" },
          { name: "Insurer Email Correspondence", type: "application/pdf" },
          { name: "WhatsApp Messages with Other Driver", type: "text/plain" },
        ],
        currentAsk: null,
      },
      progress: {
        currentPhase: 7,
        readyToPrepare: false,
        completedPhases: [0, 1, 2, 3, 4, 5, 6, 7],
        overallCompletion: 80,
        phaseCompleteness: {
          phase0: 100,
          phase1: 75,
          phase2: 100,
          phase3: 100,
          phase4: 100,
          phase5: 100,
          phase6: 100,
          phase7: 100,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
  {
    role: "user",
    content: "No",
  },
  {
    role: "assistant",
    content:
      "Thank you, I have recorded all the details and evidence you mentioned. If everything looks correct, shall we proceed to prepare the statement?",

    meta: {
      evidence: {
        record: [
          { name: "Photos of both vehicles", type: "image/*" },
          { name: "Dashcam footage", type: "video/*" },
          { name: "Email correspondence with insurer", type: "text/plain" },
          { name: "WhatsApp messages with other driver", type: "text/plain" },
          { name: "Physiotherapy progress reports", type: "application/pdf" },
          { name: "GP medical note", type: "application/pdf" },
          { name: "Medication receipt", type: "application/pdf" },
          { name: "Physiotherapy invoices", type: "application/pdf" },
        ],
        currentAsk: null,
      },
      progress: {
        currentPhase: 7,
        readyToPrepare: true,
        completedPhases: [0, 1, 2, 3, 4, 5, 6, 7],
        overallCompletion: 100,
        phaseCompleteness: {
          phase0: 100,
          phase1: 100,
          phase2: 100,
          phase3: 100,
          phase4: 100,
          phase5: 100,
          phase6: 100,
          phase7: 100,
          phase8: 0,
        },
      },
      deviation: null,
      witnessDetails: {
        address: "123 Street Road, PR1 2AB",
        occupation: "full-time student",
      },
      ignoredMissingDetails: [],
    },
  },
];

export const DEMO_STATEMENT_DATA: StatementDataResponse<true> = {
  id: "23984a48-9275-42b5-8aca-ce585c858312",
  tenant_id: "a8df0f94-f71c-4a93-95cc-f99894e931ad",
  tenant_name: "Smith & Partners",
  title: "Doe vs. Company",
  reference: DEMO_REFERENCE,
  claim_number: null,
  assigned_to: null,
  assigned_to_ids: [],
  witness_name: "Jane Doe",
  witness_address: "123 Street Road, PR1 2AB",
  witness_occupation: "full-time student",
  witness_email: "uzairpatel223@outlook.com",
  incident_date: null,
  status: "submitted",
  sections: {
    evidence:
      "I have photos of both vehicles showing the damage, dash-cam footage of the impact, email correspondence with my insurer, WhatsApp messages with the other driver, the GP’s medical note, medication receipt, physiotherapy progress reports and physiotherapy invoices.",
    credit_hire:
      "I arranged a hire car through Enterprise Rent-A-Car at £35 per day for 7 days, totalling £245, which I paid out-of-pocket.",
    vehicle_damage:
      "My vehicle is a 2016 Volkswagen Golf, registration YK16 XYZ. The rear bumper was cracked, the boot lid was dented, the rear lights were damaged and the rear sensors were misaligned. The other vehicle, a 2018 BMW 3 Series, registration AB18 CDE, had its front completely dented and scratched.",
    financial_losses:
      "Medication cost was £12 and physiotherapy invoices totalled £180; the hire car cost £245.",
    incident_details:
      "The accident happened on 12 February 2026 at around 5:30pm on Blackpool Road near the junction with Moor Lane. I was stopped in traffic when the vehicle behind failed to brake and hit the rear of my car.",
    injuries_medical:
      "I suffered a stiff neck and mild whiplash, saw my GP on 13 February 2026 who diagnosed whiplash, prescribed pain relief and referred me to physiotherapy. I attended six physiotherapy sessions at Preston Physio Clinic between 15 February and 28 February 2026.",
    recovery_storage:
      "My car was recovered by a local recovery service arranged through my insurer and taken to Preston Auto Repairs for inspection and storage pending a repair estimate.",
  },
  signed_document: null,
  supporting_documents: [],
  created_at: "2026-02-28 16:00:00.000000+00",
  updated_at: "2026-02-28 16:30:00.000000+00",
  link: {
    token: "demo",
    expires_at: "",
  },
  messages: DEMO_CONVERSATION,
  has_history: true,
};
