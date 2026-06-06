export type FormActionState = {
  status: "idle" | "success" | "error";
  message: string;
  payload?: string;
  selectedServerId?: string;
  selectedClient?: string;
  gatewayUrl?: string;
};

export const initialFormActionState: FormActionState = {
  status: "idle",
  message: ""
};
