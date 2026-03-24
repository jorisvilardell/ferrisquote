import type { FlowApiResponse } from "./flow.types"

export const mockFlowResponse: FlowApiResponse = {
  success: true,
  data: {
    id: "019d1b4b-4dfe-7090-9079-5f9f560421db",
    name: "test",
    description: "",
    steps: [
      {
        id: "019d1b4c-6f3a-7ba3-8b2a-4befe8f93065",
        title: "step 2",
        description: "",
        rank: "0|m",
        fields: [],
      },
      {
        id: "019d1b4c-21c3-7b03-b2f5-b6dfb44ed7a2",
        title: "step 1",
        description: "",
        rank: "0|n",
        fields: [],
      },
    ],
  },
}
