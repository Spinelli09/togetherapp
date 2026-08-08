// A "use server" module may only export async functions, so this constant
// cannot live alongside the auth actions that enforce it. It sits here so
// the rule is defined once and imported by every form that chooses or
// validates a password, rather than being retyped as a literal in four
// places that could drift apart.
//
// Supabase's own floor is 6; this is the app's.
export const MIN_PASSWORD_LENGTH = 8;
