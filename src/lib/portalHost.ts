/**
 * Host / portal routing helpers.
 *
 * The app serves the same single-page app on whichever host it is deployed to
 * and lands on the Employee Sign-In page by default.
 * The Customer Portal is reachable from the same origin under `/portal/*`.
 */
export type PortalHostType = 'company' | 'customer';

/** Always return 'company' — both hosts serve the employee app at /. */
export const getPortalHostType = (): PortalHostType => 'company';

export const isCustomerPortalHost = () => false;

/**
 * Origin used to build email-confirmation / password-reset redirect URLs.
 * Always the current origin so links work on whichever host the user signed up from.
 */
export const getCustomerPortalOrigin = (): string => {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

/** Origin used to send the user to the Employee / Company portal. */
export const getCompanyPortalOrigin = (): string => {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

/** Navigate to the Customer Portal login (same origin). */
export const goToCustomerLogin = () => {
  if (typeof window === 'undefined') return;
  window.location.assign('/portal/auth');
};

/** Navigate to the Employee / Company Portal login (same origin). */
export const goToEmployeeLogin = () => {
  if (typeof window === 'undefined') return;
  window.location.assign('/auth');
};
