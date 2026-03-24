import type { FlowApiResponse, FlowListApiResponse } from "./flow.types"

// ─── Flow 1 — Standard Quote ────────────────────────────────────────────────

export const mockStandardQuoteFlow: FlowApiResponse = {
  success: true,
  data: {
    id: "019d1b4b-4dfe-7090-9079-5f9f560421db",
    name: "Standard Quote",
    description: "Default quote flow for most clients.",
    steps: [
      {
        id: "019d1b4c-0001-7b03-b2f5-b6dfb44ed7a1",
        title: "Contact Information",
        description: "Collect basic client details.",
        rank: "0|a",
        fields: [
          { id: "f-001", label: "First name", type: "text" },
          { id: "f-002", label: "Last name", type: "text" },
          { id: "f-003", label: "Email", type: "email" },
          { id: "f-004", label: "Phone", type: "tel" },
        ],
      },
      {
        id: "019d1b4c-0002-7b03-b2f5-b6dfb44ed7a2",
        title: "Project Details",
        description: "Describe the scope of the project.",
        rank: "0|b",
        fields: [
          { id: "f-005", label: "Project name", type: "text" },
          { id: "f-006", label: "Description", type: "textarea" },
          { id: "f-007", label: "Start date", type: "date" },
        ],
      },
      {
        id: "019d1b4c-0003-7b03-b2f5-b6dfb44ed7a3",
        title: "Budget & Timeline",
        description: "Estimated budget and delivery expectations.",
        rank: "0|c",
        fields: [
          { id: "f-008", label: "Budget (€)", type: "number" },
          { id: "f-009", label: "Deadline", type: "date" },
          { id: "f-010", label: "Flexibility", type: "select" },
        ],
      },
      {
        id: "019d1b4c-0004-7b03-b2f5-b6dfb44ed7a4",
        title: "Review & Submit",
        description: "Summary and final confirmation.",
        rank: "0|d",
        fields: [
          { id: "f-011", label: "Additional notes", type: "textarea" },
          { id: "f-012", label: "Accept terms", type: "checkbox" },
        ],
      },
    ],
  },
}

// ─── Flow 2 — Enterprise Quote ──────────────────────────────────────────────

export const mockEnterpriseQuoteFlow: FlowApiResponse = {
  success: true,
  data: {
    id: "019d1b4b-4dfe-7090-9079-5f9f560421dc",
    name: "Enterprise Quote",
    description: "Extended flow for large accounts.",
    steps: [
      {
        id: "019d1b4c-0010-7b03-b2f5-b6dfb44ed7b1",
        title: "Company Information",
        description: "Legal entity and contact details.",
        rank: "0|a",
        fields: [
          { id: "f-101", label: "Company name", type: "text" },
          { id: "f-102", label: "SIRET", type: "text" },
          { id: "f-103", label: "Contact email", type: "email" },
          { id: "f-104", label: "Website", type: "url" },
        ],
      },
      {
        id: "019d1b4c-0011-7b03-b2f5-b6dfb44ed7b2",
        title: "Technical Requirements",
        description: "Stack, integrations and constraints.",
        rank: "0|b",
        fields: [
          { id: "f-105", label: "Tech stack", type: "text" },
          { id: "f-106", label: "Existing integrations", type: "textarea" },
          { id: "f-107", label: "Security requirements", type: "select" },
        ],
      },
      {
        id: "019d1b4c-0012-7b03-b2f5-b6dfb44ed7b3",
        title: "Team & Governance",
        description: "Project stakeholders and decision makers.",
        rank: "0|c",
        fields: [
          { id: "f-108", label: "Project owner", type: "text" },
          { id: "f-109", label: "Technical lead", type: "text" },
          { id: "f-110", label: "Team size", type: "number" },
        ],
      },
      {
        id: "019d1b4c-0013-7b03-b2f5-b6dfb44ed7b4",
        title: "Commercial Terms",
        description: "Pricing model and contractual preferences.",
        rank: "0|d",
        fields: [
          { id: "f-111", label: "Budget range", type: "select" },
          { id: "f-112", label: "Billing preference", type: "select" },
          { id: "f-113", label: "Contract duration", type: "select" },
        ],
      },
      {
        id: "019d1b4c-0014-7b03-b2f5-b6dfb44ed7b5",
        title: "Review & Submit",
        description: "Summary and final confirmation.",
        rank: "0|e",
        fields: [
          { id: "f-114", label: "Additional notes", type: "textarea" },
          { id: "f-115", label: "Accept NDA", type: "checkbox" },
          { id: "f-116", label: "Accept terms", type: "checkbox" },
        ],
      },
    ],
  },
}

// ─── Flow 3 — Rapid Quote ───────────────────────────────────────────────────

export const mockRapidQuoteFlow: FlowApiResponse = {
  success: true,
  data: {
    id: "019d1b4b-4dfe-7090-9079-5f9f560421dd",
    name: "Rapid Quote",
    description: "Minimal flow for quick estimates.",
    steps: [
      {
        id: "019d1b4c-0020-7b03-b2f5-b6dfb44ed7c1",
        title: "Contact & Project",
        description: "Essential info in one step.",
        rank: "0|a",
        fields: [
          { id: "f-201", label: "Full name", type: "text" },
          { id: "f-202", label: "Email", type: "email" },
          { id: "f-203", label: "Project summary", type: "textarea" },
          { id: "f-204", label: "Budget (€)", type: "number" },
        ],
      },
      {
        id: "019d1b4c-0021-7b03-b2f5-b6dfb44ed7c2",
        title: "Confirm",
        description: "Quick review before submission.",
        rank: "0|b",
        fields: [
          { id: "f-205", label: "Accept terms", type: "checkbox" },
        ],
      },
    ],
  },
}

// ─── Default export & list ───────────────────────────────────────────────────

export const mockFlowResponse = mockStandardQuoteFlow

export const mockFlowListResponse: FlowListApiResponse = {
  success: true,
  data: [
    mockStandardQuoteFlow.data,
    mockEnterpriseQuoteFlow.data,
    mockRapidQuoteFlow.data,
  ],
}
