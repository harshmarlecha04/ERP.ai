export const PO_APPROVER_EMAILS = [
  'mfg@pharmvista.com',
  'bizops@pharmvista.com',
  'licensing@pharmvista.com',
  'sales@pharmvista.com',
] as const;

export const isPoApprover = (email?: string | null) =>
  !!email && (PO_APPROVER_EMAILS as readonly string[]).includes(email.toLowerCase());
