"use client";

import { useForm, FormProvider } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface NewCaseFormProps {
  isOpen: boolean;
  status: string | null;
  role: string | null;
  form: {
    title: string;
    reference: string;
    claimNumber: string;
    witnessName: string;
    witnessAddress: string;
    witnessOccupation: string;
    witnessEmail: string;
    incidentDate: string;
    assignedTo: string;
  };
  teamMembers: { user_id: string; role: string; email: string | null }[];
  onFormChange: (updates: Partial<NewCaseFormProps["form"]>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onClose: () => void;
}

export function NewCaseForm({
  isOpen,
  status,
  role,
  form,
  teamMembers,
  onFormChange,
  onSubmit,
  onClose,
}: NewCaseFormProps) {
  const methods = useForm();

  if (!isOpen) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Create a new case</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormProvider {...methods}>
          <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
            <div className="form-item">
              <Input
                id="new-title"
                value={form.title}
                onChange={(e) => onFormChange({ title: e.target.value })}
                placeholder="Road traffic collision"
                required
              />
              <Label htmlFor="new-title">Case title</Label>
            </div>
            <div className="form-item">
              <Input
                id="new-reference"
                value={form.reference}
                onChange={(e) => onFormChange({ reference: e.target.value })}
                placeholder="REF-2026-014"
                required
              />
              <Label htmlFor="new-reference">Reference</Label>
            </div>
            <div className="form-item">
              <Input
                id="new-claimNumber"
                value={form.claimNumber}
                onChange={(e) => onFormChange({ claimNumber: e.target.value })}
                placeholder="CLM-2026-014"
              />
              <Label htmlFor="new-claimNumber">Claim number</Label>
            </div>
            <div className="form-item">
              <Input
                id="new-witnessName"
                value={form.witnessName}
                onChange={(e) => onFormChange({ witnessName: e.target.value })}
                placeholder="Jane Doe"
                required
              />
              <Label htmlFor="new-witnessName">Witness name</Label>
            </div>
            <div className="form-item">
              <Input
                id="new-witnessAddress"
                value={form.witnessAddress}
                onChange={(e) =>
                  onFormChange({ witnessAddress: e.target.value })
                }
                placeholder="123 High Street, Manchester"
              />
              <Label htmlFor="new-witnessAddress">Witness address</Label>
            </div>
            <div className="form-item">
              <Input
                id="new-witnessOccupation"
                value={form.witnessOccupation}
                onChange={(e) =>
                  onFormChange({ witnessOccupation: e.target.value })
                }
                placeholder="Engineer"
              />
              <Label htmlFor="new-witnessOccupation">Witness occupation</Label>
            </div>
            <div className="form-item">
              <Input
                id="new-witnessEmail"
                type="email"
                value={form.witnessEmail}
                onChange={(e) => onFormChange({ witnessEmail: e.target.value })}
                placeholder="jane.doe@example.com"
                required
              />
              <Label htmlFor="new-witnessEmail">Witness email</Label>
            </div>
            <div className="form-item">
              <Input
                id="new-incidentDate"
                type="date"
                value={form.incidentDate}
                onChange={(e) => onFormChange({ incidentDate: e.target.value })}
              />
              <Label htmlFor="new-incidentDate">Incident date</Label>
            </div>
            {role === "tenant_admin" || role === "solicitor" ? (
              <div className="form-item">
                <Select>
                  <SelectTrigger>
                    <SelectValue
                      id="new-assignedTo"
                      placeholder="Unassigned"
                      defaultValue="null"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="null">Unassigned</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.email} ({member.role})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Label htmlFor="new-assignedTo">Assigned to</Label>
              </div>
            ) : null}
            <div className="col-span-2 flex gap-2">
              <AsyncButton type="submit" pendingText="Creating...">
                Create case
              </AsyncButton>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </FormProvider>
        {status ? (
          <p
            className={
              status.includes("success") ? "text-green-600" : "text-red-600"
            }
          >
            {status}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
