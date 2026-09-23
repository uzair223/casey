"use client";

import { useState } from "react";

import { Check } from "@/components/icons";

const plans = [
  { name: "Trial", amount: "Free", unit: "" },
  { name: "Starter", amount: "£149", unit: "/month" },
  { name: "Growth", amount: "£349", unit: "/month" },
] as const;

const glanceRows = [
  { label: "Seats", cells: ["5", "10", "Unlimited"] },
  { label: "Accepted leads", cells: ["3", "40/month", "120/month"] },
  { label: "Extra lead", cells: ["—", "£15", "£15"] },
  { label: "Hosted page", cells: ["Included", "Included", "Included"] },
  { label: "Website widget", cells: ["—", "—", "Included"] },
  { label: "Branding", cells: ["—", "—", "Included"] },
] as const;

const detailRows = [
  { label: "Text messages", cells: ["—", "—", "Included"] },
  { label: "Evidence and other people", cells: ["Included", "Included", "Included"] },
  { label: "Templates", cells: ["—", "Included", "Included"] },
  { label: "Facts and gaps", cells: ["—", "Included", "Included"] },
  { label: "Activity and signatures", cells: ["Included", "Included", "Included"] },
] as const;

function Cell({
  value,
  highlighted,
}: {
  value: string;
  highlighted: boolean;
}) {
  return (
    <td
      className={`p-5 text-center text-sm leading-6 text-white ${highlighted ? "bg-primary/[0.04]" : ""}`}
    >
      {value === "Included" ? (
        <Check className="mx-auto h-4 w-4 text-white" aria-label="Included" />
      ) : (
        value
      )}
    </td>
  );
}

function Rows({
  rows,
}: {
  rows: ReadonlyArray<{ label: string; cells: readonly string[] }>;
}) {
  return rows.map((row) => (
    <tr key={row.label} className="border-t border-primary/10">
      <th className="p-5 text-left text-sm font-medium text-white">
        {row.label}
      </th>
      {row.cells.map((cell, index) => (
        <Cell
          key={`${row.label}-${plans[index].name}`}
          value={cell}
          highlighted={plans[index].name === "Growth"}
        />
      ))}
    </tr>
  ));
}

export function PricingTable() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-primary/15">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-1/4" />
            <col className="w-1/4" />
            <col className="w-1/4" />
          </colgroup>
          <thead>
            <tr>
              <th className="border-b border-primary/15 p-5 text-left">
                <p className="font-display text-lg italic text-white">
                  At a glance
                </p>
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.name}
                  className={`border-b border-primary/15 p-5 text-center align-bottom ${plan.name === "Growth" ? "bg-primary/[0.04]" : ""}`}
                >
                  <p className="font-display text-xl text-white">{plan.name}</p>
                  <p className="mt-2 font-display text-3xl text-white">
                    {plan.amount}
                    {plan.unit ? (
                      <span className="ml-1 font-sans text-base text-white/50">
                        {plan.unit}
                      </span>
                    ) : null}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Rows rows={glanceRows} />
            {expanded ? <Rows rows={detailRows} /> : null}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="mt-4 text-sm text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-brand"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? "Show the main features" : "Show the full comparison"}
      </button>
    </div>
  );
}
