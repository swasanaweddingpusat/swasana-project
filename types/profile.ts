export const GenderEnum = { MALE: "MALE", FEMALE: "FEMALE" } as const;
export type Gender = (typeof GenderEnum)[keyof typeof GenderEnum];
