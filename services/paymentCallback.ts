export type CallbackOutcome = 'success' | 'confirming' | 'failed';

// httpStatus is null when no response came back. A customer may have paid in every case except
// a real failure, so only an answer that says the payment failed counts as one: a missing session
// (401, 403), a server error or a lost connection only mean we could not check here.
export function callbackOutcome(
  data: { success?: boolean; confirming?: boolean } | null | undefined,
  httpStatus: number | null,
): CallbackOutcome {
  if (data?.success) return 'success';
  if (data?.confirming) return 'confirming';
  if (httpStatus === null || httpStatus === 401 || httpStatus === 403 || httpStatus >= 500) {
    return 'confirming';
  }
  return 'failed';
}
