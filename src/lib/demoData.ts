import { Message, ProgressData } from "@/lib/types";
import { StatementDataResponse } from "@/lib/supabase/queries";

export const DEMO_STATEMENT_DATA: StatementDataResponse = {
  link_token: "demo",
  tenant_id: "tenant-123",
  case_id: "case-123",
  statement_id: "statement-123",
  tenant_name: "Smith & Associates Law",
  title: "Smith v Jones - Motor Vehicle Accident",
  incident_date: "2024-02-15",
  claim_number: "CLM-2024-0001",
  witness_name: "John Smith",
  witness_address: "12 Station Road, Stockport",
  witness_occupation: "Delivery Driver",
  witness_email: "john.smith@example.com",
  reference: "SA/2024/0001",
};

export const DEMO_MESSAGES: Message[] = [
  {
    id: "demo-2",
    role: "user",
    content:
      "I was driving through Stockport around 2:30 PM when a red BMW hit me at the junction with Chapel Street. The light was green for me. It came from my left and hit the driver's side hard. The whole impact happened pretty quickly.",
  },
  {
    id: "demo-3",
    role: "assistant",
    content:
      "Sorry to hear that. Let me ask - was it raining or dark, or was the weather clear and visibility good at that time?",
    progress: {
      currentPhase: 1,
      completedPhases: [],
      phaseCompleteness: {
        phase1: 15,
        phase2: 0,
        phase3: 0,
        phase4: 0,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 1, overallCompletion: 2 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-4",
    role: "user",
    content:
      "Clear day, good visibility. That's why I'm sure he didn't see me or just ignored the light. Either way, he came straight through.",
  },
  {
    id: "demo-5",
    role: "assistant",
    content:
      "Could you describe the other driver and their vehicle a bit more? Age, appearance - anything that stands out?",
    progress: {
      currentPhase: 1,
      completedPhases: [],
      phaseCompleteness: {
        phase1: 25,
        phase2: 0,
        phase3: 0,
        phase4: 0,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 1, overallCompletion: 4 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-6",
    role: "user",
    content:
      "He was a young guy, maybe late 20s or 30s, dark hair. The BMW was red - looked quite new actually. When he got out, he seemed confused, kept saying he didn't see my car. Shaking a bit.",
  },
  {
    id: "demo-7",
    role: "assistant",
    content:
      "Right. And do you remember if you heard any sound of braking - screeching, or did it seem like he didn't brake at all?",
    progress: {
      currentPhase: 1,
      completedPhases: [],
      phaseCompleteness: {
        phase1: 35,
        phase2: 0,
        phase3: 0,
        phase4: 0,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 1, overallCompletion: 6 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-8",
    role: "user",
    content:
      "No screeching at all. Just impact and his car pushed mine sideways. He definitely wasn't braking. He seemed to be on his phone or something when he hit me.",
  },
  {
    id: "demo-9",
    role: "assistant",
    content:
      "That's useful detail. Now for the vehicle damage - can you walk me through what happened to your car?",
    progress: {
      currentPhase: 2,
      completedPhases: [1],
      phaseCompleteness: {
        phase1: 80,
        phase2: 0,
        phase3: 0,
        phase4: 0,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 2, overallCompletion: 12 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-10",
    role: "user",
    content:
      "The whole driver's side is damaged. The front wing is crushed, the door is badly dented - won't even open now. The damage extends back to the rear quarter panel. I had it checked by a mechanic and the main frame might be slightly bent too.",
  },
  {
    id: "demo-11",
    role: "assistant",
    content:
      "Did your car have any damage or dents before the accident - anything pre-existing we should note?",
    progress: {
      currentPhase: 2,
      completedPhases: [1],
      phaseCompleteness: {
        phase2: 25,
        phase1: 80,
        phase3: 0,
        phase4: 0,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 2, overallCompletion: 18 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-12",
    role: "user",
    content:
      "No, the car was in perfect condition. It's a 2020 Ford Focus, really well maintained. That's why this is so frustrating.",
  },
  {
    id: "demo-13",
    role: "assistant",
    content: "Understandable. Do you have a repair estimate yet?",
    progress: {
      currentPhase: 2,
      completedPhases: [1],
      phaseCompleteness: {
        phase2: 45,
        phase1: 80,
        phase3: 0,
        phase4: 0,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 2, overallCompletion: 20 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-14",
    role: "user",
    content:
      "Yeah, two quotes actually. One for £7,500 and another for £7,900. The car wasn't safe to drive - I had it towed by recovery. The £7,500 one is from a trusted mechanic I know, so I'm going with that.",
  },
  {
    id: "demo-15",
    role: "assistant",
    content:
      "Good to have those quotes. Now - Storage & Recovery. How much did the recovery cost, and where's the car now?",
    progress: {
      currentPhase: 3,
      completedPhases: [1, 2],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 0,
        phase4: 0,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 3, overallCompletion: 35 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-16",
    role: "user",
    content:
      "Recovery was £150 - towed to Stockport Vehicle Services. The car's been sitting there for about three weeks now while they're working through the repairs. They had a backlog so couldn't start immediately.",
  },
  {
    id: "demo-17",
    role: "assistant",
    content:
      "Three weeks, got it. Are they charging storage fees on top of the repair cost, or is that included?",
    progress: {
      currentPhase: 3,
      completedPhases: [1, 2],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 15,
        phase4: 0,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 3, overallCompletion: 40 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-18",
    role: "user",
    content:
      "No separate storage charge - it's all covered in the £7,500 repair quote. They fix and store it there as part of their service.",
  },
  {
    id: "demo-19",
    role: "assistant",
    content:
      "Right. So during those three weeks without your car - did you need to hire something to get around?",
    progress: {
      currentPhase: 3,
      completedPhases: [1, 2],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 85,
        phase4: 0,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 3, overallCompletion: 50 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-20",
    role: "user",
    content:
      "Yes, I hired a Ford Fiesta through a local hire company. Cost me £35 a day for 21 days. So £735 total. Not ideal but I need a car for work.",
  },
  {
    id: "demo-21",
    role: "assistant",
    content:
      "Understood - what's your job, and how much did missing the car impact your work routine?",
    progress: {
      currentPhase: 4,
      completedPhases: [1, 2, 3],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 85,
        phase4: 20,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 4, overallCompletion: 55 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-22",
    role: "user",
    content:
      "I'm a software developer - work in an office in Manchester. The Fiesta worked fine for commuting. Smaller than my Focus but got the job done. I have all the hire receipts.",
  },
  {
    id: "demo-23",
    role: "assistant",
    content:
      "Good. Now let's talk about your injuries. Were you hurt in the collision?",
    progress: {
      currentPhase: 5,
      completedPhases: [1, 2, 3, 4],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 85,
        phase4: 85,
        phase5: 0,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 5, overallCompletion: 62 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-24",
    role: "user",
    content:
      "Yeah, I had immediate pain in my neck and right shoulder from the impact. Sharp pain right after. Woke up the next morning and it was worse - stiffness everywhere. Went to my GP that afternoon and he said it was whiplash.",
  },
  {
    id: "demo-25",
    role: "assistant",
    content:
      "How was it treated? Did you need hospital care or just GP follow-up?",
    progress: {
      currentPhase: 5,
      completedPhases: [1, 2, 3, 4],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 85,
        phase4: 85,
        phase5: 20,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 5, overallCompletion: 68 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-26",
    role: "user",
    content:
      "Just GP management. He prescribed anti-inflammatories and painkillers, and referred me for physiotherapy. I couldn't work for the first two weeks - the pain was intense. Went to physio once a week for 12 weeks, £50 per session. That's £600 total on physio.",
  },
  {
    id: "demo-27",
    role: "assistant",
    content:
      "How are you doing now? Are the symptoms resolved or still dealing with any ongoing issues?",
    progress: {
      currentPhase: 5,
      completedPhases: [1, 2, 3, 4],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 85,
        phase4: 85,
        phase5: 40,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 5, overallCompletion: 74 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-28",
    role: "user",
    content:
      "Much better than it was. Most of the pain is gone, but I still get occasional stiffness in my neck, especially if I've been at my desk for too long. Turning my head quickly still causes a twinge. Physio helped a lot though.",
  },
  {
    id: "demo-29",
    role: "assistant",
    content:
      "Understood. Apart from the two weeks off work - was that paid leave or lost wages?",
    progress: {
      currentPhase: 6,
      completedPhases: [1, 2, 3, 4, 5],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 85,
        phase4: 85,
        phase5: 85,
        phase6: 0,
        phase7: 0,
      },
      structuredData: { currentPhase: 6, overallCompletion: 78 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-30",
    role: "user",
    content:
      "Lost wages. I'm not entitled to sick pay where I work beyond the statutory minimum, and my employer only covers the first three days. So £1,200 out of pocket - I earn £600 a week. Then there's prescriptions at £25 and about £80 on transport to physio appointments.",
  },
  {
    id: "demo-31",
    role: "assistant",
    content:
      "Okay, so to summarize financial losses - car repair £7,500, recovery £150, hire car £735, physio £600, lost wages £1,200, prescriptions and transport £105. Do you have receipts and documentation for all of this?",
    progress: {
      currentPhase: 6,
      completedPhases: [1, 2, 3, 4, 5],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 85,
        phase4: 85,
        phase5: 85,
        phase6: 60,
        phase7: 0,
      },
      structuredData: { currentPhase: 6, overallCompletion: 85 },
      readyToPrepare: false,
    },
    meta: {
      requiresEvidenceUpload: true,
    },
  },
  {
    id: "demo-32",
    role: "user",
    content:
      "Yes, all of it. Repair quotes, hire agreement, physio invoices, GP referral, prescription receipts. Everything.",
    meta: {
      requiresEvidenceUpload: true,
      allowedTypes: ["image/*", "application/pdf"],
    },
  },
  {
    id: "demo-33",
    role: "assistant",
    content:
      "Excellent. Finally - Evidence. Were there any witnesses to what happened?",
    progress: {
      currentPhase: 7,
      completedPhases: [1, 2, 3, 4, 5, 6],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 85,
        phase4: 85,
        phase5: 85,
        phase6: 85,
        phase7: 0,
      },
      structuredData: { currentPhase: 7, overallCompletion: 90 },
      readyToPrepare: false,
    },
  },
  {
    id: "demo-34",
    role: "user",
    content:
      "Yes - there were several cars around at the junction. Two people actually stopped and saw the whole thing. I got their names and phone numbers. One was a woman in a blue Audi, another was a man on his way home from work.",
  },
  {
    id: "demo-35",
    role: "assistant",
    content:
      "Good witnesses. Do you have any other evidence - dashcam footage, police report?",
    progress: {
      currentPhase: 7,
      completedPhases: [1, 2, 3, 4, 5, 6],
      phaseCompleteness: {
        phase1: 80,
        phase2: 85,
        phase3: 85,
        phase4: 85,
        phase5: 85,
        phase6: 85,
        phase7: 15,
      },
      structuredData: { currentPhase: 7, overallCompletion: 92 },
      readyToPrepare: false,
    },
    meta: {
      requiresEvidenceUpload: true,
      allowedTypes: ["image/*", "video/*", "application/pdf"],
    },
  },
  {
    id: "demo-36",
    role: "user",
    content:
      "I have dashcam footage - captured the whole thing, really clear. Police attended the scene and took statements. I have the incident report reference: SP/2024/156789. Plus all my medical records and repair documentation.",
  },
  {
    id: "demo-37",
    role: "assistant",
    content:
      "Perfect. That's comprehensive documentation. We've covered all seven phases of your case. Your statement is complete and ready for formal preparation. Shall we move on to creating your formal statement document?",
    progress: {
      currentPhase: 7,
      completedPhases: [1, 2, 3, 4, 5, 6, 7],
      phaseCompleteness: {
        phase1: 85,
        phase2: 85,
        phase3: 85,
        phase4: 85,
        phase5: 85,
        phase6: 85,
        phase7: 100,
      },
      structuredData: { currentPhase: 7, overallCompletion: 100 },
      readyToPrepare: true,
    },
  },
];

export const DEMO_FORMAL: Record<string, string> = {
  incident_details:
    "On 15th February 2024 at approximately 2:30 PM, I was driving my blue Ford Focus along Manchester Road in Stockport, heading towards the traffic lights at the junction with Chapel Street. The traffic light was green in my direction, and I was proceeding through the intersection when a red BMW, traveling from Chapel Street, entered the junction without stopping and struck the nearside of my vehicle. The driver was a young man, probably in his 20s or 30s. The impact was severe, with significant damage to my vehicle.",
  vehicle_damage:
    "The damage to my vehicle was extensive on the nearside. The front nearside wing was crushed, the door was dented along its entire length, and there was damage to the rear quarter panel. The windows on that side remained intact but the paintwork was badly scraped. The vehicle was undriveable at the scene. A repair estimate of approximately £7,500 was obtained.",
  recovery_storage:
    "The vehicle was recovered to Stockport Vehicle Recovery Services. The recovery charge was £150. The vehicle remained there for approximately three weeks during the repair period. There was no separate storage cost as the garage has in-house facilities.",
  credit_hire:
    "I required a substitute vehicle for the three weeks during repairs. I obtained a Ford Fiesta on an equivalent vehicle hire arrangement at £35 per day, totaling £735 for 21 days. All receipts and documentation have been retained.",
  injuries_medical:
    "I sustained significant whiplash to my neck and upper back from the impact, with bruising to my right shoulder and arm. The following day, I visited my GP who diagnosed acute cervical strain and prescribed rest, anti-inflammatory medication, and physiotherapy. I have attended 12 physiotherapy sessions over six weeks. Pain has improved significantly but I still experience discomfort during certain movements.",
  financial_losses:
    "Beyond vehicle and hire costs, I incurred physiotherapy costs of £50 per session, totaling £600, prescription costs of approximately £25, lost wages of £1,200 for two weeks off work due to pain, and transport costs of approximately £80 for travel to medical appointments.",
  evidence:
    "There were several witnesses at the scene, including at least four other drivers. I exchanged contact details with two of them. I have dashcam footage showing the BMW entering the junction against the red light. Police attended and issued report reference SP/2024/156789. I have copies of all repair estimates, medical reports from my GP and physiotherapist, and photographs of the vehicle damage.",
};
